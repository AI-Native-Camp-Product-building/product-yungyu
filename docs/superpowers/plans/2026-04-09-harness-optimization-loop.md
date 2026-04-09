# Harness Optimization Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `diagnose_harness`와 `improve_harness` MCP 도구에 `files` 파라미터를 추가해 GitHub fetch 없이 로컬 파일을 직접 분석·개선하는 루프를 가능하게 한다.

**Architecture:** Claude Code가 로컬 하네스 파일을 읽어 MCP 도구에 직접 전달 → 진단 → 개선된 파일 내용 수신 → 로컬 파일 쓰기 → 재진단 반복. MCP 서버는 `files`가 제공되면 GitHub fetch와 DB 캐시를 스킵한다.

**Tech Stack:** Next.js 16 App Router, Zod, Vitest, AI SDK v6 (generateText via Vercel AI Gateway)

---

## File Map

| 파일 | 변경 종류 | 역할 |
|------|----------|------|
| `lib/ai/analyzer.ts` | Modify | `ImprovedFile`, `ImprovementResult` 타입 추가; `buildImprovementPrompt`, `parseImprovementResponse`, `generateImprovedFiles` 추가 |
| `lib/ai/analyzer.test.ts` | Modify | 위 순수 함수 테스트 추가 |
| `app/api/mcp/route.ts` | Modify | `diagnose_harness`에 `files?` 파라미터 추가; `improve_harness`에 `files?` + `recommendations?` 추가 + `improved_files` 반환 |

---

## Task 1: `analyzer.ts`에 개선 관련 타입과 순수 함수 추가

**Files:**
- Modify: `lib/ai/analyzer.ts`
- Modify: `lib/ai/analyzer.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`lib/ai/analyzer.test.ts`에 추가:

```typescript
import { buildImprovementPrompt, parseImprovementResponse } from './analyzer'

describe('buildImprovementPrompt', () => {
  it('includes recommendation titles in prompt', () => {
    const files = [{ path: 'CLAUDE.md', content: '# Project' }]
    const recs = [{ priority: 'urgent' as const, category: 'context' as const, title: '기술 스택 추가', description: '스택 정보 없음', action: '' }]
    const prompt = buildImprovementPrompt(files, recs)
    expect(prompt).toContain('기술 스택 추가')
    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('# Project')
  })

  it('includes all file contents separated by ---', () => {
    const files = [
      { path: 'CLAUDE.md', content: '# A' },
      { path: 'skills/foo.md', content: '# B' },
    ]
    const prompt = buildImprovementPrompt(files, [])
    expect(prompt).toContain('---')
    expect(prompt).toContain('# A')
    expect(prompt).toContain('# B')
  })
})

describe('parseImprovementResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      summary: '개선 완료',
      improved_files: [{ path: 'CLAUDE.md', content: '# Updated', change_summary: '기술 스택 추가' }],
    })
    const result = parseImprovementResponse(raw)
    expect(result.summary).toBe('개선 완료')
    expect(result.improved_files).toHaveLength(1)
    expect(result.improved_files[0].path).toBe('CLAUDE.md')
    expect(result.improved_files[0].content).toBe('# Updated')
    expect(result.improved_files[0].change_summary).toBe('기술 스택 추가')
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"summary":"test","improved_files":[]}\n```'
    const result = parseImprovementResponse(raw)
    expect(result.summary).toBe('test')
    expect(result.improved_files).toHaveLength(0)
  })

  it('throws SyntaxError on invalid JSON', () => {
    expect(() => parseImprovementResponse('not json')).toThrow(SyntaxError)
  })

  it('returns empty improved_files when key is missing', () => {
    const raw = JSON.stringify({ summary: 'ok' })
    const result = parseImprovementResponse(raw)
    expect(result.improved_files).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /c/Users/yg423/projects/harness-manager
npm run test -- --reporter=verbose lib/ai/analyzer.test.ts
```

Expected: `buildImprovementPrompt is not a function` 오류

- [ ] **Step 3: `lib/ai/analyzer.ts`에 타입과 순수 함수 구현**

`AnalysisResult` 정의 바로 아래에 추가:

```typescript
export interface ImprovedFile {
  path: string
  content: string
  change_summary: string
}

export interface ImprovementResult {
  summary: string
  improved_files: ImprovedFile[]
}
```

