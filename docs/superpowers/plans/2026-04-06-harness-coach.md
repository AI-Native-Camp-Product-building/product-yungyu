# Harness Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code 하네스(CLAUDE.md, Skills, Hooks, MCP)를 AI로 진단하고 개선안을 제안하는 웹앱 SaaS MVP 구축.

**Architecture:** Next.js 16 App Router + Server Actions. AI 분석은 Vercel AI Gateway(claude-haiku-4.5)로 스트리밍. 분석 결과는 파일 hash 기반으로 Neon Postgres에 캐시. 파일 업로드는 Vercel Blob.

**Tech Stack:** Next.js 16, shadcn/ui, Geist, Clerk, Drizzle ORM + Neon Postgres, Vercel Blob, AI SDK v6, claude-haiku-4.5 via Vercel AI Gateway (OIDC), Vitest

---

## File Structure

```
harness-manager/
├── app/
│   ├── layout.tsx                          # Root layout, ClerkProvider, dark mode
│   ├── page.tsx                            # Landing → redirect to /dashboard
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   └── (app)/
│       ├── layout.tsx                      # App shell (sidebar, auth guard)
│       ├── dashboard/page.tsx              # Project list
│       └── projects/
│           ├── new/page.tsx                # Create project (upload or GitHub)
│           └── [id]/
│               ├── page.tsx                # Project dashboard (scores + recommendations)
│               ├── editor/page.tsx         # CLAUDE.md + Skills 편집기
│               └── analysis/page.tsx       # AI 분석 실행 뷰
├── app/api/
│   └── projects/[id]/
│       ├── analyze/route.ts                # AI 분석 스트리밍 엔드포인트
│       └── download/route.ts              # Zip 다운로드
├── components/
│   ├── ui/                                # shadcn 자동 생성
│   ├── app-sidebar.tsx                    # 사이드바 (프로젝트 목록)
│   ├── harness-score-card.tsx             # 3축 점수 카드
│   ├── recommendation-card.tsx            # AI 추천 카드 (1클릭 적용)
│   ├── claude-md-editor.tsx              # CLAUDE.md 편집기
│   └── skills-manager.tsx                # Skills 목록 + 편집
├── lib/
│   ├── db/
│   │   ├── schema.ts                      # Drizzle 스키마
│   │   └── index.ts                       # DB 클라이언트
│   ├── harness/
│   │   ├── parser.ts                      # 하네스 파일 파싱 + hash
│   │   └── zipper.ts                      # Zip 생성
│   └── ai/
│       └── analyzer.ts                    # AI 분석 프롬프트 + 파싱
├── actions/
│   ├── projects.ts                        # 프로젝트 CRUD
│   ├── harness.ts                         # 하네스 파일 저장/수정
│   └── analysis.ts                        # 분석 실행 + 캐시
├── middleware.ts                           # Clerk auth
├── drizzle.config.ts
└── vitest.config.ts
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local.example`

- [ ] **Step 1: Next.js 16 앱 생성**

```bash
cd C:/Users/yg423/projects/harness-manager
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

선택 항목: TypeScript=Yes, Tailwind=Yes, ESLint=Yes, App Router=Yes, src/ dir=No

- [ ] **Step 2: 핵심 의존성 설치**

```bash
npm install @clerk/nextjs drizzle-orm @neondatabase/serverless drizzle-zod zod
npm install ai @ai-sdk/react
npm install @vercel/blob
npm install jszip
npm install -D drizzle-kit vitest @vitejs/plugin-react
```

- [ ] **Step 3: shadcn/ui 초기화**

```bash
npx shadcn@latest init
```

선택: Default style, Zinc base color, CSS variables=Yes

```bash
npx shadcn@latest add button card badge separator sheet tabs textarea toast scroll-area
```

- [ ] **Step 4: .env.local 생성**

```bash
cp .env.local.example .env.local
```

`.env.local.example` 내용:
```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Neon Postgres
DATABASE_URL=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Vercel AI Gateway — OIDC 기반 인증 (직접 API 키 사용 금지)
# 로컬 개발: vercel link → vercel env pull 로 자동 프로비저닝
# VERCEL_OIDC_TOKEN= (auto-provisioned by vercel env pull)
```

- [ ] **Step 5: Vitest 설정**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

`package.json`에 추가:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: next.config.ts 설정**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
}

export default nextConfig
```

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: initialize Next.js 16 project with shadcn, Clerk, Drizzle"
```

---

## Task 2: 데이터베이스 스키마

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Drizzle 스키마 작성**

`lib/db/schema.ts`:
```typescript
import { pgTable, text, integer, timestamp, jsonb, uuid, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  githubRepoUrl: text('github_repo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const harnessFiles = pgTable('harness_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  fileHash: text('file_hash').notNull(),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.projectId, t.filePath),
}))

