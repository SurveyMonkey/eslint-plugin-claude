// Opens one GitHub issue for each finding of scripts/docs-classify.ts.
//
// Usage: node --experimental-strip-types scripts/docs-issues.ts <findings.json> [--dry-run]
//   [--repo owner/name] [--max n]
// Node 22.18 and later need no flag.
// It reads the open issues first. The marker of an issue is
// <!-- docs-watch:<kind>:<page>#<blockId>:<hash> -->. The hash is the new
// block hash, or the old hash for a removed block. The block ID is URI
// encoded. An open issue with a marker for the same page, block and hash
// stops a new issue, whatever its kind. A block that changes again gets a
// new issue. Findings with one marker in one run give one issue.
// --dry-run prints each issue that would open, and opens none. The
// repository comes from --repo or $GITHUB_REPOSITORY. The issue type is
// Task. The script adds no label.
//
// It fails closed. A finding that is not valid, or more new issues than
// --max (default 20) in a live run, makes it exit 1 before it opens an
// issue. A gh failure makes it exit 1. The issues that opened before the
// failure stay open, and the next run skips them. All gh calls go through a
// runner, so tests never call GitHub.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Finding, Kind } from './docs-classify.ts'

// Runs gh with the arguments and the standard input, and returns stdout.
export type Run = (args: string[], input?: string) => string
type OpenIssue = { number: number; body: string | null }

export const KINDS: readonly Kind[] = ['rule-update', 'rule-removal', 'new-rule', 'needs-triage']
export const MAX_TITLE = 69
export const MAX_QUOTE = 6000
const MAX_ISSUES = 20
const ADR = 'docs/adr/002-classify-docs-changes-with-jev.md'
const RUNBOOK = 'docs/runbooks/docs-watch-triage.md'

// The page, the block and the hash of a finding. The block ID comes from
// the docs, so it is URI encoded: it cannot close the marker comment.
export const keyOf = (f: Finding): string =>
  `${f.page}#${encodeURIComponent(f.blockId)}:${f.newHash ?? f.oldHash}`

export const markerOf = (f: Finding): string => `<!-- docs-watch:${f.kind}:${keyOf(f)} -->`

// The keys in the markers of an issue body.
const MARKER = /<!-- docs-watch:(?:rule-update|rule-removal|new-rule|needs-triage):(\S+) -->/g
const keysIn = (body: string): string[] => [...body.matchAll(MARKER)].map((m) => m[1] ?? '')

// Docs text is data. These make it inert in an issue body. A word joiner
// after each `@` stops a mention. A word joiner after the `<` of each
// `<!--` stops a comment that could fake a marker.
export const neutralize = (text: string): string =>
  String(text).replaceAll('@', '@\u2060').replaceAll('<!--', '<\u2060!--')

