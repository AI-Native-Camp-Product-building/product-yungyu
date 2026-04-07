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

  // 캐시 확인 — 파일 hash가 동일하면 재분석 안 함
  const cached = await db
    .select()
    .from(harnessAnalyses)
    .where(and(eq(harnessAnalyses.projectId, projectId), eq(harnessAnalyses.filesHash, filesHash)))
    .limit(1)

  if (cached.length > 0) return cached[0]

  // AI 분석 실행 (수동 트리거 시에만 호출됨)
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
      tokenUsage: result.tokenUsage,
    })
    .returning()

  return saved
}

export async function applyRecommendation(
  projectId: string,
  recommendation: { category: string; action: string; title?: string },
  fileId: string,
  currentContent: string
) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const appendedContent = `${currentContent}\n\n<!-- Harness Coach 추천 적용 -->\n<!-- ${recommendation.title ?? ''} -->\n${recommendation.action}`
  const { updateHarnessFile } = await import('@/actions/harness')
  return updateHarnessFile(fileId, appendedContent)
}
