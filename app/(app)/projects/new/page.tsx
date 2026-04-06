'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProject } from '@/actions/projects'
import { saveHarnessFiles } from '@/actions/harness'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [files, setFiles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files
    if (!uploaded) return
    const result: Record<string, string> = {}
    for (const file of Array.from(uploaded)) {
      result[file.name] = await file.text()
    }
    setFiles(result)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || Object.keys(files).length === 0) return
    setLoading(true)
    try {
      const project = await createProject(name)
      await saveHarnessFiles(project.id, files)
      router.push(`/projects/${project.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">새 프로젝트</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="name">프로젝트 이름</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="files">하네스 파일 업로드</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">CLAUDE.md, skills/, hooks/, .claude/settings.json 파일을 선택하세요.</p>
          <Input id="files" type="file" multiple onChange={handleFileChange} className="mt-1" />
          {Object.keys(files).length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">{Object.keys(files).length}개 파일 선택됨: {Object.keys(files).join(', ')}</p>
          )}
        </div>
        <Button type="submit" disabled={loading || !name || Object.keys(files).length === 0}>
          {loading ? '생성 중...' : '프로젝트 생성'}
        </Button>
      </form>
    </div>
  )
}