const longestRun = (text: string, char: string) => {
  let best = 0
  let run = 0
  for (const c of text) {
    run = c === char ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// Cuts a text to MAX_QUOTE characters and says so.
const cap = (text: string) =>
  text.length <= MAX_QUOTE
    ? { text, note: '' }
    : {
        text: text.slice(0, MAX_QUOTE),
        note: `The text is cut at ${MAX_QUOTE} of ${text.length} characters. Read the page for the rest.`,
      }

// A fenced block whose fence is longer than any backtick run in the text.
export function fence(text: string, info = 'text'): string {
  const { text: body, note } = cap(neutralize(text))
  const ticks = '`'.repeat(Math.max(3, longestRun(body, '`') + 1))
  return [`${ticks}${info}`, body, ticks, ...(note ? ['', note] : [])].join('\n')
}

// Inline code that no backtick in the text can close.
export function inline(text: string): string {
  const body = neutralize(text).replaceAll('\n', ' ')
  const ticks = '`'.repeat(longestRun(body, '`') + 1)
  return `${ticks} ${body} ${ticks}`
}

// Past this number of lines in one text, the body quotes the old text and
// the new text apart, with no diff. The diff table grows as the product of
// the two line counts.
export const MAX_DIFF_LINES = 1000

// A line diff: the longest common subsequence of lines, with "-" for an old
// line and "+" for a new line. It keeps CONTEXT unchanged lines on each side
// of a change, and puts "..." in place of the other unchanged lines. The
// change then stays inside the length cap of a large block.
const CONTEXT = 3
export function diffLines(oldText: string, newText: string): string {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  // The length of the longest common subsequence from line i of a and line j
  // of b. A cell outside the table is 0.
  const at = (i: number, j: number) => table[i]?.[j] ?? 0
  for (let i = a.length - 1; i >= 0; i--) {
    const row = table[i] as number[]
    for (let j = b.length - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(`  ${a[i++]}`)
      j++
    } else if (i < a.length && (j >= b.length || at(i + 1, j) >= at(i, j + 1))) {
      out.push(`- ${a[i++]}`)
    } else {
      out.push(`+ ${b[j++]}`)
    }
  }
  const changed = out.flatMap((line, index) => (line.startsWith('  ') ? [] : [index]))
  const near = (index: number) => changed.some((c) => Math.abs(c - index) <= CONTEXT)
  const kept: string[] = []
  for (const [index, line] of out.entries()) {
    if (near(index)) kept.push(line)
    else if (kept.at(-1) !== '  ...') kept.push('  ...')
  }
  return kept.join('\n')
}

const LEADS: Record<Kind, (scope: string) => string> = {
  'rule-update': (scope) => `docs${scope}: update for `,
  'rule-removal': (scope) => `docs${scope}: review removal of `,
  'new-rule': () => 'feat: new rule candidate from ',
  'needs-triage': (scope) => `docs${scope}: triage docs change to `,
}

// A Conventional Commit title of MAX_TITLE characters or fewer.
export function titleOf(f: Finding): string {
  const scoped = LEADS[f.kind](f.rules.length > 0 ? `(${f.rules.join(',')})` : '')
  // A long list of rules leaves no room for the heading. The title then has
  // no scope, and the Scope section of the body names the rules.
  const lead = MAX_TITLE - scoped.length < 4 ? LEADS[f.kind]('') : scoped
  const heading = neutralize(f.heading).replaceAll('\n', ' ')
  const room = MAX_TITLE - lead.length
  if (heading.length <= room) return `${lead}${heading}`
  return `${lead}${heading.slice(0, room - 3).trimEnd()}...`
}

const WHY: Record<Kind, string> = {
  'rule-update': 'The Claude Code docs changed a block that a rule cites.',
  'rule-removal': 'A block that a rule cites is gone, or it now makes the rule obsolete.',
  'new-rule': 'A docs block that no rule cites states a requirement that a lint check can measure.',
  'needs-triage': 'The classifier could not decide this docs change, so a person must decide.',
}

export function bodyOf(f: Finding, repo: string): string {
  const blob = `https://github.com/${repo}/blob/main`
  const classifier =
    f.probability === null
      ? `\`${f.kind}\`, with no model answer`
      : `\`${f.kind}\`, probability ${f.probability}, confidence ${f.confidence}`
  const lines = [
    markerOf(f),
    '',
    '## Why',
    '',
    WHY[f.kind],
    '',
    `- Page: ${f.page}`,
    `- Heading: ${inline(f.heading)} (block ${inline(f.blockId)})`,
    `- Change: ${f.change}`,
    `- Classifier result: ${classifier}`,
    `- Reason: ${neutralize(f.reason)}`,
    `- Hashes: old \`${f.oldHash ?? 'none'}\`, new \`${f.newHash ?? 'none'}\``,
    '',
  ]
  const long = (text: string) => text.split('\n').length > MAX_DIFF_LINES
  if (f.oldText !== null && f.newText !== null && (long(f.oldText) || long(f.newText))) {
    lines.push(
      `The block has more than ${MAX_DIFF_LINES} lines, so there is no diff. The old text and the new text, as quoted data:`,
      '',
    )
    lines.push(fence(f.oldText), '', fence(f.newText), '')
  } else if (f.oldText !== null && f.newText !== null) {
    lines.push('The diff of the block text, old to new, as quoted data:', '')
    lines.push(fence(diffLines(f.oldText, f.newText), 'diff'), '')
  } else if (f.newText !== null) {
    lines.push(
      f.change === 'added'
        ? 'The block is new. Its text, as quoted data:'
        : 'The snapshot holds only the hash of this block, so the old text is not available. See the page. The new text, as quoted data:',
      '',
    )
    lines.push(fence(f.newText), '')
  } else if (f.oldText !== null) {
    lines.push('The block is gone. Its old text, as quoted data:', '', fence(f.oldText), '')
  } else {
    lines.push('No block text is available for this change. See the page.', '')
  }
  lines.push(
    '## Scope',
    '',
    f.rules.length > 0
      ? f.rules.map((rule) => `- \`claude/${rule}\``).join('\n')
      : '- New rule candidate',
    '',
    '## Acceptance',
    '',
    '- [ ] A person decides: update the rule, drop it, add a rule, or move the map entry.',
    '- [ ] The resolving pull request refreshes the snapshot with `node scripts/docs-watch.ts update`.',
    '',
    '## References',
    '',
    f.link === f.page ? `- ${f.page} (heading ${inline(f.heading)})` : `- ${f.link}`,
    `- [ADR 002](${blob}/${ADR})`,
    `- [Triage runbook](${blob}/${RUNBOOK})`,
    '',
  )
  return lines.join('\n')
}

const FIELDS = ['page', 'heading', 'blockId', 'change', 'reason', 'link']
const HASH = /^[0-9a-f]{64}$/
const NULLABLE: [string, 'string' | 'number'][] = [
  ['oldText', 'string'],
  ['newText', 'string'],
  ['probability', 'number'],
  ['confidence', 'number'],
]

// Throws for a finding that the classifier cannot have made.
export function validate(value: unknown): asserts value is Finding {
  const f = (value ?? {}) as Record<string, unknown>
  if (!KINDS.includes(f.kind as Kind)) throw new Error(`a finding has an unknown kind: ${f.kind}`)
  for (const field of FIELDS) {
    if (typeof f[field] !== 'string' || f[field] === '') {
      throw new Error(`a ${String(f.kind)} finding has no ${field}`)
    }
  }
  if (!Array.isArray(f.rules) || !f.rules.every((rule) => typeof rule === 'string')) {
    throw new Error(`a ${String(f.kind)} finding has no rules list`)
  }
  if (typeof f.newHash !== 'string' && typeof f.oldHash !== 'string') {
    throw new Error(`a ${String(f.kind)} finding has no hash`)
  }
  for (const field of ['oldHash', 'newHash']) {
    const hash = f[field]
    if (hash !== null && !(typeof hash === 'string' && HASH.test(hash))) {
      throw new Error(`a ${String(f.kind)} finding has a ${field} that is not a SHA-256 hash`)
    }
  }
  for (const [field, type] of NULLABLE) {
    if (f[field] !== null && typeof f[field] !== type) {
      throw new Error(`a ${String(f.kind)} finding has a ${field} that is not a ${type} or null`)
    }
  }
  // The marker match reads the page as one run of characters with no space.
  if (!/^https:\/\/\S+$/.test(String(f.page))) {
    throw new Error(`a ${String(f.kind)} finding has a page that is not an https URL`)
  }
}

// Runs gh and returns its stdout. Tests pass a fake runner instead.
export const ghRunner: Run = (args, input) =>
  execFileSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] })

