// Opens one GitHub issue for each finding of scripts/docs-classify.ts.
//
// Usage: node --experimental-strip-types scripts/docs-issues.ts <findings.json> [--dry-run]
//   [--repo owner/name] [--max n]
// Node 22.18 and later need no flag.
// It reads the open issues first. An open issue whose body holds the marker
// of a finding stops a second issue for that finding. The marker is
// <!-- docs-watch:<kind>:<page>#<blockId>:<newHash> -->, so a block that
// changes again gets a new issue. --dry-run prints each issue that would
// open, and opens none. The repository comes from --repo or
// $GITHUB_REPOSITORY. The issue type is Task. The script adds no label.
//
// It fails closed: a finding that is not valid, a gh failure, or more new
// issues than --max (default 20) makes it exit 1 before it opens an issue
// for the rest. All gh calls go through a runner, so tests never call GitHub.
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

export const markerOf = (f: Finding): string =>
  `<!-- docs-watch:${f.kind}:${f.page}#${f.blockId}:${f.newHash ?? f.oldHash} -->`

// Docs text is data. These make it inert in an issue body: a word joiner
// after each `@` stops a mention, and one after each `<` of `<!--` stops a
// comment that could fake a marker.
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

// A Conventional Commit title of MAX_TITLE characters or fewer.
export function titleOf(f: Finding): string {
  const scope = f.rules.length > 0 ? `(${f.rules.join(',')})` : ''
  const leads: Record<Kind, string> = {
    'rule-update': `docs${scope}: update for `,
    'rule-removal': `docs${scope}: review removal of `,
    'new-rule': 'feat: new rule candidate from ',
    'needs-triage': `docs${scope}: triage docs change to `,
  }
  const lead = leads[f.kind]
  const heading = neutralize(f.heading).replaceAll('\n', ' ')
  const room = MAX_TITLE - lead.length
  if (heading.length <= room) return `${lead}${heading}`
  if (room < 4) return lead.trimEnd().slice(0, MAX_TITLE)
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
    `- Heading: ${inline(f.heading)} (block \`${f.blockId}\`)`,
    `- Change: ${f.change}`,
    `- Classifier result: ${classifier}`,
    `- Reason: ${neutralize(f.reason)}`,
    `- Hashes: old \`${f.oldHash ?? 'none'}\`, new \`${f.newHash ?? 'none'}\``,
    '',
  ]
  if (f.oldText !== null && f.newText !== null) {
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

// Throws for a finding that the classifier cannot have made.
export function validate(value: unknown): asserts value is Finding {
  const f = (value ?? {}) as Record<string, unknown>
  if (!KINDS.includes(f.kind as Kind)) throw new Error(`a finding has an unknown kind: ${f.kind}`)
  for (const field of FIELDS) {
    if (typeof f[field] !== 'string' || f[field] === '') {
      throw new Error(`a ${String(f.kind)} finding has no ${field}`)
    }
  }
  if (!Array.isArray(f.rules)) throw new Error(`a ${String(f.kind)} finding has no rules list`)
  if (typeof f.newHash !== 'string' && typeof f.oldHash !== 'string') {
    throw new Error(`a ${String(f.kind)} finding has no hash`)
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
  const open = openBodies(repo, run)
  const seen = new Set<string>()
  const toOpen: Finding[] = []
  for (const f of valid) {
    const marker = markerOf(f)
    const existing = open.find((issue) => String(issue.body ?? '').includes(marker))
    if (existing) {
      log(`skip: #${existing.number} already has ${marker}`)
      continue
    }
    if (seen.has(marker)) continue
    seen.add(marker)
    toOpen.push(f)
  }
  if (toOpen.length > max) {
    throw new Error(
      `${toOpen.length} new issues is more than the limit of ${max}. Triage by hand, or run again with --max.`,
    )
  }
  const opened: string[] = []
  for (const f of toOpen) {
    const issue = { title: titleOf(f), body: bodyOf(f, repo), type: 'Task' }
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
