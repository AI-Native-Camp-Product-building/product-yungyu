'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import type { Recommendation } from '@/lib/db/schema'

const priorityLabel = { urgent: '긴급', high: '높음', medium: '보통' }
const categoryLabel = { context: '컨텍스트', enforcement: '자동강제', gc: '가비지컬렉션' }

function buildScript(recommendations: Recommendation[]): string {
  const items = recommendations
    .map((r, i) => {
      return [
        `## ${i + 1}. [${priorityLabel[r.priority]}/${categoryLabel[r.category]}] ${r.title}`,
        `- 문제: ${r.description}`,
        `- 액션: ${r.action}`,
      ].join('\n')
    })
    .join('\n\n')

  return `아래 하네스 개선 작업들을 우선순위 순서대로 실행해줘.
각 작업을 완료한 후 다음 작업으로 넘어가고, 모든 작업이 끝나면 변경 내용을 요약해줘.

${items}

작업 완료 후:
- 변경된 파일 목록과 주요 변경 사항을 요약해줘
- 추가로 개선할 부분이 있으면 제안해줘`
}

export function HarnessScriptPanel({ recommendations }: { recommendations: Recommendation[] }) {
  const [copied, setCopied] = useState(false)
  const script = buildScript(recommendations)

  async function handleCopy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Claude Code 명령 스크립트</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            아래 스크립트를 복사해 Claude Code에 붙여넣으면 AI가 추천 사항을 직접 적용합니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨' : '복사'}
        </Button>
      </div>
      <pre className="bg-[#111] border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
        {script}
      </pre>
    </div>
  )
}