export const harnessAnalyses = pgTable('harness_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  filesHash: text('files_hash').notNull(),
  scores: jsonb('scores').$type<{ context: number; enforcement: number; gc: number }>().notNull(),
  recommendations: jsonb('recommendations').$type<Recommendation[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const harnessVersions = pgTable('harness_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fileId: uuid('file_id').references(() => harnessFiles.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Recommendation = {
  priority: 'urgent' | 'high' | 'medium'
  category: 'context' | 'enforcement' | 'gc'
  title: string
  description: string
  action: string
}
```

- [ ] **Step 2: DB 클라이언트 설정**

`lib/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Drizzle 설정 파일**

`drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

- [ ] **Step 4: 마이그레이션 실행**

Neon 콘솔에서 DATABASE_URL 복사 후 `.env.local`에 붙여넣기, 그 후:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: `migrations complete` 메시지

- [ ] **Step 5: 커밋**

```bash
git add lib/db/ drizzle/ drizzle.config.ts
git commit -m "feat: add database schema (users, projects, harness_files, analyses)"
```

---

## Task 3: Clerk 인증

**Files:**
- Create: `middleware.ts`, `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: middleware.ts 작성**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Root layout에 ClerkProvider 추가**

`app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'Harness Coach',
  description: 'AI-powered Claude Code harness diagnostics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="ko" className="dark">
        <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-background text-foreground`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 3: Sign-in 페이지**

`app/(auth)/sign-in/[[...sign-in]]/page.tsx`:
```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn />
    </div>
  )
}
```

- [ ] **Step 4: Sign-up 페이지**

`app/(auth)/sign-up/[[...sign-up]]/page.tsx`:
```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 5: Clerk 대시보드에서 GitHub OAuth 활성화**

Clerk 대시보드 → Social Connections → GitHub 활성화

- [ ] **Step 6: 커밋**

```bash
git add middleware.ts app/layout.tsx app/(auth)/
git commit -m "feat: add Clerk authentication with GitHub social login"
```

---

## Task 4: 앱 셸 (사이드바 + 레이아웃)

**Files:**
- Create: `components/app-sidebar.tsx`, `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/page.tsx`

- [ ] **Step 1: 사이드바 컴포넌트**

`components/app-sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
}

export function AppSidebar({ projects }: { projects: Project[] }) {
  const pathname = usePathname()

  return (
    <div className="w-48 h-screen bg-black border-r border-border flex flex-col py-4 shrink-0">
      <div className="px-4 mb-4">
        <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">Harness Coach</span>
      </div>

      <div className="px-4 mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Projects</span>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className={cn(
              'block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              pathname.startsWith(`/projects/${p.id}`) && 'text-primary bg-primary/10 border-l-2 border-primary'
            )}
          >
            {p.name}
          </Link>
        ))}
        <Link
          href="/projects/new"
          className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          + 새 프로젝트
        </Link>
      </nav>

      <div className="px-4 pt-4 border-t border-border">
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: App 레이아웃 (auth guard + sidebar)**

