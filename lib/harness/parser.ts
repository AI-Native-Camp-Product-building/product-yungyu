import crypto from 'crypto'

export interface HarnessFile {
  path: string
  content: string
  hash: string
}

export interface ParsedHarness {
  claudeMd: HarnessFile | null
  skills: HarnessFile[]
  hooks: HarnessFile[]
  settings: HarnessFile | null
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function hashFiles(files: Pick<HarnessFile, 'hash'>[]): string {
  const combined = files.map((f) => f.hash).sort().join(',')
  return hashContent(combined)
}

export function parseHarnessFromMap(files: Map<string, string>): ParsedHarness {
  const result: ParsedHarness = { claudeMd: null, skills: [], hooks: [], settings: null }

  for (const [path, content] of files) {
    const hash = hashContent(content)
    const file: HarnessFile = { path, content, hash }

    if (path === 'CLAUDE.md' || path.endsWith('/CLAUDE.md')) {
      result.claudeMd = file
    } else if (path.startsWith('skills/') || path.startsWith('.claude/skills/') || path.includes('/.claude/skills/')) {
      result.skills.push(file)
    } else if (path.startsWith('hooks/') || path.startsWith('.claude/hooks/') || path.includes('/.claude/hooks/')) {
      result.hooks.push(file)
    } else if (path === '.claude/settings.json' || path === 'settings.json') {
      result.settings = file
    }
  }

  return result
}

export function getAllFiles(harness: ParsedHarness): HarnessFile[] {
  return [harness.claudeMd, ...harness.skills, ...harness.hooks, harness.settings].filter(
    (f): f is HarnessFile => f !== null
  )
}
