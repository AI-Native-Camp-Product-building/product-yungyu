'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">페이지를 불러오지 못했습니다</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        {error.message || '알 수 없는 오류가 발생했습니다.'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">ERROR {error.digest}</p>
      )}
      <Button onClick={reset} variant="outline" size="sm">
        다시 시도
      </Button>
    </div>
  )
}
