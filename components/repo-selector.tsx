'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/actions/projects'
import { fetchGitHubHarnessFiles, saveHarnessFiles, type GitHubRepo } from '@/actions/harness'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type RepoState = 'idle' | 'loading' | 'done' | 'error'

export function RepoSelector({ repos, connectedUrls }: { repos: GitHubRepo[]; connectedUrls: Set<string> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [repoStates, setRepoStates] = useState<Record<string, RepoState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  function toggle(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) { next.delete(fullName) } else { next.add(fullName) }
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0) return
    setSubmitting(true)

    const targets = repos.filter((r) => selected.has(r.fullName))

    await Promise.all(
      targets.map(async (repo) => {
        setRepoStates((prev) => ({ ...prev, [repo.fullName]: 'loading' }))
        try {
          const fileMap = await fetchGitHubHarnessFiles(repo.htmlUrl)
          const project = await createProject(repo.name, repo.htmlUrl)
          await saveHarnessFiles(project.id, fileMap)
          setRepoStates((prev) => ({ ...prev, [repo.fullName]: 'done' }))
        } catch (e) {
          setRepoStates((prev) => ({ ...prev, [repo.fullName]: 'error' }))
          setErrors((prev) => ({ ...prev, [repo.fullName]: e instanceof Error ? e.message : '실패' }))
        }
      })
    )

    setSubmitting(false)
    router.push(targets.length === 1 ? '/dashboard' : '/dashboard')
    router.refresh()
  }

  if (repos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        GitHub 레포지토리를 찾을 수 없습니다. GitHub 계정으로 로그인했는지 확인하세요.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {repos.map((repo) => {
          const isConnected = connectedUrls.has(repo.htmlUrl)
          const isSelected = selected.has(repo.fullName)
          const state = repoStates[repo.fullName] ?? 'idle'

          return (
            <button
              key={repo.fullName}
              onClick={() => !isConnected && toggle(repo.fullName)}
              disabled={isConnected || submitting}
              className={[
                'w-full text-left border rounded-lg px-4 py-3 transition-colors',
                isConnected
                  ? 'border-border opacity-40 cursor-not-allowed'
                  : isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary hover:bg-muted/50',
                submitting && !isConnected ? 'cursor-not-allowed' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className={[
                  'w-4 h-4 rounded border shrink-0 flex items-center justify-center',
                  isConnected ? 'border-border' : isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                ].join(' ')}>
                  {isSelected && !isConnected && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{repo.name}</span>
                    {repo.private && <Badge variant="outline" className="text-xs shrink-0">Private</Badge>}
                    {isConnected && <Badge variant="secondary" className="text-xs shrink-0">연결됨</Badge>}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>
                  )}
                  {state === 'error' && (
                    <p className="text-xs text-destructive mt-0.5">{errors[repo.fullName]}</p>
                  )}
                </div>
                {state === 'loading' && <span className="text-xs text-muted-foreground shrink-0">연결 중...</span>}
                {state === 'done' && <span className="text-xs text-primary shrink-0">완료</span>}
              </div>
            </button>
          )
        })}
      </div>

      <Button
        onClick={handleCreate}
        disabled={selected.size === 0 || submitting}
        className="w-full"
      >
        {submitting ? '연결 중...' : selected.size > 0 ? `${selected.size}개 연결하기` : '레포지토리를 선택하세요'}
      </Button>
    </div>
  )
}
