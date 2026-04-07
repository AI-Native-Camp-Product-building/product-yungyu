export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, users, harnessAnalyses } from '@/lib/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { AppSidebar } from '@/components/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
  const userProjects = user
    ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.userId, user.id))
    : []

  const projectIds = userProjects.map(p => p.id)
  const analyses = projectIds.length > 0
    ? await db
        .select({ projectId: harnessAnalyses.projectId, scores: harnessAnalyses.scores })
        .from(harnessAnalyses)
        .where(inArray(harnessAnalyses.projectId, projectIds))
        .orderBy(desc(harnessAnalyses.createdAt))
    : []

  const latestScores = new Map<string, number>()
  for (const a of analyses) {
    if (!latestScores.has(a.projectId)) {
      const avg = Math.round((a.scores.context + a.scores.enforcement + a.scores.gc) / 3)
      latestScores.set(a.projectId, avg)
    }
  }

  const projectsWithScores = userProjects.map(p => ({
    ...p,
    score: latestScores.get(p.id) ?? null,
  }))

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar projects={projectsWithScores} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  )
}
