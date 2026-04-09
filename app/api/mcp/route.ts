/**
 * MCP server — implements the Model Context Protocol over HTTP (JSON-RPC 2.0)
 * Compatible with Next.js App Router (Web API Request/Response).
 *
 * Supported methods: initialize, tools/list, tools/call
 * Tools: diagnose_harness, improve_harness
 */

import { z } from 'zod'
import { validateApiKey } from '@/lib/api/auth'
import { fetchGitHubHarnessFiles } from '@/lib/github/fetch'
import { hashFiles, hashContent } from '@/lib/harness/parser'
import { analyzeHarness } from '@/lib/ai/analyzer'
import { db } from '@/lib/db'
import { harnessAnalyses, harnessFiles, projects } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ── JSON-RPC types ──────────────────────────────────────────────────────────

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: unknown
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

function ok(id: JsonRpcRequest['id'], result: unknown): Response {
  const body: JsonRpcResponse = { jsonrpc: '2.0', id, result }
  return Response.json(body)
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string): Response {
  const body: JsonRpcResponse = { jsonrpc: '2.0', id, error: { code, message } }
  return Response.json(body, { status: 200 }) // MCP errors stay 200 per spec
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateProject(userId: string, githubRepoUrl: string) {
  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.githubRepoUrl, githubRepoUrl)))
    .limit(1)
  if (existing) return existing

  const repoName = githubRepoUrl.replace(/\.git$/, '').split('/').slice(-2).join('/')
  const [created] = await db
    .insert(projects)
    .values({ userId, name: repoName, githubRepoUrl })
    .returning()
  return created
}

async function syncAndAnalyze(userId: string, githubRepoUrl: string) {
  const fileMap = await fetchGitHubHarnessFiles(githubRepoUrl, null)
  const project = await getOrCreateProject(userId, githubRepoUrl)

  for (const [filePath, content] of Object.entries(fileMap)) {
    const fileHash = hashContent(content)
    await db
      .insert(harnessFiles)
      .values({ projectId: project.id, filePath, content, fileHash })
      .onConflictDoUpdate({
        target: [harnessFiles.projectId, harnessFiles.filePath],
        set: { content, fileHash, lastSyncedAt: new Date() },
      })
  }

  const allFiles = await db.select().from(harnessFiles).where(eq(harnessFiles.projectId, project.id))
  const filesHash = hashFiles(allFiles.map((f) => ({ hash: f.fileHash })))

  const [cached] = await db
    .select()
    .from(harnessAnalyses)
    .where(and(eq(harnessAnalyses.projectId, project.id), eq(harnessAnalyses.filesHash, filesHash)))
    .limit(1)

  if (cached) return { analysis: cached, fileCount: allFiles.length, fromCache: true }

  const fileContents = allFiles.map((f) => `### ${f.filePath}\n${f.content}`).join('\n\n---\n\n')
  const result = await analyzeHarness(fileContents)

  const [saved] = await db
    .insert(harnessAnalyses)
    .values({ projectId: project.id, filesHash, scores: result.scores, recommendations: result.recommendations, tokenUsage: result.tokenUsage })
    .returning()

  return { analysis: saved, fileCount: allFiles.length, fromCache: false }
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'diagnose_harness',
    description: `현재 하네스를 진단하고 context / enforcement / gc 3축 점수를 반환합니다.
githubRepoUrl이 제공되지 않으면 현재 디렉토리에서 \`git remote get-url origin\`을 실행해 자동으로 URL을 찾으세요.
GitHub URL 형식: https://github.com/org/repo (trailing slash나 .git 제거)`,
    inputSchema: {
      type: 'object',
      properties: {
        githubRepoUrl: { type: 'string', description: 'GitHub 레포지토리 URL. 생략 시 현재 디렉토리의 git remote origin에서 자동 감지.' },
      },
      required: ['githubRepoUrl'],
    },
  },
  {
    name: 'improve_harness',
    description: `하네스 개선 방법을 우선순위별로 제안합니다. applyIndex를 지정하면 해당 항목의 실행 프롬프트를 반환합니다.
githubRepoUrl이 제공되지 않으면 현재 디렉토리에서 \`git remote get-url origin\`을 실행해 자동으로 URL을 찾으세요.`,
    inputSchema: {
      type: 'object',
      properties: {
        githubRepoUrl: { type: 'string', description: 'GitHub 레포지토리 URL. 생략 시 현재 디렉토리의 git remote origin에서 자동 감지.' },
        applyIndex: { type: 'number', description: '적용할 추천 항목 번호 (0부터). 생략 시 목록만 반환합니다.' },
      },
      required: ['githubRepoUrl'],
    },
  },
]

// ── Tool handlers ────────────────────────────────────────────────────────────