`parseAnalysisResponse` 함수 아래에 추가:

```typescript
export function buildImprovementPrompt(
  files: { path: string; content: string }[],
  recommendations: Recommendation[]
): string {
  const fileContents = files.map((f) => `### ${f.path}\n${f.content}`).join('\n\n---\n\n')
  const recList = recommendations
    .map((r, i) => `${i}. [${r.priority.toUpperCase()}] ${r.title}: ${r.description}`)
    .join('\n')

  return `You are a harness engineering expert. Apply the following recommendations to the provided harness files.

## Recommendations to Apply
${recList}

## Current Files
${fileContents}

Return ONLY a JSON object with this structure:
{
  "summary": "<brief summary of all changes made in Korean>",
  "improved_files": [
    {
      "path": "<exact file path>",
      "content": "<complete new file content>",
      "change_summary": "<one-line description of what changed in Korean>"
    }
  ]
}

Rules:
- Only include files that were actually modified
- Provide the COMPLETE new content for each modified file (not diffs)
- If a recommendation requires creating a new file, include it with its full content
- Return ONLY the JSON, no other text`
}

export function parseImprovementResponse(raw: string): ImprovementResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    summary: parsed.summary ?? '',
    improved_files: (parsed.improved_files ?? []).map((f: ImprovedFile) => ({
      path: f.path,
      content: f.content,
      change_summary: f.change_summary,
    })),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm run test -- --reporter=verbose lib/ai/analyzer.test.ts
```

Expected: 모든 `buildImprovementPrompt`, `parseImprovementResponse` 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/ai/analyzer.ts lib/ai/analyzer.test.ts
git commit -m "feat: add buildImprovementPrompt and parseImprovementResponse to analyzer"
```

---

## Task 2: `generateImprovedFiles` AI 함수 추가

**Files:**
- Modify: `lib/ai/analyzer.ts`

- [ ] **Step 1: `/* c8 ignore start */` 블록 안에 함수 추가**

`analyzeHarness` 함수 끝 (`/* c8 ignore end */`) 바로 위에 추가:

```typescript
export async function generateImprovedFiles(
  files: { path: string; content: string }[],
  recommendations: Recommendation[]
): Promise<ImprovementResult> {
  const { text, usage } = await generateText({
    model: 'anthropic/claude-haiku-4.5' as Parameters<typeof generateText>[0]['model'],
    prompt: buildImprovementPrompt(files, recommendations),
  })

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0
  console.log(`[AI] improve tokens=${inputTokens + outputTokens}, est_cost=$${estimatedCostUsd.toFixed(5)}`)

  return parseImprovementResponse(text)
}
```

결과적으로 `/* c8 ignore */` 블록은:

```typescript
/* c8 ignore start */
export async function analyzeHarness(...) { ... }
export async function generateImprovedFiles(...) { ... }
/* c8 ignore end */
```

