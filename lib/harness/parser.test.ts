import { describe, it, expect } from 'vitest'
import { parseHarnessFromMap, hashContent, hashFiles, getAllFiles } from './parser'

describe('parseHarnessFromMap', () => {
  it('CLAUDE.md를 올바르게 파싱한다', () => {
    const files = new Map([['CLAUDE.md', '# Project rules']])
    const result = parseHarnessFromMap(files)
    expect(result.claudeMd).not.toBeNull()
    expect(result.claudeMd?.path).toBe('CLAUDE.md')
    expect(result.claudeMd?.content).toBe('# Project rules')
  })

  it('skills/ 파일들을 파싱한다', () => {
    const files = new Map([
      ['skills/coding.md', '# Coding skill'],
      ['skills/review.md', '# Review skill'],
    ])
    const result = parseHarnessFromMap(files)
    expect(result.skills).toHaveLength(2)
    expect(result.skills[0].path).toBe('skills/coding.md')
  })

  it('hooks/ 파일들을 파싱한다', () => {
    const files = new Map([['hooks/pre-commit.sh', '#!/bin/bash']])
    const result = parseHarnessFromMap(files)
    expect(result.hooks).toHaveLength(1)
  })

  it('.claude/settings.json을 파싱한다', () => {
    const files = new Map([['.claude/settings.json', '{}']])
    const result = parseHarnessFromMap(files)
    expect(result.settings).not.toBeNull()
  })

  it('.claude/skills/ 경로의 파일을 파싱한다', () => {
    const files = new Map([['.claude/skills/coding.md', '# Coding skill']])
    const result = parseHarnessFromMap(files)
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].path).toBe('.claude/skills/coding.md')
  })

  it('.claude/hooks/ 경로의 파일을 파싱한다', () => {
    const files = new Map([['.claude/hooks/pre-commit.sh', '#!/bin/bash']])
    const result = parseHarnessFromMap(files)
    expect(result.hooks).toHaveLength(1)
  })

  it('아무 파일도 없으면 빈 결과를 반환한다', () => {
    const result = parseHarnessFromMap(new Map())
    expect(result.claudeMd).toBeNull()
    expect(result.skills).toHaveLength(0)
    expect(result.hooks).toHaveLength(0)
    expect(result.settings).toBeNull()
  })
})

describe('hashContent', () => {
  it('같은 콘텐츠는 같은 hash를 반환한다', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'))
  })

  it('다른 콘텐츠는 다른 hash를 반환한다', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'))
  })

  it('16자 hex 문자열을 반환한다', () => {
    expect(hashContent('test')).toMatch(/^[a-f0-9]{16}$/)
  })
})

describe('hashFiles', () => {
  it('파일 목록의 통합 hash를 생성한다', () => {
    const files = [
      { path: 'CLAUDE.md', content: 'rules', hash: hashContent('rules') },
    ]
    const h = hashFiles(files)
    expect(h).toMatch(/^[a-f0-9]{16}$/)
  })

  it('파일 순서가 달라도 같은 hash를 반환한다', () => {
    const a = { path: 'a.md', content: 'a', hash: hashContent('a') }
    const b = { path: 'b.md', content: 'b', hash: hashContent('b') }
    expect(hashFiles([a, b])).toBe(hashFiles([b, a]))
  })

  it('빈 배열에 대해 hex 문자열을 반환한다', () => {
    expect(hashFiles([])).toMatch(/^[a-f0-9]{16}$/)
  })
})

describe('getAllFiles', () => {
  it('모든 파일을 평탄하게 반환한다', () => {
    const files = new Map([
      ['CLAUDE.md', 'rules'],
      ['skills/coding.md', 'code'],
    ])
    const harness = parseHarnessFromMap(files)
    const allFiles = getAllFiles(harness)
    expect(allFiles).toHaveLength(2)
    expect(allFiles.every(f => f !== null)).toBe(true)
  })
})
