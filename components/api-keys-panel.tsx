'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy, Terminal, RotateCcw, Plug } from 'lucide-react'

type ApiKey = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

function McpCommand({ apiKey }: { apiKey: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://harness-manager.vercel.app'
  const command = `claude mcp add --transport http --scope user harness-coach ${origin}/api/mcp --header "Authorization: Bearer ${apiKey}"`
  return (
    <div className="relative rounded-md bg-zinc-950 border border-zinc-800 p-3 pr-20">
      <code className="text-xs font-mono text-zinc-200 break-all leading-relaxed">{command}</code>
      <div className="absolute top-3 right-3">
        <CopyButton text={command} />
      </div>
    </div>
  )
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
    setNewKey(null)
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
        if (newKey) setNewKey(null)
        setKeys((prev) => prev.filter((k) => k.id !== keyId))
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-semibold mb-1">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Claude Code에서 하네스 진단·개선을 바로 요청할 수 있습니다. 키는 생성 시 한 번만 표시됩니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          ⚠ 현재 <span className="text-foreground font-medium">public 레포</span>만 지원합니다. Private 레포는 Claude Code를 해당 프로젝트 디렉토리에서 실행하는 경우에만 로컬 파일로 진단 가능합니다. (GitHub OAuth 연동은 추후 지원 예정)
        </p>
      </div>

      {/* 새 키 생성 후 — 단계별 안내 */}
      {newKey && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-5 space-y-5">
          <p className="text-sm font-semibold text-green-400">✅ API 키가 생성됐습니다. 아래 순서대로 진행하세요.</p>

          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-bold text-zinc-300">1</span>
              <span className="text-sm font-medium">터미널에서 아래 명령어를 실행하세요</span>
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <McpCommand apiKey={newKey} />
            <p className="text-xs text-muted-foreground pl-7">API 키가 자동으로 채워져 있습니다.</p>
          </div>

          {/* Step 2 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-bold text-zinc-300">2</span>
              <span className="text-sm font-medium">Claude Code를 완전히 재시작하세요</span>
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground pl-7">앱을 완전히 종료한 뒤 다시 열어야 MCP 서버가 인식됩니다.</p>
          </div>

          {/* Step 3 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-bold text-zinc-300">3</span>
              <span className="text-sm font-medium">Claude Code에서 바로 사용하세요</span>
              <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              예: <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">&quot;내 하네스 진단해줘&quot;</code> — 현재 프로젝트 디렉토리에서 실행하면 GitHub 레포를 자동으로 감지합니다.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => setNewKey(null)} className="mt-1">
            닫기
          </Button>
        </div>
      )}

      {/* 새 키 생성 폼 */}
      <div className="space-y-2">
        <p className="text-sm font-medium">새 API 키 생성</p>
        <div className="flex gap-2">
          <Input
            placeholder="키 이름 (예: my-claude-code)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={isPending || !name.trim()} size="sm">
            {isPending ? '생성 중…' : '생성'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 기존에 키가 있고 새 키 팝업이 없을 때 — 축약 연결 가이드 */}
      {!newKey && keys.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium">Claude Code 연결 방법</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-none">
            <li><span className="font-mono text-foreground">1.</span> 새 API 키를 생성합니다.</li>
            <li><span className="font-mono text-foreground">2.</span> 터미널에서 제공되는 <code className="bg-background px-1 rounded">claude mcp add</code> 명령어를 실행합니다.</li>
            <li><span className="font-mono text-foreground">3.</span> Claude Code를 재시작합니다.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            연결 후 프로젝트 디렉토리에서 Claude Code를 열고 <code className="bg-background px-1 rounded">&quot;내 하네스 진단해줘&quot;</code>라고 입력하면 GitHub 레포를 자동 감지합니다.
          </p>
        </div>
      )}

      {/* 키 목록 */}
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 API Key가 없습니다.</p>
      ) : (
        <div>
          <p className="text-sm font-medium mb-2">발급된 키</p>
          <div className="divide-y divide-border rounded-md border">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.lastUsedAt
                      ? `마지막 사용: ${new Date(k.lastUsedAt).toLocaleDateString('ko')}`
                      : '미사용'}
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
        </div>
      )}
    </div>
  )
}
