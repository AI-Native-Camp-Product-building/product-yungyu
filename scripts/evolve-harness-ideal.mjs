/**
 * evolve-harness-ideal.mjs
 *
 * 매주 수요일 실행. 두 가지 소스에서 인사이트를 수집하고
 * docs/harness-ideal.md의 Evolution Layer를 업데이트합니다.
 *
 * 소스 1: Hacker News (Algolia API)
 * 소스 2: Harness Coach 유저 피드백 (Neon DB)
 */

import { readFileSync, writeFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import Anthropic from '@anthropic-ai/sdk'

const IDEAL_PATH = process.env.IDEAL_PATH
  ?? new URL('../docs/harness-ideal.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const HN_KEYWORDS = [
  'claude code', 'CLAUDE.md', 'claude hooks',
  'llm agent harness', 'ai agent configuration', 'coding agent workflow',
]

// ── Hacker News 수집 ──────────────────────────────────────────────────────────

async function fetchHnPosts() {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  const results = []

  for (const kw of HN_KEYWORDS) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story&numericFilters=points>=50,created_at_i>${sevenDaysAgo}&hitsPerPage=5`
    const res = await fetch(url)
    const data = await res.json()
    for (const hit of data.hits ?? []) {
      if (!results.find(r => r.objectID === hit.objectID)) {
        results.push({
          id: hit.objectID,
          title: hit.title,
          url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          points: hit.points,
          keyword: kw,
        })
      }
    }
  }

  return results
}

// ── DB 피드백 수집 ────────────────────────────────────────────────────────────

async function fetchRecentFeedbacks(databaseUrl) {
  const sql = neon(databaseUrl)
  const rows = await sql`
    SELECT message, context, source, created_at
    FROM feedbacks
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 50
  `
  return rows
}

// ── Claude ACCEPT/REJECT 판단 ─────────────────────────────────────────────────

async function evaluateSources(anthropic, hnPosts, feedbacks, currentIdeal) {
  const hnSection = hnPosts.length === 0
    ? '(이번 주 수집된 HN 게시물 없음)'
    : hnPosts.map(p => `- [${p.points}pts] ${p.title}\n  URL: ${p.url}`).join('\n')

  const fbSection = feedbacks.length === 0
    ? '(이번 주 수집된 유저 피드백 없음)'
    : feedbacks.map(f => {
        const ctx = f.context ? ` [맥락: ${f.context}]` : ''
        return `- [${f.source}] ${f.message}${ctx}`
      }).join('\n')

  const prompt = `당신은 Claude Code 하네스 전문가입니다.
아래 두 소스에서 수집된 내용을 검토하고, harness-ideal.md에 반영할 가치가 있는 항목을 선별하세요.

## 현재 harness-ideal.md
${currentIdeal}

## 소스 1: Hacker News 게시물 (최근 7일, points ≥ 50)
${hnSection}

## 소스 2: Harness Coach 유저 피드백 (최근 7일)
${fbSection}

## 판단 기준

### ACCEPT 조건 (모두 충족해야 함):
- 구체적인 기법·설정 예시 또는 실제 사용자 경험 포함
- 3축(컨텍스트/자동강제/GC) 중 하나를 실질적으로 개선하는 내용
- harness-ideal.md에 아직 반영되지 않은 신규 인사이트

### REJECT 조건 (하나라도 해당하면):
- 의견/홍보성 내용, 검증 불가
- 이미 harness-ideal.md에 반영된 내용
- 특정 유료 도구에만 의존하는 내용
- 보안 위험이 있는 내용
- 단순 불만/칭찬 (구체적 개선점 없음)

## 출력 형식 (JSON만 출력, 다른 텍스트 없음):
{
  "accepted": [
    {
      "source": "hn | feedback",
      "summary": "한 줄 요약 (한국어)",
      "layer": "context | enforcement | gc",
      "change": "harness-ideal.md에 추가할 구체적 내용 (한국어, 1-3줄)",
      "reason": "수용 이유 (한국어)"
    }
  ],
  "rejected_count": 숫자,
  "no_change": true/false
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].text.trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude 응답에서 JSON을 찾을 수 없음')
  return JSON.parse(jsonMatch[0])
}

// ── harness-ideal.md 업데이트 ─────────────────────────────────────────────────

function updateIdealFile(currentContent, accepted) {
  if (accepted.length === 0) return null

  const today = new Date().toISOString().split('T')[0]
  const newEntries = accepted.map((item, i) => {
    const version = `v${today.replace(/-/g, '')}.${i + 1}`
    return `- [${version}] ${today} | ${item.source === 'hn' ? 'Hacker News' : '유저 피드백'} | ${item.layer} | ${item.summary}\n  → ${item.change}`
  }).join('\n')

  return currentContent.replace(
    /<!-- EVOLUTION_LOG_START -->([\s\S]*?)<!-- EVOLUTION_LOG_END -->/,
    `<!-- EVOLUTION_LOG_START -->\n${newEntries}\n$1<!-- EVOLUTION_LOG_END -->`
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!databaseUrl) throw new Error('DATABASE_URL 환경변수 필요')
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY 환경변수 필요')

  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const currentIdeal = readFileSync(IDEAL_PATH, 'utf-8')

  console.log('📡 HN 게시물 수집 중...')
  const hnPosts = await fetchHnPosts()
  console.log(`   → ${hnPosts.length}개 수집`)

  console.log('📝 유저 피드백 수집 중...')
  const feedbacks = await fetchRecentFeedbacks(databaseUrl)
  console.log(`   → ${feedbacks.length}개 수집`)

  if (hnPosts.length === 0 && feedbacks.length === 0) {
    console.log('ℹ️  소스 없음. 종료.')
    return
  }

  console.log('🤖 Claude ACCEPT/REJECT 판단 중...')
  const result = await evaluateSources(anthropic, hnPosts, feedbacks, currentIdeal)
  console.log(`   → ${result.accepted.length}개 수용, ${result.rejected_count}개 거부`)

  if (result.no_change || result.accepted.length === 0) {
    console.log('ℹ️  수용된 항목 없음. harness-ideal.md 변경 없음.')
    return
  }

  const updated = updateIdealFile(currentIdeal, result.accepted)
  if (!updated) return

  writeFileSync(IDEAL_PATH, updated, 'utf-8')
  console.log('✅ harness-ideal.md 업데이트 완료')
  result.accepted.forEach(a => console.log(`   + [${a.layer}] ${a.summary}`))
}

main().catch(err => {
  console.error('❌ 오류:', err.message)
  process.exit(1)
})