async function callTool(name: string, args: unknown, userId: string): Promise<unknown> {
  if (name === 'diagnose_harness') {
    const { githubRepoUrl } = z.object({ githubRepoUrl: z.string().url() }).parse(args)
    const { analysis, fileCount, fromCache } = await syncAndAnalyze(userId, githubRepoUrl)
    const { context, enforcement, gc } = analysis.scores
    const avg = Math.round((context + enforcement + gc) / 3)
    const grade = avg >= 80 ? 'A' : avg >= 60 ? 'B' : avg >= 40 ? 'C' : 'D'

    const text = [
      `## 하네스 진단 결과 — ${githubRepoUrl}`,
      '',
      `| 축 | 점수 | 의미 |`,
      `|---|---|---|`,
      `| 컨텍스트 | ${context}/100 | AI에게 프로젝트를 얼마나 잘 설명하는가 |`,
      `| 자동강제 | ${enforcement}/100 | 품질 기준이 얼마나 자동으로 강제되는가 |`,
      `| 가비지컬렉션 | ${gc}/100 | 자동 정리/스케줄이 얼마나 잘 설정됐는가 |`,
      `| **종합** | **${avg}/100 (${grade}등급)** | |`,
      '',
      `분석된 파일 수: ${fileCount}개${fromCache ? ' (캐시됨)' : ''}`,
      '',
      `개선 방법을 보려면: "내 하네스 개선해줘"`,
    ].join('\n')

    return { content: [{ type: 'text', text }] }
  }

  if (name === 'improve_harness') {
    const { githubRepoUrl, applyIndex } = z.object({
      githubRepoUrl: z.string().url(),
      applyIndex: z.number().int().min(0).optional(),
    }).parse(args)

    const { analysis } = await syncAndAnalyze(userId, githubRepoUrl)
    const recs = analysis.recommendations

    if (recs.length === 0) {
      return { content: [{ type: 'text', text: '🎉 개선 사항이 없습니다. 하네스가 훌륭합니다!' }] }
    }

    if (applyIndex === undefined) {
      const emoji = { urgent: '🔴', high: '🟠', medium: '🟡' } as const
      const text = [
        `## 하네스 개선 추천 — ${githubRepoUrl}`,
        '',
        ...recs.map((r, i) => {
          const e = emoji[r.priority as keyof typeof emoji] ?? '⚪'
          return `### ${i}. ${e} [${r.priority.toUpperCase()}] ${r.title}\n**${r.category}** | ${r.description}`
        }),
        '',
        '---',
        '진행할 항목 번호를 알려주세요. 예: "0번 적용해줘"',
      ].join('\n')
      return { content: [{ type: 'text', text }] }
    }

    const rec = recs[applyIndex]
    if (!rec) {
      return { content: [{ type: 'text', text: `❌ ${applyIndex}번 항목이 없습니다. 0–${recs.length - 1} 사이 번호를 입력하세요.` }] }
    }

    return { content: [{ type: 'text', text: [`## ${rec.title} 적용`, '', rec.action].join('\n') }] }
  }

  throw new Error(`Unknown tool: ${name}`)
}

// ── MCP method router ────────────────────────────────────────────────────────

const SESSION_ID = 'harness-coach-session'

async function handleMethod(req: JsonRpcRequest, userId: string): Promise<Response> {
  // Notifications have no id — acknowledge with 202, no body
  if (req.id === undefined || req.id === null && req.method.startsWith('notifications/')) {
    return new Response(null, { status: 202 })
  }

  if (req.method === 'initialize') {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'harness-coach', version: '1.0.0' },
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': SESSION_ID,
        },
      }
    )
  }

  if (req.method === 'ping') {
    return ok(req.id, {})
  }

  if (req.method === 'tools/list') {
    return ok(req.id, { tools: TOOLS })
  }

  if (req.method === 'tools/call') {
    const { name, arguments: args } = req.params as { name: string; arguments: unknown }
    try {
      const result = await callTool(name, args, userId)
      return ok(req.id, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution failed'
      return rpcError(req.id, -32000, message)
    }
  }

  // Unknown method — return error only if it has an id (not a notification)
  if (req.id !== undefined) {
    return rpcError(req.id, -32601, `Method not found: ${req.method}`)
  }
  return new Response(null, { status: 202 })
}

// ── Route handlers ───────────────────────────────────────────────────────────

function logRequest(method: string, userId: string | null, status: number) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), path: '/api/mcp', method, userId, status }))
}

export async function POST(req: Request) {
  const user = await validateApiKey(req)
  if (!user) {
    logRequest('POST', null, 401)
    return Response.json({ error: 'Unauthorized. Authorization: Bearer <api-key> 헤더가 필요합니다.' }, { status: 401 })
  }

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    logRequest('POST', user.userId, 400)
    return rpcError(null, -32700, 'Parse error')
  }

  try {
    const response = await handleMethod(body, user.userId)
    logRequest('POST', user.userId, 200)
    return response
  } catch (err) {
    console.error('[MCP] unhandled error', err)
    logRequest('POST', user.userId, 500)
    return rpcError(body.id, -32603, 'Internal error')
  }
}

// SSE endpoint for MCP clients that use GET for discovery
export async function GET(req: Request) {
  const user = await validateApiKey(req)
  if (!user) {
    logRequest('GET', null, 401)
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    logRequest('GET', user.userId, 200)
    return Response.json({ name: 'harness-coach', version: '1.0.0', protocol: 'mcp/2024-11-05' })
  } catch (err) {
    console.error('[MCP] GET error', err)
    logRequest('GET', user.userId, 500)
    return new Response('Internal server error', { status: 500 })
  }
}
