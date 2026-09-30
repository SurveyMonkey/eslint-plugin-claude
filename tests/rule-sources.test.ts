// The map in docs/rule-sources.json ties each rule to the docs blocks that
// source it. Layer 2 of the docs watch reads it. A rule with no entry is a
// rule that the watch cannot see.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts/seed-rule-sources.mjs')
const DOCS_PREFIX = 'https://code.claude.com/docs/'

type Source = { url?: unknown; heading?: unknown; hash?: unknown }
type SourceMap = Record<string, Source[]>

const ruleNames = (root: string) =>
  readdirSync(path.join(root, 'src/rules'))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.slice(0, -'.ts'.length))
    .sort()

// Returns one message for each fault. An empty list means the map is valid.
function check(map: SourceMap, rules: string[]): string[] {
  const faults: string[] = []
  for (const rule of rules) {
    if (!(rule in map)) faults.push(`${rule}: no entry`)
  }
  for (const [rule, sources] of Object.entries(map)) {
    if (!rules.includes(rule)) faults.push(`${rule}: no rule file`)
    if (!Array.isArray(sources) || sources.length === 0) {
      faults.push(`${rule}: no source`)
      continue
    }
    for (const source of sources) {
      if (typeof source.url !== 'string' || !source.url.startsWith(DOCS_PREFIX)) {
        faults.push(`${rule}: url is not on ${DOCS_PREFIX}`)
      }
      if (typeof source.heading !== 'string' || source.heading === '') {
        faults.push(`${rule}: no heading`)
      }
    }
  }
  return faults
}

const good: SourceMap = {
  'a-rule': [{ url: `${DOCS_PREFIX}en/hooks`, heading: 'Hook lifecycle' }],
}

describe('check', () => {
  it('accepts a valid map', () => {
    expect(check(good, ['a-rule'])).toEqual([])
  })

  it('fails for a rule with no entry', () => {
    expect(check(good, ['a-rule', 'b-rule'])).toEqual(['b-rule: no entry'])
  })

  it('fails for an entry with no rule file', () => {
    expect(check(good, [])).toEqual(['a-rule: no rule file'])
  })

  it('fails for an entry with no source', () => {
    expect(check({ 'a-rule': [] }, ['a-rule'])).toEqual(['a-rule: no source'])
  })

  it('fails for a URL that is not on code.claude.com/docs', () => {
    const map = { 'a-rule': [{ url: 'https://example.com/docs/x', heading: 'H' }] }
    expect(check(map, ['a-rule'])).toEqual([`a-rule: url is not on ${DOCS_PREFIX}`])
  })

  it('fails for a source with no heading', () => {
    const map = { 'a-rule': [{ url: `${DOCS_PREFIX}en/hooks` }] }
    expect(check(map, ['a-rule'])).toEqual(['a-rule: no heading'])
  })
})

describe('docs/rule-sources.json', () => {
  const map = JSON.parse(readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'))

  it('is valid for the rules in src/rules', () => {
    expect(check(map, ruleNames(ROOT))).toEqual([])
  })

  it('equals the output of the seed script', () => {
    const seeded = execFileSync('node', [SCRIPT, '--stdout'], { encoding: 'utf8' })
    expect(seeded).toBe(readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'))
  })
})

describe('seed script', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('reads the footnotes of a rule doc, and is stable', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rule-sources-'))
    dirs.push(root)
    mkdirSync(path.join(root, 'src/rules'), { recursive: true })
    mkdirSync(path.join(root, 'docs/rules'), { recursive: true })
    writeFileSync(path.join(root, 'src/rules/a-rule.ts'), '')
    writeFileSync(
      path.join(root, 'docs/rules/a-rule.md'),
      [
        'Text.[^one]',
        '',
        '[^one]: [Hooks reference: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)',
        '[^two]: [Skills](https://code.claude.com/docs/en/skills)',
        '[^dup]: [Hooks reference: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)',
        '[^other]: [Elsewhere](https://example.com/page)',
        '',
      ].join('\n'),
    )
    const run = () => execFileSync('node', [SCRIPT, '--stdout', root], { encoding: 'utf8' })
    const first = run()
    expect(JSON.parse(first)).toEqual({
      'a-rule': [
        { url: `${DOCS_PREFIX}en/hooks`, heading: 'Hook lifecycle' },
        { url: `${DOCS_PREFIX}en/skills`, heading: 'Skills' },
      ],
    })
    expect(run()).toBe(first)
  })
})
