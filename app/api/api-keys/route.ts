import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { apiKeys, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

async function getUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1)
  if (existing) return existing.id

  const { currentUser } = await import('@clerk/nextjs/server')
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
  await db.insert(users).values({ clerkId, email }).onConflictDoNothing()
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1)
  return row?.id ?? null
}

export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await db
      .select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(apiKeys.createdAt)

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.keyPrefix,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    })))
  } catch (err) {
    console.error('[api-keys GET]', err)
    return NextResponse.json({ error: '키 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { name?: string }
    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: '키 이름을 입력하세요.' }, { status: 400 })

    const raw = `hc_live_${randomBytes(24).toString('hex')}`
    const keyHash = createHash('sha256').update(raw).digest('hex')
    const keyPrefix = raw.slice(0, 16) + '...'

    const [created] = await db
      .insert(apiKeys)
      .values({ userId, name, keyHash, keyPrefix })
      .returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, createdAt: apiKeys.createdAt })

    return NextResponse.json({
      key: raw,
      record: {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        lastUsedAt: null,
        createdAt: new Date(created.createdAt).toISOString(),
      },
    })
  } catch (err) {
    console.error('[api-keys POST]', err)
    return NextResponse.json({ error: 'API Key 생성에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { id?: string }
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await db.delete(apiKeys).where(and(eq(apiKeys.id, body.id), eq(apiKeys.userId, userId)))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api-keys DELETE]', err)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