- [ ] **Step 2: 빌드 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add lib/ai/analyzer.ts
git commit -m "feat: add generateImprovedFiles to analyzer"
```

---

## Task 3: `diagnose_harness`에 `files` 파라미터 추가

**Files:**
- Modify: `app/api/mcp/route.ts`

- [ ] **Step 1: import 추가**

`route.ts` 상단 import에 추가:

```typescript
import { analyzeHarness } from '@/lib/ai/analyzer'
```

(이미 있으므로 확인만)

그리고:

```typescript
import type { Recommendation } from '@/lib/db/schema'
```

- [ ] **Step 2: `TOOLS` 배열에서 `diagnose_harness` inputSchema 수정**

```typescript
{
  name: 'diagnose_harness',
  description: `현재 하네스를 진단하고 context / enforcement / gc 3축 점수를 반환합니다.
githubRepoUrl이 제공되지 않으면 현재 디렉토리에서 \`git remote get-url origin\`을 실행해 자동으로 URL을 찾으세요.
files를 직접 전달하면 GitHub fetch 없이 즉시 분석합니다 (루프 모드).`,
  inputSchema: {
    type: 'object',
    properties: {
      githubRepoUrl: {
        type: 'string',
        description: 'GitHub 레포지토리 URL. files 미제공 시 필수.',
      },
      files: {
        type: 'array',
        description: '직접 분석할 파일 목록. 제공 시 GitHub fetch 스킵.',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      },
    },
  },
},
```

- [ ] **Step 3: `callTool`의 `diagnose_harness` 핸들러 수정**

기존 코드:
```typescript
if (name === 'diagnose_harness') {
  const { githubRepoUrl } = z.object({ githubRepoUrl: z.string().url() }).parse(args)
  const { analysis, fileCount, fromCache } = await syncAndAnalyze(userId, githubRepoUrl)
  ...
```

교체:
```typescript
if (name === 'diagnose_harness') {
  const FileSchema = z.object({ path: z.string(), content: z.string() })
  const parsed = z
    .object({
      githubRepoUrl: z.string().url().optional(),
      files: z.array(FileSchema).optional(),
    })
    .refine((d) => d.githubRepoUrl || (d.files && d.files.length > 0), {
      message: 'githubRepoUrl 또는 files 중 하나는 필요합니다.',
    })
    .parse(args)

  let scores: { context: number; enforcement: number; gc: number }
  let recommendations: Recommendation[]
  let fileCount: number
  let fromCache = false
  let repoLabel: string

  if (parsed.files) {
    // 루프 모드: 파일 직접 분석 (GitHub fetch / DB 스킵)
    const fileContents = parsed.files.map((f) => `### ${f.path}\n${f.content}`).join('\n\n---\n\n')
    const result = await analyzeHarness(fileContents)
    scores = result.scores
    recommendations = result.recommendations
    fileCount = parsed.files.length
    repoLabel = 'local'
  } else {
    const { analysis, fileCount: fc, fromCache: cached } = await syncAndAnalyze(userId, parsed.githubRepoUrl!)
    scores = analysis.scores as { context: number; enforcement: number; gc: number }
    recommendations = analysis.recommendations as Recommendation[]
    fileCount = fc
    fromCache = cached
    repoLabel = parsed.githubRepoUrl!
  }

  const { context, enforcement, gc } = scores
  const avg = Math.round((context + enforcement + gc) / 3)
  const grade = avg >= 80 ? 'A' : avg >= 60 ? 'B' : avg >= 40 ? 'C' : 'D'

  const text = [
    `## 하네스 진단 결과 — ${repoLabel}`,
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
    '```json',
    JSON.stringify({ loop_data: { total: avg, scores, recommendations } }),
    '```',
  ].join('\n')

  return { content: [{ type: 'text', text }] }
}
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add app/api/mcp/route.ts
git commit -m "feat: add files param to diagnose_harness MCP tool"
```

---

## Task 4: `improve_harness`에 `files` + `recommendations` 파라미터 추가

**Files:**
- Modify: `app/api/mcp/route.ts`

- [ ] **Step 1: `generateImprovedFiles` import 추가**

`route.ts` 상단:

```typescript
import { analyzeHarness, generateImprovedFiles } from '@/lib/ai/analyzer'
```

- [ ] **Step 2: `TOOLS` 배열에서 `improve_harness` inputSchema 수정**

```typescript
{
  name: 'improve_harness',
  description: `하네스 개선 방법을 우선순위별로 제안하거나 개선된 파일 내용을 반환합니다.
files + recommendations를 전달하면 개선된 파일 내용을 즉시 반환합니다 (루프 모드).
githubRepoUrl이 제공되지 않으면 현재 디렉토리에서 \`git remote get-url origin\`을 실행해 자동으로 URL을 찾으세요.`,
  inputSchema: {
    type: 'object',
    properties: {
      githubRepoUrl: {
        type: 'string',
        description: 'GitHub 레포지토리 URL. files 미제공 시 필수.',
      },
      applyIndex: {
        type: 'number',
        description: '적용할 추천 항목 번호 (0부터). 생략 시 목록만 반환합니다.',
      },
      files: {
        type: 'array',
        description: '직접 개선할 파일 목록 (루프 모드).',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      },
      recommendations: {
        type: 'array',
        description: 'diagnose_harness의 loop_data.recommendations. 제공 시 재진단 스킵.',
        items: {
          type: 'object',
          properties: {
            priority: { type: 'string' },
            category: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            action: { type: 'string' },
          },
          required: ['priority', 'title', 'description'],
        },
      },
    },
  },
},
```

- [ ] **Step 3: `callTool`의 `improve_harness` 핸들러 수정**

기존 코드:
```typescript
if (name === 'improve_harness') {
  const { githubRepoUrl, applyIndex } = z.object({
    githubRepoUrl: z.string().url(),
    applyIndex: z.number().int().min(0).optional(),
  }).parse(args)

  const { analysis } = await syncAndAnalyze(userId, githubRepoUrl)
  ...
```

교체:
```typescript
if (name === 'improve_harness') {
  const FileSchema = z.object({ path: z.string(), content: z.string() })
  const RecSchema = z.object({
    priority: z.string(),
    category: z.string().optional(),
    title: z.string(),
    description: z.string(),
    action: z.string().optional().default(''),
  })
  const parsed = z.object({
    githubRepoUrl: z.string().url().optional(),
    applyIndex: z.number().int().min(0).optional(),
    files: z.array(FileSchema).optional(),
    recommendations: z.array(RecSchema).optional(),
  }).parse(args)

  // 루프 모드: files + recommendations 직접 제공
  if (parsed.files && parsed.recommendations) {
    const recs = parsed.recommendations as Recommendation[]
    if (recs.length === 0) {
      return { content: [{ type: 'text', text: '🎉 개선 사항이 없습니다. 하네스가 훌륭합니다!' }] }
    }
    const result = await generateImprovedFiles(parsed.files, recs)
    const text = [
      `## 하네스 개선 완료`,
      '',
      result.summary,
      '',
      '### 수정된 파일',
      ...result.improved_files.map((f) => `- \`${f.path}\`: ${f.change_summary}`),
      '',
      '```json',
      JSON.stringify({ loop_data: { improved_files: result.improved_files } }),
      '```',
    ].join('\n')
    return { content: [{ type: 'text', text }] }
  }

  // 기존 GitHub 모드
  const { analysis } = await syncAndAnalyze(userId, parsed.githubRepoUrl!)
  const recs = analysis.recommendations
  if (recs.length === 0) {
    return { content: [{ type: 'text', text: '🎉 개선 사항이 없습니다. 하네스가 훌륭합니다!' }] }
  }
  if (parsed.applyIndex === undefined) {
    const emoji = { urgent: '🔴', high: '🟠', medium: '🟡' } as const
    const text = [
      `## 하네스 개선 추천 — ${parsed.githubRepoUrl}`,
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
  const rec = recs[parsed.applyIndex]
  if (!rec) {
    return { content: [{ type: 'text', text: `❌ ${parsed.applyIndex}번 항목이 없습니다. 0–${recs.length - 1} 사이 번호를 입력하세요.` }] }
  }
  return { content: [{ type: 'text', text: [`## ${rec.title} 적용`, '', rec.action].join('\n') }] }
}
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 5: 전체 테스트 실행**

```bash
npm run test
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add app/api/mcp/route.ts
git commit -m "feat: add files+recommendations params to improve_harness, return improved_files"
```

---

## Task 5: 검증

- [ ] **Step 1: 루프 시나리오 수동 테스트**

개발 서버 실행:
```bash
npm run dev
```

별도 터미널에서 `scripts/create-dev-api-key.mjs`로 API 키 발급 후:

```bash
# diagnose_harness with files
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "diagnose_harness",
      "arguments": {
        "files": [
          {"path": "CLAUDE.md", "content": "# Test Project\n\nSimple test."}
        ]
      }
    }
  }' | jq '.result.content[0].text'
```

Expected: 점수 테이블 + `loop_data` JSON 블록 포함

- [ ] **Step 2: `improve_harness` 루프 모드 테스트**

```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "improve_harness",
      "arguments": {
        "files": [{"path": "CLAUDE.md", "content": "# Test"}],
        "recommendations": [
          {"priority": "urgent", "title": "기술 스택 추가", "description": "스택 정보 없음", "action": ""}
        ]
      }
    }
  }' | jq '.result.content[0].text'
```

Expected: 수정된 파일 목록 + `loop_data.improved_files` JSON 블록

- [ ] **Step 3: 커버리지 확인**

```bash
npm run test:coverage
```

Expected: `lib/ai/analyzer.ts` 순수 함수 커버리지 80% 이상

- [ ] **Step 4: camp 리모트에 푸시**

```bash
git push camp main
```
