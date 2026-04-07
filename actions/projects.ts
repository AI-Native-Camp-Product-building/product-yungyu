'use server'

import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { auth, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'

async function getOrCreateUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''

  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
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
