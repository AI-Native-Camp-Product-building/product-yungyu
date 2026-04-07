'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, SignOutButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { SyncButton } from '@/components/sync-button'

interface Project {
  id: string
  name: string
  score: number | null
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/40">—</span>
  const color = score >= 71 ? 'text-emerald-400' : score >= 41 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-xs font-mono font-semibold ${color}`}>{score}</span>
}

export function AppSidebar({ projects }: { projects: Project[] }) {
  const pathname = usePathname()

  return (
    <div className="w-48 h-screen bg-black border-r border-border flex flex-col py-4 shrink-0">
      <div className="px-4 mb-4">
        <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">Harness Coach</span>
      </div>
      <div className="px-4 mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Projects</span>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className={cn(
              'flex items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              pathname.startsWith(`/projects/${p.id}`) && 'text-primary bg-primary/10 border-l-2 border-primary'
            )}
          >
            <span className="truncate">{p.name}</span>
            <ScoreBadge score={p.score} />
          </Link>
        ))}
        <Link
          href="/projects/new"
          className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          + 새 프로젝트
        </Link>
      </nav>
      <div className="px-2 pb-2 border-t border-border pt-2">
        <SyncButton />
      </div>
      <div className="px-4 pb-4 flex items-center gap-2">
        <UserButton />
        <SignOutButton redirectUrl="/sign-in">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            로그아웃
          </button>
        </SignOutButton>
      </div>
    </div>
  )
}
