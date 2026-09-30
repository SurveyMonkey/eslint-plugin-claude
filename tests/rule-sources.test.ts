// The map in docs/rule-sources.json lists the pages and headings of the Claude
// Code docs that are the source of each rule. A later check of the docs will
// read it. A rule with no entry is a rule that the later check cannot see.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts/seed-rule-sources.ts')
// Node 22.13 needs the flag to run a .ts file. Node 24 accepts it.
const run = (...args: string[]) =>
  execFileSync(process.execPath, ['--experimental-strip-types', SCRIPT, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
const seed = (...args: string[]) => run('--stdout', ...args)
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

  it('fails for a source with an empty heading', () => {
    const map = { 'a-rule': [{ url: `${DOCS_PREFIX}en/hooks`, heading: '' }] }
    expect(check(map, ['a-rule'])).toEqual(['a-rule: no heading'])
  })

  it('fails for a source with no url', () => {
    const map = { 'a-rule': [{ heading: 'H' }] }
    expect(check(map, ['a-rule'])).toEqual([`a-rule: url is not on ${DOCS_PREFIX}`])
  })

  it('fails for an entry that is not a list', () => {
    const map = { 'a-rule': {} } as unknown as SourceMap
    expect(check(map, ['a-rule'])).toEqual(['a-rule: no source'])
  })

  it('fails for a URL on the host but not under /docs/', () => {
    const map = { 'a-rule': [{ url: 'https://code.claude.com/blog/x', heading: 'H' }] }
    expect(check(map, ['a-rule'])).toEqual([`a-rule: url is not on ${DOCS_PREFIX}`])
  })
})

