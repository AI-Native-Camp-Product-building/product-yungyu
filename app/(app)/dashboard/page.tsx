export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const { userId: clerkId } = await auth()

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId!)).limit(1)
  const userProjects = user
    ? await db.select().from(projects).where(eq(projects.userId, user.id))
    : []

  if (userProjects.length === 1) redirect(`/projects/${userProjects[0].id}`)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-2">대시보드</h1>
      <p className="text-muted-foreground mb-8">Claude Code 하네스를 관리하고 개선하세요.</p>
      {userProjects.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">연결된 프로젝트가 없습니다.</p>
          <Link href="/projects/new">
            <Button>첫 프로젝트 연결하기</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block border border-border rounded-lg p-4 hover:border-primary transition-colors">
              <h3 className="font-medium">{p.name}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
