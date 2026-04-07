import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, harnessFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getOrRunAnalysis } from '@/actions/analysis'
import { HarnessScoreCard } from '@/components/harness-score-card'
import { RecommendationCard } from '@/components/recommendation-card'
import { HarnessScriptPanel } from '@/components/harness-script-panel'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const HARNESS_COMPONENTS = [
  {
    file: 'CLAUDE.md',
    label: '컨텍스트 파일',
    score: '컨텍스트 점수 +40',
    description: 'AI에게 프로젝트를 설명하는 핵심 파일입니다. 프로젝트 개요, 기술 스택, 코딩 규칙, 절대 하면 안 되는 것들을 담습니다.',
    example: '## 프로젝트 개요\n## 기술 스택\n## 절대 하면 안 되는 것',
  },
  {
    file: '.claude/settings.json',
    label: '자동화 설정',
    score: '자동강제 점수 +30',
    description: 'Hooks를 설정해 특정 툴 호출 전후에 자동으로 동작을 실행합니다. 테스트 자동 실행, 린트 체크 등에 활용합니다.',
    example: '{ "hooks": { "PostToolUse": [...] } }',
  },
  {
    file: 'skills/',
    label: '슬래시 커맨드',
    score: '가비지컬렉션 점수 +30',
    description: '/commit, /review 같은 커스텀 커맨드를 만들어 반복 작업을 자동화합니다. 팀 공통 워크플로우를 코드화할 수 있습니다.',
    example: 'skills/commit.md\nskills/review.md',
  },
]

function HarnessStarterGuide({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <div className="border border-dashed border-border rounded-lg p-6">
        <p className="text-sm font-medium mb-1">하네스 파일이 없습니다</p>
        <p className="text-sm text-muted-foreground">
          아래 파일들을 레포에 추가하면 AI가 진단하고 점수를 매깁니다. 편집기에서 바로 만들 수도 있습니다.
        </p>
        <Link href={`/projects/${projectId}/editor`} className="inline-block mt-3">
          <Button size="sm">편집기에서 시작하기</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {HARNESS_COMPONENTS.map((item) => (
          <div key={item.file} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{item.file}</code>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-xs text-primary">{item.score}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
            <pre className="text-xs bg-muted/50 rounded p-2 font-mono text-muted-foreground">{item.example}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

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
        <Link href={`/projects/${id}/editor`}><Button variant="outline">편집기</Button></Link>
      </div>

      {!analysis ? (
        <HarnessStarterGuide projectId={id} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

          {analysis.recommendations.length > 0 && (
            <HarnessScriptPanel recommendations={analysis.recommendations} />
          )}
        </>
      )}
    </div>
  )
}
