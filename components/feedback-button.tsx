'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('https://formspree.io/f/mgopdlwg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (res.ok) {
        setStatus('done')
        setMessage('')
        setTimeout(() => {
          setOpen(false)
          setStatus('idle')
        }, 1500)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full text-left px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        피드백 보내기
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>피드백</DialogTitle>
        </DialogHeader>
        {status === 'done' ? (
          <p className="text-sm text-emerald-400 py-4 text-center">피드백이 전송됐어요. 감사합니다!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
            <Textarea
              placeholder="자유롭게 의견을 남겨주세요"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={status === 'sending'}
            />
            {status === 'error' && (
              <p className="text-xs text-red-400">전송 실패. 다시 시도해주세요.</p>
            )}
            <Button type="submit" disabled={status === 'sending' || !message.trim()}>
              {status === 'sending' ? '전송 중...' : '제출'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
