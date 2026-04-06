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

  return new NextResponse(Buffer.from(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="harness.zip"`,
    },
  })
}
