'use server'

import { createHash, randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { apiKeys, users } from '@/lib/db/schema'
import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'

async function getUserId(): Promise<string> {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1)
  if (existing) return existing.id

  const { currentUser } = await import('@clerk/nextjs/server')
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''
  await db.insert(users).values({ clerkId, email }).onConflictDoNothing()
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1)
  if (!row) throw new Error('사용자 레코드를 생성할 수 없습니다.')
  return row.id
}

export async function createApiKey(name: string): Promise<{ key: string; prefix: string }> {
  const userId = await getUserId()
  const raw = `hc_live_${randomBytes(24).toString('hex')}`
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const keyPrefix = raw.slice(0, 16) + '...'

  await db.insert(apiKeys).values({ userId, name, keyHash, keyPrefix })

  return { key: raw, prefix: keyPrefix }
}

export async function listApiKeys() {
  const userId = await getUserId()
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt)
}

export async function revokeApiKey(keyId: string) {
  const userId = await getUserId()
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
}
