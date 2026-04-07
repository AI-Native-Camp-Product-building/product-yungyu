import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { harnessFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClaudeMdEditor } from '@/components/claude-md-editor'
import { SkillsManager } from '@/components/skills-manager'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const files = await db.select().from(harnessFiles).where(eq(harnessFiles.projectId, id))
  const claudeMd = files.find((f) => f.filePath === 'CLAUDE.md')
  const skills = files.filter((f) => f.filePath.startsWith('skills/') || f.filePath.startsWith('.claude/skills/'))

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">하네스 편집기</h1>
      </div>
      <Tabs defaultValue="claude-md" className="flex-1 flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="claude-md">CLAUDE.md</TabsTrigger>
          <TabsTrigger value="skills">Skills ({skills.length})</TabsTrigger>
          <TabsTrigger value="hooks" disabled>Hooks (읽기 전용)</TabsTrigger>
          <TabsTrigger value="mcp" disabled>MCP (읽기 전용)</TabsTrigger>
        </TabsList>
        <TabsContent value="claude-md" className="flex-1">
          {claudeMd ? (
            <ClaudeMdEditor fileId={claudeMd.id} initialContent={claudeMd.content} />
          ) : (
            <p className="text-muted-foreground">CLAUDE.md 파일이 없습니다.</p>
          )}
        </TabsContent>
        <TabsContent value="skills" className="flex-1">
          <SkillsManager skills={skills} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