describe('docs/rule-sources.json', () => {
  const map = JSON.parse(readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'))

  it('is valid for the rules in src/rules', () => {
    expect(check(map, ruleNames(ROOT))).toEqual([])
  })

  it('equals the output of the seed script', () => {
    const seeded = seed()
    expect(seeded).toBe(readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'))
  })
})

describe('seed script', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  // Makes a repository root. Each key is a rule, each value the text of its doc.
  function makeRoot(docs: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'rule-sources-'))
    dirs.push(root)
    mkdirSync(path.join(root, 'src/rules'), { recursive: true })
    mkdirSync(path.join(root, 'docs/rules'), { recursive: true })
    for (const [rule, text] of Object.entries(docs)) {
      writeFileSync(path.join(root, 'src/rules', `${rule}.ts`), '')
      writeFileSync(path.join(root, 'docs/rules', `${rule}.md`), text)
    }
    return root
  }
  const footnotes = (...lines: string[]) => `Text.\n\n${lines.join('\n')}\n`
  const one = (text: string) => JSON.parse(seed(makeRoot({ 'a-rule': text })))['a-rule']

  it('reads a footnote with an anchor and a page title', () => {
    const text = footnotes(
      '[^one]: [Hooks reference: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)',
    )
    expect(one(text)).toEqual([{ url: `${DOCS_PREFIX}en/hooks`, heading: 'Hook lifecycle' }])
  })

  it('uses the whole label as the heading for a link with no anchor', () => {
    const text = footnotes('[^one]: [Page: Title](https://code.claude.com/docs/en/skills)')
    expect(one(text)).toEqual([{ url: `${DOCS_PREFIX}en/skills`, heading: 'Page: Title' }])
  })

  it('uses the whole label as the heading for an anchor and a label with no colon', () => {
    const text = footnotes('[^one]: [Skills](https://code.claude.com/docs/en/skills#skills)')
    expect(one(text)).toEqual([{ url: `${DOCS_PREFIX}en/skills`, heading: 'Skills' }])
  })

  it('splits the label at the first colon and space', () => {
    const text = footnotes('[^one]: [A: B: C](https://code.claude.com/docs/en/skills#c)')
    expect(one(text)).toEqual([{ url: `${DOCS_PREFIX}en/skills`, heading: 'B: C' }])
    const bare = footnotes('[^one]: [A:B: C](https://code.claude.com/docs/en/skills#c)')
    expect(one(bare)).toEqual([{ url: `${DOCS_PREFIX}en/skills`, heading: 'C' }])
  })

  it('reads a footnote that ends with a space or a carriage return', () => {
    const link = '[Hooks: X](https://code.claude.com/docs/en/hooks#x)'
    const expected = [{ url: `${DOCS_PREFIX}en/hooks`, heading: 'X' }]
    expect(one(footnotes(`[^a]: ${link} `))).toEqual(expected)
    expect(one(`Text.\r\n\r\n[^a]: ${link}\r\n`)).toEqual(expected)
  })

  it('keeps one source for a repeated link', () => {
    const link = '[Hooks: Hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle)'
    expect(one(footnotes(`[^a]: ${link}`, `[^b]: ${link}`))).toHaveLength(1)
  })

  it('keeps two sources for one page with two headings', () => {
    const text = footnotes(
      '[^a]: [Hooks: One](https://code.claude.com/docs/en/hooks#one)',
      '[^b]: [Hooks: Two](https://code.claude.com/docs/en/hooks#two)',
    )
    expect(one(text)).toHaveLength(2)
  })

  it('keeps two sources for two pages with one heading', () => {
    const text = footnotes(
      '[^a]: [Hooks: One](https://code.claude.com/docs/en/hooks#one)',
      '[^b]: [Skills: One](https://code.claude.com/docs/en/skills#one)',
    )
    expect(one(text)).toHaveLength(2)
  })

  it('skips a link to another site, and a docs link in text', () => {
    const text = footnotes(
      'See [Hooks: X](https://code.claude.com/docs/en/hooks#x) in the text.',
      '[^other]: [Elsewhere](https://example.com/page)',
      '[^path]: [Elsewhere](https://example.com/claude.com/x)',
    )
    expect(one(text)).toEqual([])
  })

  it('skips a line that starts with a footnote reference and is not a definition', () => {
    expect(one('[^a] is defined below.\n')).toEqual([])
  })

  it.each([
    ['a link title', '[^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x "t")'],
    ['text after the link', '[^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x) (see)'],
    ['an indent', '  [^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x)'],
    ['no link', '[^a]: Hooks reference.'],
  ])('stops for a footnote that it cannot read: %s', (_name, line) => {
    expect(() => seed(makeRoot({ 'a-rule': footnotes(line) }))).toThrow(/cannot read the footnote/)
  })

  it.each([
    'http://code.claude.com/docs/en/hooks#x',
    'HTTPS://code.claude.com/docs/en/hooks#x',
    'https://Code.Claude.com/docs/en/hooks#x',
    '<https://code.claude.com/docs/en/hooks#x>',
    '//code.claude.com/docs/en/hooks#x',
    'https://docs.anthropic.com/en/hooks#x',
    'https://claude.ai/docs/x',
    'https://claude.com',
    'https://code.claude.com/blog/x',
    'https://code.claude.com/docs',
    'https://code.claude.com:443/docs/en/hooks#x',
  ])('stops for a link to a Claude site that is not under the docs prefix: %s', (link) => {
    const root = makeRoot({ 'a-rule': footnotes(`[^a]: [Hooks: X](${link})`) })
    expect(() => seed(root)).toThrow(/link is not under/)
  })

  it('does not stop for a host that only contains a Claude name', () => {
    const text = footnotes('[^a]: [Other: X](https://notclaude.com/x)')
    expect(one(text)).toEqual([])
  })

  it('gives an empty list for a doc with no footnotes', () => {
    expect(one('No footnotes.\n')).toEqual([])
  })

  it('lists the rules in sorted order and skips files that are not .ts', () => {
    const doc = footnotes('[^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x)')
    // "a-rule-b.ts" comes before "a-rule.ts" as a file name, but not as a rule name.
    const root = makeRoot({ 'b-rule': doc, 'a-rule-b': doc, 'a-rule': doc })
    writeFileSync(path.join(root, 'src/rules/notes.md'), '')
    expect(Object.keys(JSON.parse(seed(root)))).toEqual(['a-rule', 'a-rule-b', 'b-rule'])
  })

  it('reads this repository when it gets no root, from any directory', () => {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', SCRIPT, '--stdout'], {
      encoding: 'utf8',
      cwd: tmpdir(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(out).toBe(readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'))
  })

  it('writes the map file without --stdout, and does not write it with --stdout', () => {
    const doc = footnotes('[^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x)')
    const root = makeRoot({ 'a-rule': doc })
    const file = path.join(root, 'docs/rule-sources.json')
    const out = seed(root)
    expect(existsSync(file)).toBe(false)
    expect(run(root)).toBe('')
    expect(readFileSync(file, 'utf8')).toBe(out)
  })

  it('gives the same output on a second run', () => {
    const root = makeRoot({
      'a-rule': footnotes('[^a]: [Hooks: X](https://code.claude.com/docs/en/hooks#x)'),
    })
    expect(seed(root)).toBe(seed(root))
  })
})