`app/(app)/layout.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { AppSidebar } from '@/components/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  const userProjects = user
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.userId, user.id))
    : []

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar projects={userProjects} />
      <main className="flex-1 overflow-y-auto bg-[#111]">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: 대시보드 (프로젝트 없을 때 온보딩)**

`app/(app)/dashboard/page.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  const userProjects = user
    ? await db.select().from(projects).where(eq(projects.userId, user.id))
    : []

  if (userProjects.length === 1) redirect(`/projects/${userProjects[0].id}`)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-2">대시보드</h1>
      <p className="text-muted-foreground mb-8">Claude Code 하네스를 관리하고 개선하세요.</p>
      {userProjects.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">연결된 프로젝트가 없습니다.</p>
          <Link href="/projects/new">
            <Button>첫 프로젝트 연결하기</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {userProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block border border-border rounded-lg p-4 hover:border-primary transition-colors">
              <h3 className="font-medium">{p.name}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 루트 페이지 리다이렉트**

`app/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')
  redirect('/sign-in')
}
```

- [ ] **Step 5: 커밋**

```bash
git add components/app-sidebar.tsx app/(app)/ app/page.tsx
git commit -m "feat: add app shell with sidebar and dashboard layout"
```

---

## Task 5: 하네스 파서 (TDD)

**Files:**
- Create: `lib/harness/parser.ts`, `lib/harness/parser.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/harness/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseHarnessFromMap, hashContent, hashFiles, getAllFiles } from './parser'

describe('parseHarnessFromMap', () => {
  it('CLAUDE.md를 올바르게 파싱한다', () => {
    const files = new Map([['CLAUDE.md', '# Project rules']])
    const result = parseHarnessFromMap(files)
    expect(result.claudeMd).not.toBeNull()
    expect(result.claudeMd?.path).toBe('CLAUDE.md')
    expect(result.claudeMd?.content).toBe('# Project rules')
  })

  it('skills/ 파일들을 파싱한다', () => {
    const files = new Map([
      ['skills/coding.md', '# Coding skill'],
      ['skills/review.md', '# Review skill'],
    ])
    const result = parseHarnessFromMap(files)
    expect(result.skills).toHaveLength(2)
    expect(result.skills[0].path).toBe('skills/coding.md')
  })

  it('hooks/ 파일들을 파싱한다', () => {
    const files = new Map([['hooks/pre-commit.sh', '#!/bin/bash']])
    const result = parseHarnessFromMap(files)
    expect(result.hooks).toHaveLength(1)
  })

  it('.claude/settings.json을 파싱한다', () => {
    const files = new Map([['.claude/settings.json', '{}']])
    const result = parseHarnessFromMap(files)
    expect(result.settings).not.toBeNull()
  })

  it('아무 파일도 없으면 빈 결과를 반환한다', () => {
    const result = parseHarnessFromMap(new Map())
    expect(result.claudeMd).toBeNull()
    expect(result.skills).toHaveLength(0)
    expect(result.hooks).toHaveLength(0)
    expect(result.settings).toBeNull()
  })
})

describe('hashContent', () => {
  it('같은 콘텐츠는 같은 hash를 반환한다', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'))
  })

  it('다른 콘텐츠는 다른 hash를 반환한다', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'))
  })

  it('16자 hex 문자열을 반환한다', () => {
    expect(hashContent('test')).toMatch(/^[a-f0-9]{16}$/)
  })
})

describe('hashFiles', () => {
  it('파일 목록의 통합 hash를 생성한다', () => {
    const files = [
      { path: 'CLAUDE.md', content: 'rules', hash: hashContent('rules') },
    ]
    const h = hashFiles(files)
    expect(h).toMatch(/^[a-f0-9]{16}$/)
  })

  it('파일 순서가 달라도 같은 hash를 반환한다', () => {
    const a = { path: 'a.md', content: 'a', hash: hashContent('a') }
    const b = { path: 'b.md', content: 'b', hash: hashContent('b') }
    expect(hashFiles([a, b])).toBe(hashFiles([b, a]))
  })
})

describe('getAllFiles', () => {
  it('모든 파일을 평탄하게 반환한다', () => {
    const files = new Map([
      ['CLAUDE.md', 'rules'],
      ['skills/coding.md', 'code'],
    ])
    const harness = parseHarnessFromMap(files)
    expect(getAllFiles(harness)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test lib/harness/parser.test.ts
```

Expected: FAIL — `Cannot find module './parser'`

- [ ] **Step 3: parser.ts 구현**

`lib/harness/parser.ts`:
```typescript
import crypto from 'crypto'

export interface HarnessFile {
  path: string
  content: string
  hash: string
}

export interface ParsedHarness {
  claudeMd: HarnessFile | null
  skills: HarnessFile[]
  hooks: HarnessFile[]
  settings: HarnessFile | null
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function hashFiles(files: Pick<HarnessFile, 'hash'>[]): string {
  const combined = files.map((f) => f.hash).sort().join(',')
  return hashContent(combined)
}

export function parseHarnessFromMap(files: Map<string, string>): ParsedHarness {
  const result: ParsedHarness = { claudeMd: null, skills: [], hooks: [], settings: null }

  for (const [path, content] of files) {
    const hash = hashContent(content)
    const file: HarnessFile = { path, content, hash }

    if (path === 'CLAUDE.md' || path.endsWith('/CLAUDE.md')) {
      result.claudeMd = file
    } else if (path.startsWith('skills/') || path.includes('/.claude/skills/')) {
      result.skills.push(file)
    } else if (path.startsWith('hooks/') || path.includes('/.claude/hooks/')) {
      result.hooks.push(file)
    } else if (path === '.claude/settings.json' || path === 'settings.json') {
      result.settings = file
    }
  }

  return result
}

export function getAllFiles(harness: ParsedHarness): HarnessFile[] {
  return [harness.claudeMd, ...harness.skills, ...harness.hooks, harness.settings].filter(
    Boolean
  ) as HarnessFile[]
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test lib/harness/parser.test.ts
```

Expected: PASS (모든 테스트 통과)

- [ ] **Step 5: 커밋**

```bash
git add lib/harness/parser.ts lib/harness/parser.test.ts
git commit -m "feat: add harness file parser with hash-based caching support"
```

---

## Task 6: 프로젝트 생성 + 파일 업로드

**Files:**
- Create: `actions/projects.ts`, `actions/harness.ts`, `app/(app)/projects/new/page.tsx`

- [ ] **Step 1: 유저 upsert 헬퍼를 projects action에 작성**

`actions/projects.ts`:
```typescript
'use server'

import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { auth, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

async function getOrCreateUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (existing) return existing

  const [created] = await db.insert(users).values({ clerkId, email }).returning()
  return created
}

export async function createProject(name: string, githubRepoUrl?: string) {
  const user = await getOrCreateUser()
  const [project] = await db
    .insert(projects)
    .values({ userId: user.id, name, githubRepoUrl })
    .returning()
  return project
}
```

- [ ] **Step 2: 하네스 파일 저장 action**

`actions/harness.ts`:
```typescript
'use server'

import { db } from '@/lib/db'
import { harnessFiles } from '@/lib/db/schema'
import { parseHarnessFromMap, getAllFiles } from '@/lib/harness/parser'
import { eq, and } from 'drizzle-orm'

export async function saveHarnessFiles(
  projectId: string,
  fileMap: Record<string, string>
) {
  const harness = parseHarnessFromMap(new Map(Object.entries(fileMap)))
  const files = getAllFiles(harness)

  for (const file of files) {
    await db
      .insert(harnessFiles)
      .values({
        projectId,
        filePath: file.path,
        content: file.content,
        fileHash: file.hash,
      })
      .onConflictDoUpdate({
        target: [harnessFiles.projectId, harnessFiles.filePath],
        set: { content: file.content, fileHash: file.hash, lastSyncedAt: new Date() },
      })
  }

  return files.length
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
```

- [ ] **Step 3: 새 프로젝트 페이지 (파일 업로드 UI)**

`app/(app)/projects/new/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProject } from '@/actions/projects'
import { saveHarnessFiles } from '@/actions/harness'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [files, setFiles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files
    if (!uploaded) return
    const result: Record<string, string> = {}
    for (const file of Array.from(uploaded)) {
      result[file.name] = await file.text()
    }
    setFiles(result)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || Object.keys(files).length === 0) return
    setLoading(true)
    try {
      const project = await createProject(name)
      await saveHarnessFiles(project.id, files)
      router.push(`/projects/${project.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">새 프로젝트</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="name">프로젝트 이름</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="files">하네스 파일 업로드</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">CLAUDE.md, skills/, hooks/, .claude/settings.json 파일을 선택하세요.</p>
          <Input id="files" type="file" multiple onChange={handleFileChange} className="mt-1" />
          {Object.keys(files).length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{Object.keys(files).length}개 파일 선택됨: {Object.keys(files).join(', ')}</p>
          )}
        </div>
        <Button type="submit" disabled={loading || !name || Object.keys(files).length === 0}>
          {loading ? '생성 중...' : '프로젝트 생성'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add actions/ app/(app)/projects/new/
git commit -m "feat: add project creation with harness file upload"
```

---

## Task 7: AI 분석 엔진 (TDD)

**Files:**
- Create: `lib/ai/analyzer.ts`, `lib/ai/analyzer.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/ai/analyzer.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildAnalysisPrompt, parseAnalysisResponse } from './analyzer'

describe('buildAnalysisPrompt', () => {
  it('파일 내용을 포함한 프롬프트를 생성한다', () => {
    const prompt = buildAnalysisPrompt('### CLAUDE.md\n# Rules')
    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('context')
    expect(prompt).toContain('enforcement')
    expect(prompt).toContain('gc')
  })
})

describe('parseAnalysisResponse', () => {
  it('유효한 JSON 응답을 파싱한다', () => {
    const raw = JSON.stringify({
      scores: { context: 80, enforcement: 50, gc: 30 },
      recommendations: [
        {
          priority: 'high',
          category: 'enforcement',
          title: 'TypeScript hook 추가',
          description: '타입 검사 hook이 없습니다.',
          action: 'pre-commit hook에 tsc --noEmit 추가',
        },
      ],
    })
    const result = parseAnalysisResponse(raw)
    expect(result.scores.context).toBe(80)
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].priority).toBe('high')
  })

  it('잘못된 JSON이면 에러를 던진다', () => {
    expect(() => parseAnalysisResponse('not json')).toThrow()
  })

  it('점수가 0-100 범위를 벗어나면 클램핑한다', () => {
    const raw = JSON.stringify({
      scores: { context: 150, enforcement: -10, gc: 50 },
      recommendations: [],
    })
    const result = parseAnalysisResponse(raw)
    expect(result.scores.context).toBe(100)
    expect(result.scores.enforcement).toBe(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test lib/ai/analyzer.test.ts
```

Expected: FAIL — `Cannot find module './analyzer'`

- [ ] **Step 3: analyzer.ts 구현**

`lib/ai/analyzer.ts`:
```typescript
import { generateText } from 'ai'
import type { Recommendation } from '@/lib/db/schema'

export interface AnalysisResult {
  scores: { context: number; enforcement: number; gc: number }
  recommendations: Recommendation[]
}

export function buildAnalysisPrompt(fileContents: string): string {
  return `You are a harness engineering expert for Claude Code. Analyze the harness files and return ONLY a JSON object.

Required JSON structure:
{
  "scores": {
    "context": <number 0-100: CLAUDE.md and skills coverage>,
    "enforcement": <number 0-100: hooks and automatic enforcement strength>,
    "gc": <number 0-100: garbage collection and cleanup mechanisms>
  },
  "recommendations": [
    {
      "priority": "urgent" | "high" | "medium",
      "category": "context" | "enforcement" | "gc",
      "title": "<concise title in Korean>",
      "description": "<what the problem is, in Korean>",
      "action": "<specific action to take, in Korean>"
    }
  ]
}

Scoring guide:
- context 0-40: No CLAUDE.md; 41-70: Sparse CLAUDE.md; 71-100: Comprehensive with rules and examples
- enforcement 0-40: No hooks; 41-70: Some hooks; 71-100: Pre-commit hooks with type check, lint, test
- gc 0-40: No cleanup; 41-70: Partial cleanup; 71-100: Automated cleanup agent

Return 2-5 recommendations maximum. Return ONLY the JSON, no other text.

HARNESS FILES:
${fileContents}`
}

export function parseAnalysisResponse(raw: string): AnalysisResult {
  const parsed = JSON.parse(raw)
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  return {
    scores: {
      context: clamp(parsed.scores?.context ?? 0),
      enforcement: clamp(parsed.scores?.enforcement ?? 0),
      gc: clamp(parsed.scores?.gc ?? 0),
    },
    recommendations: (parsed.recommendations ?? []).map((r: Recommendation) => ({
      priority: r.priority,
      category: r.category,
      title: r.title,
      description: r.description,
      action: r.action,
    })),
  }
}

export async function analyzeHarness(fileContents: string): Promise<AnalysisResult> {
  const { text } = await generateText({
    model: 'anthropic/claude-haiku-4.5' as any,
    prompt: buildAnalysisPrompt(fileContents),
  })
  return parseAnalysisResponse(text)
}
```

> **Note:** AI Gateway 설정 필수. `vercel link` → Vercel 대시보드에서 AI Gateway 활성화 → `vercel env pull .env.local` 실행. VERCEL_OIDC_TOKEN이 자동 주입되며, `'anthropic/claude-haiku-4.5'` 문자열이 Gateway를 통해 라우팅됨.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npm test lib/ai/analyzer.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add lib/ai/analyzer.ts lib/ai/analyzer.test.ts
git commit -m "feat: add AI harness analyzer with Haiku (TDD)"
```

---

## Task 8: 분석 캐싱 + Server Action

**Files:**
- Create: `actions/analysis.ts`

- [ ] **Step 1: 분석 action 작성 (캐시 우선)**

`actions/analysis.ts`:
```typescript
'use server'

import { db } from '@/lib/db'
import { harnessAnalyses, harnessFiles } from '@/lib/db/schema'
import { analyzeHarness } from '@/lib/ai/analyzer'
import { hashFiles } from '@/lib/harness/parser'
import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'

export async function getOrRunAnalysis(projectId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const files = await db
    .select()
    .from(harnessFiles)
    .where(eq(harnessFiles.projectId, projectId))

  if (files.length === 0) return null

  const filesHash = hashFiles(files.map((f) => ({ hash: f.fileHash })))

  // 캐시 확인
  const cached = await db
    .select()
    .from(harnessAnalyses)
    .where(and(eq(harnessAnalyses.projectId, projectId), eq(harnessAnalyses.filesHash, filesHash)))
    .limit(1)

  if (cached.length > 0) return cached[0]

  // AI 분석 실행
  const fileContents = files
    .map((f) => `### ${f.filePath}\n${f.content}`)
    .join('\n\n---\n\n')

  const result = await analyzeHarness(fileContents)

  const [saved] = await db
    .insert(harnessAnalyses)
    .values({
      projectId,
      filesHash,
      scores: result.scores,
      recommendations: result.recommendations,
    })
    .returning()

  return saved
}

export async function applyRecommendation(
  projectId: string,
  recommendation: { category: string; action: string },
  fileId: string,
  currentContent: string
) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  // 추천 action을 CLAUDE.md 끝에 코멘트로 추가
  const appendedContent = `${currentContent}\n\n<!-- Harness Coach 추천 적용 -->\n<!-- ${recommendation.title ?? ''} -->\n${recommendation.action}`
  const { updateHarnessFile } = await import('@/actions/harness')
  return updateHarnessFile(fileId, appendedContent)
}
```

- [ ] **Step 2: 커밋**

```bash
git add actions/analysis.ts
git commit -m "feat: add analysis caching with file-hash key"
```

---

## Task 9: 프로젝트 대시보드 (점수 + 추천)

**Files:**
- Create: `components/harness-score-card.tsx`, `components/recommendation-card.tsx`, `app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: 점수 카드 컴포넌트**

`components/harness-score-card.tsx`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ScoreCardProps {
  label: string
  score: number
  warning?: string
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

export function HarnessScoreCard({ label, score, warning }: ScoreCardProps) {
  return (
    <Card className="bg-[#1a1a1a] border-border">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={cn('text-3xl font-bold', scoreColor(score))}>
          {score}<span className="text-sm text-muted-foreground">/100</span>
        </p>
        {warning && <p className="text-xs text-yellow-400 mt-1">{warning}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 추천 카드 컴포넌트**

`components/recommendation-card.tsx`:
```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Recommendation } from '@/lib/db/schema'
import { cn } from '@/lib/utils'

const priorityConfig = {
  urgent: { label: '긴급', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: '높음', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  medium: { label: '보통', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
}

interface RecommendationCardProps {
  recommendation: Recommendation
  onApply?: () => void
  applying?: boolean
}

export function RecommendationCard({ recommendation, onApply, applying }: RecommendationCardProps) {
  const config = priorityConfig[recommendation.priority]
  return (
    <Card className="bg-[#1a1a1a] border-border">
      <CardContent className="pt-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-xs', config.className)}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground capitalize">{recommendation.category}</span>
          </div>
          <p className="text-sm font-medium truncate">{recommendation.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{recommendation.description}</p>
        </div>
        {onApply && (
          <Button size="sm" variant="outline" onClick={onApply} disabled={applying} className="shrink-0 text-xs">
            {applying ? '적용 중...' : '1클릭 적용'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 프로젝트 대시보드 페이지**

`app/(app)/projects/[id]/page.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, harnessFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getOrRunAnalysis } from '@/actions/analysis'
import { HarnessScoreCard } from '@/components/harness-score-card'
import { RecommendationCard } from '@/components/recommendation-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) })
  if (!project) redirect('/dashboard')

  const files = await db.select().from(harnessFiles).where(eq(harnessFiles.projectId, id))
  const analysis = files.length > 0 ? await getOrRunAnalysis(id) : null

  const totalScore = analysis
    ? Math.round((analysis.scores.context + analysis.scores.enforcement + analysis.scores.gc) / 3)
    : 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{files.length}개 파일 · 하네스 강도 {totalScore}/100</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${id}/editor`}><Button variant="outline">편집기</Button></Link>
        </div>
      </div>

      {!analysis ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">하네스 파일을 업로드하면 AI 진단이 시작됩니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <HarnessScoreCard label="전체 강도" score={totalScore} />
            <HarnessScoreCard label="컨텍스트 파일" score={analysis.scores.context} />
            <HarnessScoreCard label="자동강제 시스템" score={analysis.scores.enforcement}
              warning={analysis.scores.enforcement < 50 ? 'hook 보강 필요' : undefined} />
            <HarnessScoreCard label="가비지컬렉션" score={analysis.scores.gc}
              warning={analysis.scores.gc < 40 ? '설정 없음' : undefined} />
          </div>

          <h2 className="text-lg font-semibold mb-3">AI 추천 ({analysis.recommendations.length}개)</h2>
          <div className="space-y-3">
            {analysis.recommendations.map((rec, i) => (
              <RecommendationCard key={i} recommendation={rec} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/harness-score-card.tsx components/recommendation-card.tsx app/(app)/projects/[id]/page.tsx
git commit -m "feat: add project dashboard with harness scores and AI recommendations"
```

---

## Task 10: CLAUDE.md 편집기 + Skills 관리자

**Files:**
- Create: `components/claude-md-editor.tsx`, `components/skills-manager.tsx`, `app/(app)/projects/[id]/editor/page.tsx`

- [ ] **Step 1: CLAUDE.md 편집기 컴포넌트**

`components/claude-md-editor.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { updateHarnessFile } from '@/actions/harness'

interface ClaudeMdEditorProps {
  fileId: string
  initialContent: string
}

export function ClaudeMdEditor({ fileId, initialContent }: ClaudeMdEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await updateHarnessFile(fileId, content)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">CLAUDE.md</h2>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 font-mono text-sm resize-none min-h-[500px] bg-[#0a0a0a]"
        placeholder="CLAUDE.md 내용을 입력하세요..."
      />
    </div>
  )
}
```

- [ ] **Step 2: Skills 관리자 컴포넌트**

`components/skills-manager.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updateHarnessFile } from '@/actions/harness'

interface Skill {
  id: string
  filePath: string
  content: string
}

export function SkillsManager({ skills }: { skills: Skill[] }) {
  const [selected, setSelected] = useState<Skill | null>(skills[0] ?? null)
  const [content, setContent] = useState(selected?.content ?? '')
  const [saving, setSaving] = useState(false)

  function selectSkill(skill: Skill) {
    setSelected(skill)
    setContent(skill.content)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    await updateHarnessFile(selected.id, content)
    setSaving(false)
  }

  return (
    <div className="flex gap-4 h-full">
      <div className="w-48 shrink-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Skills</p>
        {skills.length === 0 && <p className="text-xs text-muted-foreground">스킬 없음</p>}
        {skills.map((s) => (
          <button
            key={s.id}
            onClick={() => selectSkill(s)}
            className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors ${selected?.id === s.id ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          >
            {s.filePath.replace('skills/', '')}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">{selected.filePath}</span>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 font-mono text-sm resize-none min-h-[500px] bg-[#0a0a0a]"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          스킬을 선택하세요
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 편집기 페이지**

`app/(app)/projects/[id]/editor/page.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { harnessFiles, projects } from '@/lib/db/schema'
import { eq, and, like } from 'drizzle-orm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClaudeMdEditor } from '@/components/claude-md-editor'
import { SkillsManager } from '@/components/skills-manager'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const files = await db.select().from(harnessFiles).where(eq(harnessFiles.projectId, id))
  const claudeMd = files.find((f) => f.filePath === 'CLAUDE.md')
  const skills = files.filter((f) => f.filePath.startsWith('skills/'))

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-xl font-semibold mb-6">하네스 편집기</h1>
      <Tabs defaultValue="claude-md" className="flex-1 flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="claude-md">CLAUDE.md</TabsTrigger>
          <TabsTrigger value="skills">Skills ({skills.length})</TabsTrigger>
          <TabsTrigger value="hooks" disabled>Hooks (읽기 전용)</TabsTrigger>
          <TabsTrigger value="mcp" disabled>MCP (읽기 전용)</TabsTrigger>
        </TabsList>
        <TabsContent value="claude-md" className="flex-1">
          {claudeMd ? (
            <ClaudeMdEditor fileId={claudeMd.id} initialContent={claudeMd.content} />
          ) : (
            <p className="text-muted-foreground">CLAUDE.md 파일이 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="skills" className="flex-1">
          <SkillsManager skills={skills} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/claude-md-editor.tsx components/skills-manager.tsx app/(app)/projects/[id]/editor/
git commit -m "feat: add CLAUDE.md and skills editor"
```

---

## Task 11: Zip 다운로드

**Files:**
- Create: `lib/harness/zipper.ts`, `app/api/projects/[id]/download/route.ts`

- [ ] **Step 1: zipper.ts 작성**

`lib/harness/zipper.ts`:
```typescript
import JSZip from 'jszip'

export interface ZipEntry {
  path: string
  content: string
}

export async function createHarnessZip(files: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, file.content)
  }
  return zip.generateAsync({ type: 'uint8array' })
}
```

- [ ] **Step 2: 다운로드 API route**

`app/api/projects/[id]/download/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { harnessFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createHarnessZip } from '@/lib/harness/zipper'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const files = await db.select().from(harnessFiles).where(eq(harnessFiles.projectId, id))

  const zip = await createHarnessZip(files.map((f) => ({ path: f.filePath, content: f.content })))

  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="harness.zip"`,
    },
  })
}
```

- [ ] **Step 3: 대시보드에 다운로드 버튼 추가**

`app/(app)/projects/[id]/page.tsx`의 버튼 영역에 추가:
```typescript
// 기존 Link 버튼들 옆에 추가
<a href={`/api/projects/${id}/download`}>
  <Button variant="outline">📥 다운로드</Button>
</a>
```

- [ ] **Step 4: 커밋**

```bash
git add lib/harness/zipper.ts app/api/projects/[id]/download/
git commit -m "feat: add harness zip download"
```

---

## Task 12: E2E 검증 + .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 민감 파일 추가**

`.gitignore`에 추가:
```
.env.local
.env*.local
.superpowers/
drizzle/
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
npm test
```

Expected: PASS (parser.test.ts, analyzer.test.ts)

- [ ] **Step 3: 로컬 개발 서버 실행 확인**

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속 → sign-in 페이지로 리다이렉트 확인

- [ ] **Step 4: 수동 플로우 검증**

1. GitHub 계정으로 로그인
2. "새 프로젝트" → CLAUDE.md 파일 업로드
3. 프로젝트 대시보드 → AI 분석 점수 표시 확인
4. 추천 카드 표시 확인
5. 편집기 → CLAUDE.md 수정 → 저장
6. 다운로드 버튼 → zip 다운로드 확인

- [ ] **Step 5: 최종 커밋**

```bash
git add .gitignore
git commit -m "chore: add .gitignore and verify E2E flow"
```

---

## 로컬 개발 체크리스트

```bash
# 1. Clerk 앱 생성 (clerk.com) → GitHub OAuth 활성화 → 키 복사
# 2. Neon 프로젝트 생성 (neon.tech) → DATABASE_URL 복사
# 3. .env.local 채우기
# 4. Anthropic API 키 설정 (claude.ai → API Keys)
# 5. 마이그레이션 실행
npx drizzle-kit migrate
# 6. 개발 서버 실행
npm run dev
```

## Phase 2 준비 (MVP 이후)

- `app/api/projects/[id]/analyze/route.ts` — 스트리밍 분석 엔드포인트 (useChat 연동)
- `actions/analysis.ts` `applyRecommendation` — CLAUDE.md에 action 내용 정확히 삽입하는 로직 강화
- Notion / Slack OAuth 연동
- GitHub 레포 직접 연결 (GitHub App)
- 팀 협업 (Clerk Organizations)
