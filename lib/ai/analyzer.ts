import { generateText } from 'ai'
import type { Recommendation } from '@/lib/db/schema'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AnalysisResult {
  scores: { context: number; enforcement: number; gc: number }
  recommendations: Recommendation[]
  tokenUsage: TokenUsage | null
}

export interface ImprovedFile {
  path: string
  content: string
  change_summary: string
}

export interface ImprovementResult {
  summary: string
  improved_files: ImprovedFile[]
}

export function buildAnalysisPrompt(fileContents: string): string {
  return `You are a harness engineering expert for Claude Code. Analyze ALL provided files and return ONLY a JSON object.

Required JSON structure:
{
  "scores": {
    "context": <number 0-100>,
    "enforcement": <number 0-100>,
    "gc": <number 0-100>
  },
  "recommendations": [
    {
      "priority": "urgent" | "high" | "medium",
      "category": "context" | "enforcement" | "gc",
      "title": "<concise title in Korean>",
      "description": "<what the problem is, in Korean>",
      "action": "<executable prompt in Korean — see format rules below>"
    }
  ]
}

## Action Field Format Rules

The "action" field must be a complete, executable prompt that a Claude Code AI agent can run without ambiguity.
It MUST follow this exact structure:

---
## ⚠️ 중요: 문서 수정이 아니라 실제 명령어를 실행해야 합니다

아래 작업을 순서대로 실행해줘. 각 단계가 끝나면 반드시 검증 명령어로 확인해.

### 1단계: [작업명]
[shell]
[실제 실행할 쉘 명령어]
[/shell]

### 2단계: [파일 생성/수정]
파일 경로: [정확한 파일 경로]
[파일 내용 전체를 제공]

### 검증 (반드시 실행)
[shell]
[파일 존재 확인 명령어 — ls, cat 등]
[/shell]

### 완료 조건 체크리스트
- [ ] [구체적인 파일이 존재함]
- [ ] [설정값이 반영됨]
- [ ] git add [파일] && git commit -m "[커밋 메시지]" && git push
---

Rules for writing the action:
- ALWAYS include actual shell commands (npm install, npx, mkdir, etc.), never just describe them
- ALWAYS include the exact file content to create, not just "add this config"
- ALWAYS include verification commands (ls, cat, grep) after each step
- ALWAYS end with git add + commit + push commands
- NEVER write "CLAUDE.md에 다음을 추가하세요" as the only action — that is documentation, not enforcement
- If the fix requires creating a new file, provide the COMPLETE file content

## Scoring Rubric

### context (0–100): How well is the project documented for AI?
- 0–30: No CLAUDE.md, no skills
- 31–55: CLAUDE.md exists but sparse (missing stack, rules, or examples)
- 56–75: CLAUDE.md has project overview, tech stack, and some rules; some skills
- 76–100: CLAUDE.md is comprehensive (overview, stack, strict rules, anti-patterns, function specs); rich skills library

### enforcement (0–100): How strongly are quality standards automated?
Score each signal present and sum:
- CLAUDE.md has explicit coding rules (+10)
- .claude/settings.json or settings.json has hooks defined (+20)
- .claude/hooks/ or hooks/ directory has hook scripts (+15)
- .husky/ pre-commit hook exists (+15)
- package.json has lint-staged configured (+10)
- CI/CD workflow (.github/workflows/) runs lint+test (+15)
- vitest.config / jest.config has coverage thresholds enforced (+15)
Cap at 100.

### gc (0–100): How well is automated cleanup configured?
Score each signal present and sum:
- vercel.json has crons defined (+25)
- .github/workflows/ has scheduled cleanup job (+25)
- Makefile or scripts have cleanup targets (+15)
- CLAUDE.md documents cleanup procedures (+15)
- .claude/hooks/ has post-session cleanup hooks (+20)
Cap at 100.

## Recommendation rules
- Only recommend what is MISSING or WEAK based on the files provided
- Each action must name the exact file to create or modify
- Return 2–5 recommendations, most impactful first
- Return ONLY the JSON, no other text

HARNESS FILES:
${fileContents}`
}

export function parseAnalysisResponse(raw: string, tokenUsage: TokenUsage | null = null): AnalysisResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
  return {
    scores: {
      context: clamp(parsed.scores?.context ?? 0),
      enforcement: clamp(parsed.scores?.enforcement ?? 0),
      gc: clamp(parsed.scores?.gc ?? 0),
    },
    recommendations: (parsed.recommendations ?? []).map((r: Recommendation) => ({
      priority: r.priority,
      category: r.category,
      title: r.title,
      description: r.description,
      action: r.action,
    })),
    tokenUsage,
  }
}

export function buildImprovementPrompt(
  files: { path: string; content: string }[],
  recommendations: Recommendation[]
): string {
  const fileContents = files.map((f) => `### ${f.path}\n${f.content}`).join('\n\n---\n\n')
  const recList = recommendations
    .map((r, i) => `${i}. [${r.priority.toUpperCase()}] ${r.title}: ${r.description}`)
    .join('\n')

  return `You are a harness engineering expert. Apply the following recommendations to the provided harness files.

## Recommendations to Apply
${recList}

## Current Files
${fileContents}

Return ONLY a JSON object with this structure:
{
  "summary": "<brief summary of all changes made in Korean>",
  "improved_files": [
    {
      "path": "<exact file path>",
      "content": "<complete new file content>",
      "change_summary": "<one-line description of what changed in Korean>"
    }
  ]
}

Rules:
- Only include files that were actually modified
- Provide the COMPLETE new content for each modified file (not diffs)
- If a recommendation requires creating a new file, include it with its full content
- Return ONLY the JSON, no other text`
}

export function parseImprovementResponse(raw: string): ImprovementResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    summary: parsed.summary ?? '',
    improved_files: (parsed.improved_files ?? []).map((f: ImprovedFile) => ({
      path: f.path,
      content: f.content,
      change_summary: f.change_summary,
    })),
  }
}

/* c8 ignore start */
export async function analyzeHarness(fileContents: string): Promise<AnalysisResult> {
  const { text, usage } = await generateText({
    // Routed via Vercel AI Gateway (OIDC). vercel env pull provisions the token.
    model: 'anthropic/claude-haiku-4.5' as Parameters<typeof generateText>[0]['model'],
    prompt: buildAnalysisPrompt(fileContents),
  })

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const tokenUsage: TokenUsage = {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
  }

  // 비용 추정 로깅 (claude-haiku-4.5: input $0.80/1M, output $4.00/1M)
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * 0.8 +
    (outputTokens / 1_000_000) * 4.0
  console.log(`[AI] tokens=${tokenUsage.totalTokens}, est_cost=$${estimatedCostUsd.toFixed(5)}`)

  return parseAnalysisResponse(text, tokenUsage)
}
/* c8 ignore end */
