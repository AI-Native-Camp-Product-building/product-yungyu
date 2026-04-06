export const dynamic = 'force-dynamic'

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
