'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ApiKey = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? 'API Key 생성에 실패했습니다.')
        }
        const data = await res.json() as { key: string; record: ApiKey }
        setNewKey(data.key)
        setKeys((prev) => [...prev, data.record])
        setName('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'API Key 생성에 실패했습니다.')
      }
    })
  }

  function handleRevoke(keyId: string) {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/api-keys', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: keyId }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? '삭제에 실패했습니다.')
        }
        setKeys((prev) => prev.filter((k) => k.id !== keyId))
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          MCP 서버 연결에 사용합니다. 키는 생성 시 한 번만 표시됩니다.
        </p>
      </div>

      {/* 새 키 생성 */}
      <div className="flex gap-2">
        <Input
          placeholder="키 이름 (예: my-claude-code)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={isPending || !name.trim()} size="sm">
          생성
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 새로 생성된 키 표시 */}
      {newKey && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-400">이 키는 지금만 표시됩니다. 복사해두세요.</p>
          <code className="block text-xs font-mono break-all select-all text-foreground">{newKey}</code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(null) }}>
            복사 후 닫기
          </Button>
        </div>
      )}

      {/* MCP 연결 방법 */}
      {keys.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium">Claude Code 연결 방법</p>
          <p className="text-xs text-muted-foreground">
            <code>~/.claude/settings.json</code>에 추가:
          </p>
          <pre className="text-xs font-mono bg-background rounded p-3 overflow-x-auto">{`{
  "mcpServers": {
    "harness-coach": {
      "url": "${typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}/api/mcp",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}`}</pre>
          <p className="text-xs text-muted-foreground mt-2">
            연결 후: <code className="bg-background px-1 rounded">&quot;내 하네스 진단해줘&quot;</code> 또는{' '}
            <code className="bg-background px-1 rounded">&quot;내 하네스 개선해줘&quot;</code>
          </p>
        </div>
      )}

      {/* 키 목록 */}
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 API Key가 없습니다.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}</p>
                <p className="text-xs text-muted-foreground">
                  {k.lastUsedAt ? `마지막 사용: ${new Date(k.lastUsedAt).toLocaleDateString('ko')}` : '미사용'}
                  {' · '}생성: {new Date(k.createdAt).toLocaleDateString('ko')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleRevoke(k.id)}
                disabled={isPending}
              >
                삭제
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
