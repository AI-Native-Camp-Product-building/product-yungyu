'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { syncAllProjects } from '@/actions/harness'
import { useRouter } from 'next/navigation'

export function SyncButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSync() {
    startTransition(async () => {
      await syncAllProjects()
      router.refresh()
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSync}
      disabled={isPending}
      className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? '동기화 중...' : 'GitHub 동기화'}
    </Button>
  )
}