// The bodies of the open issues (not pull requests), one JSON object a line.
export function openBodies(repo: string, run: Run): OpenIssue[] {
  const out = run([
    'api',
    '--paginate',
    `repos/${repo}/issues?state=open&per_page=100`,
    '--jq',
    '.[] | select(.pull_request == null) | {number, body}',
  ])
  return out
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as OpenIssue)
}

export async function openIssues({
  findings,
  repo,
  run,
  dryRun,
  max = MAX_ISSUES,
  log,
}: {
  findings: unknown[]
  repo: string
  run: Run
  dryRun: boolean
  max?: number
  log: (text: string) => void
}): Promise<{ opened: string[]; skipped: number; wouldOpen: number }> {
  const valid: Finding[] = []
  for (const f of findings) {
    validate(f)
    valid.push(f)
  }
  const open = openBodies(repo, run).map((issue) => ({
    number: issue.number,
    keys: keysIn(String(issue.body ?? '')),
  }))
  // One finding for each marker. A second finding with the same marker adds
  // its rules and its reason to the first.
  const byMarker = new Map<string, Finding>()
  for (const f of valid) {
    const key = keyOf(f)
    const existing = open.find((issue) => issue.keys.includes(key))
    if (existing) {
      log(`skip: #${existing.number} already has ${key}`)
      continue
    }
    const marker = markerOf(f)
    const first = byMarker.get(marker)
    if (first === undefined) {
      byMarker.set(marker, { ...f, rules: [...f.rules] })
      continue
    }
    first.rules.push(...f.rules.filter((rule) => !first.rules.includes(rule)))
    if (!first.reason.split('; ').includes(f.reason)) first.reason += `; ${f.reason}`
    log(`merge: a second ${f.kind} finding for ${key}`)
  }
  const toOpen = [...byMarker.values()]
  if (!dryRun && toOpen.length > max) {
    throw new Error(
      `${toOpen.length} new issues is more than the limit of ${max}. Triage by hand, or run again with --max.`,
    )
  }
  // Every title and body is built before the first issue opens.
  const issues = toOpen.map((f) => ({ title: titleOf(f), body: bodyOf(f, repo), type: 'Task' }))
  const opened: string[] = []
  for (const issue of issues) {
    if (dryRun) {
      log(`would open: ${issue.title}\n\n${issue.body}`)
      continue
    }
    const out = run(
      ['api', '--method', 'POST', `repos/${repo}/issues`, '--input', '-', '--jq', '.html_url'],
      JSON.stringify(issue),
    )
    opened.push(out.trim())
    log(`opened: ${out.trim()}`)
  }
  return { opened, skipped: findings.length - toOpen.length, wouldOpen: dryRun ? toOpen.length : 0 }
}

