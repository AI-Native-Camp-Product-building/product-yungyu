'use server'

import { db } from '@/lib/db'
import { harnessFiles, projects } from '@/lib/db/schema'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const HARNESS_FILE_MATCHERS = [
  // Claude Code 핵심 파일
  (p: string) => p === 'CLAUDE.md',
  (p: string) => p.startsWith('skills/') && p.endsWith('.md'),
  (p: string) => p.startsWith('hooks/'),
  (p: string) => p.startsWith('.claude/skills/'),
  (p: string) => p.startsWith('.claude/hooks/'),
  (p: string) => p === '.claude/settings.json',
  (p: string) => p === 'settings.json',
  // 자동강제 — git hooks, CI/CD
  (p: string) => p.startsWith('.husky/'),
  (p: string) => p.startsWith('.github/workflows/') && (p.endsWith('.yml') || p.endsWith('.yaml')),
  (p: string) => p === '.pre-commit-config.yaml',
  // 자동강제 — 테스트/린트 설정
  (p: string) => ['vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js'].includes(p),
  (p: string) => p === 'package.json',
  // 가비지컬렉션 — 스케줄/자동화
  (p: string) => p === 'vercel.json',
  (p: string) => p === 'Makefile',
]

async function getGitHubToken(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const { data } = await client.users.getUserOauthAccessToken(userId, 'oauth_github')
  return data[0]?.token ?? null
}

function githubHeaders(token: string | null): HeadersInit {
  return {
    Accept: 'application/vnd.github.v3+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export type GitHubRepo = {
  name: string
  fullName: string
  private: boolean
  description: string | null
  htmlUrl: string
}

export async function fetchUserGitHubRepos(): Promise<GitHubRepo[]> {
  const token = await getGitHubToken()
  if (!token) return []

  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: githubHeaders(token),
    next: { revalidate: 0 },
  })
  if (!res.ok) return []

  const data = await res.json() as { name: string; full_name: string; private: boolean; description: string | null; html_url: string }[]
  return data.map((r) => ({
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    description: r.description,
    htmlUrl: r.html_url,
  }))
}

export async function fetchGitHubHarnessFiles(repoUrl: string): Promise<Record<string, string>> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/|\.git|$)/)
  if (!match) throw new Error('유효하지 않은 GitHub URL입니다.')
  const [, owner, repo] = match

  const token = await getGitHubToken()
  const headers = githubHeaders(token)

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    next: { revalidate: 0 },
  })
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error('레포지토리를 찾을 수 없습니다. Private 레포라면 GitHub으로 로그인했는지 확인하세요.')
    throw new Error('GitHub API 요청에 실패했습니다.')
  }
  const { default_branch } = await repoRes.json() as { default_branch: string }

  const branchesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    { headers, next: { revalidate: 0 } }
  )
  const branchesData = branchesRes.ok
    ? await branchesRes.json() as { name: string }[]
    : [{ name: default_branch }]

  // default_branch 우선, 나머지는 알파벳 순
  const branches = [
    default_branch,
    ...branchesData.map((b) => b.name).filter((n) => n !== default_branch),
  ]

  const fileMap: Record<string, string> = {}

  await Promise.all(
    branches.map(async (branch) => {
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers, next: { revalidate: 0 } }
      )
      if (!treeRes.ok) return
      const { tree } = await treeRes.json() as { tree: { type: string; path: string }[] }

      const targets = tree.filter(
        (item) => item.type === 'blob' && HARNESS_FILE_MATCHERS.some((fn) => fn(item.path))
      )

      await Promise.all(
        targets.map(async (item) => {
          if (fileMap[item.path]) return // default_branch 우선
          const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`,
            { headers, next: { revalidate: 0 } }
          )
          if (!res.ok) return
          const data = await res.json() as { encoding: string; content: string }
          if (data.encoding === 'base64') {
            fileMap[item.path] = Buffer.from(data.content, 'base64').toString('utf-8')
          }
        })
      )
    })
  )

  return fileMap
}

export async function saveHarnessFiles(
  projectId: string,
  fileMap: Record<string, string>
) {
  const { hashContent } = await import('@/lib/harness/parser')
  const entries = Object.entries(fileMap)

  for (const [filePath, content] of entries) {
    const fileHash = hashContent(content)
    await db
      .insert(harnessFiles)
      .values({ projectId, filePath, content, fileHash })
      .onConflictDoUpdate({
        target: [harnessFiles.projectId, harnessFiles.filePath],
        set: { content, fileHash, lastSyncedAt: new Date() },
      })
  }

  return entries.length
}

export async function syncFromGitHub(projectId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
  if (!project?.githubRepoUrl) throw new Error('GitHub 레포가 연결되지 않은 프로젝트입니다.')

  const fileMap = await fetchGitHubHarnessFiles(project.githubRepoUrl)
  const count = await saveHarnessFiles(projectId, fileMap)

  revalidatePath(`/projects/${projectId}`)
  return count
}

export async function syncAllProjects() {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const { users } = await import('@/lib/db/schema')
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
  if (!user) return 0

  const userProjects = await db.select().from(projects).where(eq(projects.userId, user.id))
  const githubProjects = userProjects.filter((p) => p.githubRepoUrl)

  const { getOrRunAnalysis } = await import('@/actions/analysis')

  await Promise.all(
    githubProjects.map(async (p) => {
      const fileMap = await fetchGitHubHarnessFiles(p.githubRepoUrl!)
      await saveHarnessFiles(p.id, fileMap)
      await getOrRunAnalysis(p.id)
      revalidatePath(`/projects/${p.id}`)
    })
  )

  revalidatePath('/', 'layout')
  return githubProjects.length
}

export async function updateHarnessFile(fileId: string, content: string) {
  const { hashContent } = await import('@/lib/harness/parser')
  const [updated] = await db
    .update(harnessFiles)
    .set({ content, fileHash: hashContent(content), lastSyncedAt: new Date() })
    .where(eq(harnessFiles.id, fileId))
    .returning()
  return updated
}
