'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
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
              'block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              pathname.startsWith(`/projects/${p.id}`) && 'text-primary bg-primary/10 border-l-2 border-primary'
            )}
          >
            {p.name}
          </Link>
        ))}
        <Link
          href="/projects/new"
          className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          + 새 프로젝트
        </Link>
      </nav>
      <div className="px-4 pt-4 border-t border-border">
        <UserButton />
      </div>
    </div>
  )
}