export async function main(
  argv: string[],
  env: Record<string, string | undefined>,
  run: Run = ghRunner,
  log: (text: string) => void = console.log,
): Promise<number> {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index === -1 ? undefined : argv[index + 1]
  }
  const flagValues = new Set([value('--repo'), value('--max')])
  const file = argv.find((arg) => !arg.startsWith('--') && !flagValues.has(arg))
  if (!file)
    throw new Error('usage: docs-issues.ts <findings.json> [--dry-run] [--repo owner/name]')
  const repo = value('--repo') ?? env.GITHUB_REPOSITORY
  if (!repo) throw new Error('set --repo or GITHUB_REPOSITORY')
  const max = value('--max') === undefined ? MAX_ISSUES : Number(value('--max'))
  if (!Number.isInteger(max) || max < 0) throw new Error('--max takes a whole number')
  const { findings } = JSON.parse(readFileSync(path.resolve(file), 'utf8')) as {
    findings?: unknown
  }
  if (!Array.isArray(findings)) throw new Error(`${file} has no findings list`)
  const result = await openIssues({
    findings,
    repo,
    run,
    dryRun: argv.includes('--dry-run'),
    max,
    log,
  })
  log(`${result.opened.length} opened, ${result.wouldOpen} would open, ${result.skipped} skipped`)
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(error.message)
    return 1
  })
}
