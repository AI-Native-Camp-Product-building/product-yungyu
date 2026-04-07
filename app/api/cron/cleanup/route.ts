import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { harnessAnalyses, harnessFiles } from '@/lib/db/schema'
import { lt } from 'drizzle-orm'

// Vercel Cron: 매일 새벽 3시 실행 (vercel.json 설정)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30일 전

  const deletedAnalyses = await db
    .delete(harnessAnalyses)
    .where(lt(harnessAnalyses.createdAt, cutoff))
    .returning({ id: harnessAnalyses.id })

  const deletedFiles = await db
    .delete(harnessFiles)
    .where(lt(harnessFiles.lastSyncedAt, cutoff))
    .returning({ id: harnessFiles.id })

  return NextResponse.json({
    policy: '30d',
    cutoff,
    deleted: { analyses: deletedAnalyses.length, files: deletedFiles.length },
  })
}
