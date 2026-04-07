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
      "action": "<specific actionable instruction in Korean — must reference actual files like .claude/settings.json, .husky/pre-commit, vercel.json, CLAUDE.md, skills/ etc.>"
    }
  ]
}

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
