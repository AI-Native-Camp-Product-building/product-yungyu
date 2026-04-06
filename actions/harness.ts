'use server'

import { db } from '@/lib/db'
import { harnessFiles } from '@/lib/db/schema'
import { parseHarnessFromMap, getAllFiles } from '@/lib/harness/parser'
import { eq } from 'drizzle-orm'

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
