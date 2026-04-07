import { generateText } from 'ai'
import type { Recommendation } from '@/lib/db/schema'

export interface AnalysisResult {
  scores: { context: number; enforcement: number; gc: number }
  recommendations: Recommendation[]
}

export function buildAnalysisPrompt(fileContents: string): string {
  return `You are a harness engineering expert for Claude Code. Analyze the harness files and return ONLY a JSON object.

Required JSON structure:
{
  "scores": {
    "context": <number 0-100: CLAUDE.md and skills coverage>,
    "enforcement": <number 0-100: hooks and automatic enforcement strength>,
    "gc": <number 0-100: garbage collection and cleanup mechanisms>
  },
  "recommendations": [
    {
      "priority": "urgent" | "high" | "medium",
      "category": "context" | "enforcement" | "gc",
      "title": "<concise title in Korean>",
      "description": "<what the problem is, in Korean>",
      "action": "<specific action to take, in Korean>"
    }
  ]
}

Scoring guide:
- context 0-40: No CLAUDE.md; 41-70: Sparse CLAUDE.md; 71-100: Comprehensive with rules and examples
- enforcement 0-40: No hooks; 41-70: Some hooks; 71-100: Pre-commit hooks with type check, lint, test
- gc 0-40: No cleanup; 41-70: Partial cleanup; 71-100: Automated cleanup agent

Return 2-5 recommendations maximum. Return ONLY the JSON, no other text.

HARNESS FILES:
${fileContents}`
}

export function parseAnalysisResponse(raw: string): AnalysisResult {
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
  }
}

export async function analyzeHarness(fileContents: string): Promise<AnalysisResult> {
  const { text } = await generateText({
    // Routed via Vercel AI Gateway (OIDC). vercel env pull provisions the token.
    model: 'anthropic/claude-haiku-4.5' as Parameters<typeof generateText>[0]['model'],
    prompt: buildAnalysisPrompt(fileContents),
  })
  return parseAnalysisResponse(text)
}
