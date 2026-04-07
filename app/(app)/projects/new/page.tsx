import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { fetchUserGitHubRepos } from '@/actions/harness'
import { RepoSelector } from '@/components/repo-selector'

export default async function NewProjectPage() {
  const { userId: clerkId } = await auth()

  const [user] = clerkId
    ? await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1)
    : []

  const [repos, connectedProjects] = await Promise.all([
    fetchUserGitHubRepos(),
    user
      ? db.select({ githubRepoUrl: projects.githubRepoUrl }).from(projects).where(eq(projects.userId, user.id))
      : Promise.resolve([]),
  ])

  const connectedUrls = new Set(
    connectedProjects.map((p) => p.githubRepoUrl).filter(Boolean) as string[]
  )

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">새 프로젝트 연결</h1>
      <p className="text-muted-foreground mb-6">연결할 GitHub 레포지토리를 선택하세요.</p>
      <RepoSelector repos={repos} connectedUrls={connectedUrls} />
    </div>
  )
}
