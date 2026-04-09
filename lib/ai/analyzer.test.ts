import { describe, it, expect } from 'vitest'
import { buildAnalysisPrompt, parseAnalysisResponse, buildImprovementPrompt, parseImprovementResponse } from './analyzer'

describe('buildAnalysisPrompt', () => {
  it('파일 내용을 포함한 프롬프트를 생성한다', () => {
    const prompt = buildAnalysisPrompt('### CLAUDE.md\n# Rules')
    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('context')
    expect(prompt).toContain('enforcement')
    expect(prompt).toContain('gc')
  })
})

describe('parseAnalysisResponse', () => {
  it('유효한 JSON 응답을 파싱한다', () => {
    const raw = JSON.stringify({
      scores: { context: 80, enforcement: 50, gc: 30 },
      recommendations: [
        {
          priority: 'high',
          category: 'enforcement',
          title: 'TypeScript hook 추가',
          description: '타입 검사 hook이 없습니다.',
          action: 'pre-commit hook에 tsc --noEmit 추가',
        },
      ],
    })
    const result = parseAnalysisResponse(raw)
    expect(result.scores.context).toBe(80)
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].priority).toBe('high')
  })

  it('잘못된 JSON이면 에러를 던진다', () => {
    expect(() => parseAnalysisResponse('not json')).toThrow(SyntaxError)
  })

  it('점수가 0-100 범위를 벗어나면 클램핑한다', () => {
    const raw = JSON.stringify({
      scores: { context: 150, enforcement: -10, gc: 50 },
      recommendations: [],
    })
    const result = parseAnalysisResponse(raw)
    expect(result.scores.context).toBe(100)
    expect(result.scores.enforcement).toBe(0)
  })
})

describe('buildImprovementPrompt', () => {
  it('includes recommendation titles in prompt', () => {
    const files = [{ path: 'CLAUDE.md', content: '# Project' }]
    const recs = [{ priority: 'urgent' as const, category: 'context' as const, title: '기술 스택 추가', description: '스택 정보 없음', action: '' }]
    const prompt = buildImprovementPrompt(files, recs)
    expect(prompt).toContain('기술 스택 추가')
    expect(prompt).toContain('CLAUDE.md')
    expect(prompt).toContain('# Project')
  })

  it('includes all file contents separated by ---', () => {
    const files = [
      { path: 'CLAUDE.md', content: '# A' },
      { path: 'skills/foo.md', content: '# B' },
    ]
    const prompt = buildImprovementPrompt(files, [])
    expect(prompt).toContain('---')
    expect(prompt).toContain('# A')
    expect(prompt).toContain('# B')
  })
})

describe('parseImprovementResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      summary: '개선 완료',
      improved_files: [{ path: 'CLAUDE.md', content: '# Updated', change_summary: '기술 스택 추가' }],
    })
    const result = parseImprovementResponse(raw)
    expect(result.summary).toBe('개선 완료')
    expect(result.improved_files).toHaveLength(1)
    expect(result.improved_files[0].path).toBe('CLAUDE.md')
    expect(result.improved_files[0].content).toBe('# Updated')
    expect(result.improved_files[0].change_summary).toBe('기술 스택 추가')
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"summary":"test","improved_files":[]}\n```'
    const result = parseImprovementResponse(raw)
    expect(result.summary).toBe('test')
    expect(result.improved_files).toHaveLength(0)
  })

  it('throws SyntaxError on invalid JSON', () => {
    expect(() => parseImprovementResponse('not json')).toThrow(SyntaxError)
  })

  it('returns empty improved_files when key is missing', () => {
    const raw = JSON.stringify({ summary: 'ok' })
    const result = parseImprovementResponse(raw)
    expect(result.improved_files).toEqual([])
  })
})
