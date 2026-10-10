// Opens GitHub issues for the block changes in the findings of
// scripts/docs-classify.ts: one digest issue for the uncited blocks of each
// page, and one issue for each other block. Posts at most one comment on each
// open group issue, for the new blocks that inventory rows cite.
//
// Usage: node scripts/docs-issues.ts <findings.json> [--dry-run]
//   [--repo owner/name] [--max n]
// --max limits new issues only. A digest issue counts as one issue.
// It checks the findings, then reads the open issues. The marker of an
// issue is <!-- docs-watch:<kind>:<page>#<blockId>:<hash> rules=<ids> -->.
// kind is rule-update, rule-removal, new-rule, needs-triage or moved. The
// block ID is URI encoded. The hash is the new block hash. For a removed
// block, it is `gone:` and the old hash. For a moved block, the block ID is
// the old one, and the hash is that of the new block. ` rules=<ids>` is not
// there when the issue names no rule.
//
// A moved issue names the old and new headings and the new anchor. It names
// each footnote to change, in docs/rules/<rule>.md and
// docs/rules-inventory.md. Its Scope is the steps of "A moved section" in the
// triage runbook. A removed or an added block can have a line that names a
// possible move.
//
// All findings for one page, block and hash give one issue, or one section
// of a digest issue. An open issue with that page, block and hash stops a
// new issue, whatever its kind, when the open issues name all the rules. A
// digest has the marker of each block, so this check works for each block. A rule that they do not name gives a
// new issue. A block that changes again gets a new issue. --dry-run prints
// each issue that would open, and opens none. The repository comes from
// --repo or $GITHUB_REPOSITORY. The issue type is Task. Each issue gets the
// claude-docs-change label (LABEL), so a person can find the docs watch issues.
//
// For a changed block with old and new text, the body shows a diff. Under
// the diff, two collapsed sections quote the full old text and the full new
// text. Past MAX_DIFF_LINES lines, the body quotes the two texts with no diff.
//
// A digest issue holds the new-rule and needs-triage findings of one page
// that name no rule, after the dedupe and the group comment path. A page
// with two or more of them gets one digest, titled
// `docs(<page>): triage <n> changed blocks`. The body starts with the marker
// of each block, then has one section for each block. A section has the
// metadata, the rows line of a tracked block, and the diff or the quoted
// text, with no Before and After parts. A page with one such finding gets
// an issue of its own, as does each other finding: a moved finding, a
// rule-update or rule-removal finding, and a finding that names a rule. A
// page with more than MAX_DIGEST_BLOCKS such findings gets more than one
// digest.
//
// The findings file also has a `tracked` list: the blocks that an inventory
// row cites, and that no map heading cites other than the page title. Each
// section of those rows has a group issue (GROUP_ISSUES). The step reads the
// state and the comments of each group issue. While a group issue is open,
// it gets at most one comment for each run. The comment shows each new
// block, the rows that cite it, and its text.
// Each block in the comment has a hidden marker
// <!-- docs-watch-tracked:<page>#<blockId>:<hash> -->, with the key of an
// issue marker. The step does not post a block again while its marker is in
// a comment of the issue. A tracked block can have a finding that names no
// rule. While one of its group issues is open, that finding opens no issue.
// When all are closed, the finding opens an issue, with a line that names the
// inventory rows. Comments do not count toward --max. --dry-run prints each
// comment, and posts none.
//
// It fails closed. These make it exit 1 before it opens an issue or posts a
// comment:
// - a finding or a tracked block that is not valid, or no tracked list
// - a tracked block that is in the list twice
// - a tracked block in a section that has no group issue
// - a group issue whose state is not open or closed
// - a digest whose markers do not fit in MAX_COMMENT
// - more new issues than --max (default 20), in a live run.
// A gh failure makes it exit 1. The comments and the issues that the step
// made before the failure stay. The next run makes the rest. All gh calls go
// through a runner, so tests never call GitHub.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Finding, Kind, Tracked } from './docs-classify.ts'

// Runs gh with the arguments and the standard input, and returns stdout.
export type Run = (args: string[], input?: string) => string
type OpenIssue = { number: number; body: string | null }

// The label must exist in the repository before a live run.
const LABEL = 'claude-docs-change'

export const KINDS: readonly Kind[] = [
  'rule-update',
  'rule-removal',
  'new-rule',
  'needs-triage',
  'moved',
]
export const MAX_TITLE = 69
export const MAX_QUOTE = 6000
// The cap for each of the Before and After sections. A fence can be as long as
// its text, so a text of backticks takes three times its length. With this
// cap, the worst body with three fences stays under 60,000 characters. GitHub
// takes at most 65,536.
export const MAX_SECTION = 5000
const MAX_ISSUES = 20
const ADR = 'docs/adr/002-classify-docs-changes-with-jev.md'
const RUNBOOK = 'docs/runbooks/docs-watch-triage.md'

// The group issue of each `###` section of "Rules by group" in
// docs/rules-inventory.md. A tracked block in a section that is not here
// fails the step, so a new section cannot pass with no group issue.
const GROUP_ISSUES: Record<string, number> = {
  'Skills and commands': 50,
  'Subagents and output styles': 9,
  Hooks: 10,
  'Plugin manifest and layout': 11,
  'Marketplace manifest': 12,
  'CLAUDE.md, rules and memory': 13,
  Settings: 14,
  'Permissions and sandbox': 15,
  'MCP and LSP servers': 16,
}
// The markers and the text of a comment take at most this value. The step
// cuts the text after the markers, and adds a note of the cut after it. The
// comment then stays under the GitHub limit of 65,536 characters. A digest
// body uses the same value for its markers, its text and its last sections.
export const MAX_COMMENT = 60_000

// The most blocks in one digest issue. A page with more uncited findings
// gets one digest for each group of this many.
export const MAX_DIGEST_BLOCKS = 20
// The cap for each quoted text in a digest section. A fence can be as long
// as its text, so a text of backticks takes three times its length. With
// its fence lines and its cut note, one fence then takes
// 3 x 280 + 81 = 921 characters. A section with two texts of more than
// MAX_DIFF_LINES lines has two fences. The worst section in the tests has
// two fences, a marker, the metadata and a rows line:
// 2 x 921 + 1,001 = 2,843 characters. 20 sections take 56,860, and the first
// and last parts of the body take 912. The total of 57,772 leaves 2,228 for
// longer headings, block IDs and reasons in MAX_COMMENT. Past that, the step
// cuts the section text, as it does for a comment, and keeps every marker.
export const MAX_DIGEST_QUOTE = 280

// The page, the block and the hash of a finding. The block ID comes from
// the docs, so it is URI encoded: it cannot close the marker comment. A
// removed block has no new hash. Its key holds `gone:` and the old hash, so
// it never matches an issue about the new text of that block.
export const keyOf = (f: Pick<Finding, 'page' | 'blockId' | 'oldHash' | 'newHash'>): string =>
  `${f.page}#${encodeURIComponent(f.blockId)}:${f.newHash ?? `gone:${f.oldHash}`}`

// The marker of a tracked block in a group issue comment. It has the key of
// an issue marker, but not its prefix, so MARKER does not read it.
export const trackedMarkerOf = (t: Tracked): string => `<!-- docs-watch-tracked:${keyOf(t)} -->`
const TRACKED_MARKER = /<!-- docs-watch-tracked:(\S+?) -->/g

export const markerOf = (f: Finding): string =>
  `<!-- docs-watch:${f.kind}:${keyOf(f)}${f.rules.length > 0 ? ` rules=${f.rules.join(',')}` : ''} -->`

// The key and the rules in each marker of an issue body.
const MARKER =
  /<!-- docs-watch:(?:rule-update|rule-removal|new-rule|needs-triage|moved):(\S+?)(?: rules=([a-z0-9,-]+))? -->/g
const markersIn = (body: string): { key: string; rules: string[] }[] =>
  [...body.matchAll(MARKER)].map((m) => ({
    key: m[1] ?? '',
    rules: m[2] === undefined ? [] : m[2].split(','),
  }))

// The kind that names the issue for a block with findings of more than one
// kind: the first kind in this list. `moved` is first, because merge keeps
// the fields of the first kind only, and only a moved finding has `move`.
const ORDER: readonly Kind[] = ['moved', 'rule-removal', 'rule-update', 'needs-triage', 'new-rule']

// Joins the findings for one page, block and hash into one finding. It keeps
// every rule and every part of each reason. When the kinds are not all the
// same, each part of a reason starts with its kind. The probability is the
// highest one of the kind that names the issue.
export function merge(group: Finding[]): Finding {
  const kinds = new Set(group.map((f) => f.kind))
  const kind = ORDER.find((one) => kinds.has(one)) ?? 'needs-triage'
  const [lead] = group
    .filter((f) => f.kind === kind)
    .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1))
  if (lead === undefined) throw new Error('merge takes one finding or more')
  const rules: string[] = []
  const reasons: string[] = []
  for (const f of group) {
    rules.push(...f.rules.filter((rule) => !rules.includes(rule)))
    for (const part of f.reason.split('; ')) {
      const text = kinds.size > 1 ? `${f.kind}: ${part}` : part
      if (!reasons.includes(text)) reasons.push(text)
    }
  }
  return { ...lead, rules, reason: reasons.join('; ') }
}

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

// Cuts a text to `max` characters and says so.
const cap = (text: string, max: number) =>
  text.length <= max
    ? { text, note: '' }
    : {
        text: text.slice(0, max),
        note: `The text is cut at ${max} of ${text.length} characters. Read the page for the rest.`,
      }

// A fenced block whose fence is longer than any backtick run in the text.
export function fence(text: string, info = 'text', max = MAX_QUOTE): string {
  const { text: body, note } = cap(neutralize(text), max)
  const ticks = '`'.repeat(Math.max(3, longestRun(body, '`') + 1))
  return [`${ticks}${info}`, body, ticks, ...(note ? ['', note] : [])].join('\n')
}

// Inline code that no backtick in the text can close. A text that starts or
// ends with a backtick gets a space on each side, so that the backtick is
// not part of the fence. Markdown then removes the two spaces.
export function inline(text: string): string {
  const body = neutralize(text).replaceAll('\n', ' ')
  const ticks = '`'.repeat(longestRun(body, '`') + 1)
  const pad = body.startsWith('`') || body.endsWith('`') ? ' ' : ''
  return `${ticks}${pad}${body}${pad}${ticks}`
}

// A collapsed section that quotes a full text in a fence. The blank lines
// after the summary and before the end tag let the fence render.
const section = (summary: string, text: string) =>
  [
    `<details><summary>${summary}</summary>`,
    '',
    fence(text, 'text', MAX_SECTION),
    '',
    '</details>',
  ].join('\n')

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
  moved: (scope) => `docs${scope}: move the footnote of `,
}

// A Conventional Commit title of MAX_TITLE characters or fewer. A moved title
// has the rules and "to the renamed heading" in place of the heading. With no
// rule, it names the footnote of the inventory.
export function titleOf(f: Finding): string {
  const scoped = LEADS[f.kind](f.rules.length > 0 ? `(${f.rules.join(',')})` : '')
  // A long list of rules leaves no room for the heading. The title then has
  // no scope, and the Scope section of the body names the rules.
  const lead = MAX_TITLE - scoped.length < 4 ? LEADS[f.kind]('') : scoped
  const names = f.rules.length > 0 ? f.rules.join(',') : 'the inventory'
  const subject = f.kind === 'moved' ? `${names} to the renamed heading` : f.heading
  const heading = neutralize(subject).replaceAll('\n', ' ')
  const room = MAX_TITLE - lead.length
  if (heading.length <= room) return `${lead}${heading}`
  return `${lead}${heading.slice(0, room - 3).trimEnd()}...`
}

const WHY: Record<Kind, string> = {
  'rule-update': 'The Claude Code docs changed a block that a rule cites.',
  'rule-removal': 'A block that a rule cites is gone, or it now makes the rule obsolete.',
  'new-rule': 'A docs block that no rule cites states a requirement that a lint check can measure.',
  'needs-triage': 'The classifier could not decide this docs change, so a person must decide.',
  moved:
    'A block that a rule or an inventory row cites moved to a new heading on the same page. Its body did not change.',
}

// The rows of a tracked block, by section: "Hooks: `a`, `b`; Settings: `c`".
const rowsOf = (t: Tracked) =>
  t.sections
    .map((s) => `${neutralize(s.section)}: ${s.rules.map((rule) => `\`${rule}\``).join(', ')}`)
    .join('; ')

// The block text, as quoted data, for an issue body or a comment. These are
// the cases: two texts, one of them more than MAX_DIFF_LINES lines; two
// texts; the new text only; the old text only; and no text. With `full`, a
// diff of two texts has the full old and new text in two collapsed sections
// below it. `max` is the cap of each fence.
function blockText(
  f: Pick<Finding, 'oldText' | 'newText' | 'change'>,
  full: boolean,
  max = MAX_QUOTE,
): string[] {
  const lines: string[] = []
  const long = (text: string) => text.split('\n').length > MAX_DIFF_LINES
  if (f.oldText !== null && f.newText !== null && (long(f.oldText) || long(f.newText))) {
    lines.push(
      `One text of the block has more than ${MAX_DIFF_LINES} lines, so there is no diff. The old text and the new text, as quoted data:`,
      '',
    )
    lines.push(fence(f.oldText, 'text', max), '', fence(f.newText, 'text', max), '')
  } else if (f.oldText !== null && f.newText !== null) {
    lines.push('The diff of the block text, old to new, as quoted data:', '')
    lines.push(fence(diffLines(f.oldText, f.newText), 'diff', max), '')
    if (full) {
      lines.push(section('Before: the old section', f.oldText), '')
      lines.push(section('After: the new section', f.newText), '')
    }
  } else if (f.newText !== null) {
    lines.push(
      f.change === 'added'
        ? 'The block is new. Its text, as quoted data:'
        : 'The snapshot holds only the hash of this block, so the old text is not available. See the page. The new text, as quoted data:',
      '',
    )
    lines.push(fence(f.newText, 'text', max), '')
  } else if (f.oldText !== null) {
    lines.push(
      'The block is gone. Its old text, as quoted data:',
      '',
      fence(f.oldText, 'text', max),
      '',
    )
  } else {
    lines.push('No block text is available for this change. See the page.', '')
  }
  return lines
}

// The body of a moved issue. It names the old and new headings, the new
// anchor, and each footnote to change. Its Scope is the steps of "A moved
// section" in the triage runbook.
function movedBodyOf(f: Finding, move: NonNullable<Finding['move']>, blob: string): string {
  const anchor = `${f.page}#${encodeURIComponent(move.blockId)}`
  const old = inline(f.heading)
  const footnotes = [
    ...f.rules.map((rule) => `- \`docs/rules/${rule}.md\`: the footnote that cites ${old}`),
    ...move.sections.map(
      (s) =>
        `- \`docs/rules-inventory.md\`: the footnote that cites ${old}, for the ${neutralize(s.section)} rows ${s.rules.map((rule) => `\`${rule}\``).join(', ')}`,
    ),
  ]
  return [
    markerOf(f),
    '',
    '## Why',
    '',
    WHY.moved,
    '',
    `- Page: ${f.page}`,
    `- Old heading: ${old} (block ${inline(f.blockId)})`,
    `- New heading: ${inline(move.heading)} (block ${inline(move.blockId)})`,
    `- New anchor: ${anchor}`,
    `- Change: ${f.change}`,
    '- Classifier result: `moved`, with no model answer',
    `- Reason: ${neutralize(f.reason)}`,
    `- Hashes: old \`${f.oldHash}\`, new \`${f.newHash}\``,
    '',
    'The footnotes to change:',
    '',
    ...footnotes,
    '',
    'The body of the block did not change. The new block, as quoted data:',
    '',
    // validate makes sure that a moved finding has the new text.
    fence(String(f.newText)),
    '',
    '## Scope',
    '',
    `1. In each file above, change the footnote to the new heading and the anchor \`${encodeURIComponent(move.blockId)}\`. Keep the one-line form \`[^id]: [Page title: New heading](https://code.claude.com/docs/en/<page>#<anchor>)\`. Compare the anchor with the anchor on the page, because the site anchor is not always the slug of the heading.`,
    '2. Run `pnpm docs:seed`, then `node scripts/docs-watch.ts update`.',
    '3. Make sure that the rule stays in `src/rules/` and that `pnpm test` passes.',
    '4. Close this issue with the pull request.',
    '',
    '## Acceptance',
    '',
    `- [ ] No footnote cites the old block ${inline(f.blockId)} of this page.`,
    '- [ ] The resolving pull request refreshes the snapshot with `node scripts/docs-watch.ts update`.',
    '',
    '## References',
    '',
    `- ${anchor}`,
    `- [ADR 002](${blob}/${ADR})`,
    `- [Triage runbook](${blob}/${RUNBOOK}), section "A moved section"`,
    '',
  ].join('\n')
}

// The line for each possible move of a removed or an added block.
const nearLines = (f: Finding) =>
  (f.possibleMoves ?? []).map(
    (m) =>
      `- Possible move: ${inline(m.heading)} (block ${inline(m.blockId)}) on the same page shares three or more words with this heading. The job did not match the two blocks as a move. See "A moved section" in the triage runbook.`,
  )

// The metadata lines of a block, after its page. `tracked` is the tracked
// block of the finding, when the inventory cites it. A line then names the
// inventory rows.
function metaLines(f: Finding, tracked?: Tracked): string[] {
  const classifier =
    f.probability === null
      ? `\`${f.kind}\`, with no model answer`
      : `\`${f.kind}\`, probability ${f.probability}, confidence ${f.confidence}`
  return [
    `- Heading: ${inline(f.heading)} (block ${inline(f.blockId)})`,
    `- Change: ${f.change}`,
    `- Classifier result: ${classifier}`,
    `- Reason: ${neutralize(f.reason)}`,
    `- Hashes: old \`${f.oldHash ?? 'none'}\`, new \`${f.newHash ?? 'none'}\``,
    ...(tracked
      ? [`- Inventory rows that cite the block: ${rowsOf(tracked)}. Their group issues are closed.`]
      : []),
    ...nearLines(f),
  ]
}

// The body of an issue. `tracked` is the tracked block of the finding, when
// the inventory cites it. A line then names the inventory rows.
export function bodyOf(f: Finding, repo: string, tracked?: Tracked): string {
  const blob = `https://github.com/${repo}/blob/main`
  if (f.move !== undefined) return movedBodyOf(f, f.move, blob)
  const lines = [
    markerOf(f),
    '',
    '## Why',
    '',
    WHY[f.kind],
    '',
    `- Page: ${f.page}`,
    ...metaLines(f, tracked),
    '',
    ...blockText(f, true),
  ]
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

// The title of a digest issue. The scope is the page path after
// `/docs/en/`, or the URL with no `https://` when the path has no
// `/docs/en/`. When the scope is empty, or the title is longer than
// MAX_TITLE, the title has no scope. The body names the page.
export function digestTitleOf(page: string, n: number): string {
  const docs = '/docs/en/'
  const at = page.indexOf(docs)
  const scope = neutralize(at === -1 ? page.slice('https://'.length) : page.slice(at + docs.length))
  const scoped = `docs(${scope}): triage ${n} changed blocks`
  return scope !== '' && scoped.length <= MAX_TITLE ? scoped : `docs: triage ${n} changed blocks`
}

// The body of a digest issue for the blocks of one page. The marker of each
// block comes first. Then a section for each block holds its metadata and
// its text, with each fence cut at MAX_DIGEST_QUOTE. The Scope, Acceptance
// and References sections come last. The step cuts the block sections so
// that the markers, the sections and the last part take at most
// MAX_COMMENT, so a cut never removes a marker.
export function digestOf(
  page: string,
  blocks: { finding: Finding; tracked?: Tracked }[],
  repo: string,
): string {
  const blob = `https://github.com/${repo}/blob/main`
  const head = `${blocks.map((b) => markerOf(b.finding)).join('\n')}\n\n`
  const parts = [
    '## Why',
    '',
    `The docs watch found a change to ${blocks.length} blocks of one page. No rule cites them. Each section below is one block, with its own marker. Decide each block alone. The block text is quoted data from the docs. Each text is cut at ${MAX_DIGEST_QUOTE} characters. Read the page for the rest.`,
    '',
    `- Page: ${page}`,
    '',
  ]
  for (const { finding: f, tracked } of blocks) {
    parts.push(
      `### ${inline(f.heading)}`,
      '',
      ...metaLines(f, tracked),
      '',
      ...blockText(f, false, MAX_DIGEST_QUOTE),
    )
  }
  const foot = [
    '',
    '## Scope',
    '',
    '- A decision for each block above',
    '',
    '## Acceptance',
    '',
    '- [ ] A person decides each block: add a rule, change an inventory row, or record that no change is necessary.',
    '- [ ] The resolving pull request refreshes the snapshot with `node scripts/docs-watch.ts update`.',
    '',
    '## References',
    '',
    `- ${page}`,
    `- [ADR 002](${blob}/${ADR})`,
    `- [Triage runbook](${blob}/${RUNBOOK}), section "A digest issue"`,
    '',
  ].join('\n')
  const room = MAX_COMMENT - head.length - foot.length
  if (room < 0) {
    throw new Error(`the markers of the digest for ${page} do not fit in ${MAX_COMMENT} characters`)
  }
  const { text, note } = cap(parts.join('\n'), room)
  return `${head}${text}${note ? `\n\n${note}` : ''}${foot}`
}

const FIELDS = ['page', 'heading', 'blockId', 'change', 'reason', 'link']
const HASH = /^[0-9a-f]{64}$/
const URL_ = /^https:\/\/\S+$/
// A rule ID is the name of a file in src/rules/.
const RULE = /^[a-z0-9-]+$/
// The change values that scripts/docs-classify.ts gives.
const CHANGES = [
  'added',
  'changed',
  'removed',
  'new page',
  'duplicate heading',
  'unknown heading',
  'new source',
  'moved',
]
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
  if (!f.rules.every((rule) => RULE.test(rule)) || new Set(f.rules).size !== f.rules.length) {
    throw new Error(`a ${String(f.kind)} finding has a rule ID that is not valid, or twice`)
  }
  if ((f.kind === 'rule-update' || f.kind === 'rule-removal') && f.rules.length === 0) {
    throw new Error(`a ${String(f.kind)} finding names no rule`)
  }
  if (!CHANGES.includes(String(f.change))) {
    throw new Error(`a ${String(f.kind)} finding has an unknown change: ${String(f.change)}`)
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
  // The body shows the page and the link as they are.
  for (const field of ['page', 'link']) {
    if (!URL_.test(String(f[field]))) {
      throw new Error(`a ${String(f.kind)} finding has a ${field} that is not an https URL`)
    }
  }
  // Only a moved finding has the change `moved` and a `move`.
  const moved = f.kind === 'moved'
  if (moved !== (f.change === 'moved') || moved !== (f.move !== undefined)) {
    throw new Error(`a ${String(f.kind)} finding has a change or a move that does not fit its kind`)
  }
  if (moved) validateMove(f)
  if (f.possibleMoves !== undefined) {
    const list = f.possibleMoves
    const fits =
      (f.change === 'removed' || f.change === 'added') &&
      Array.isArray(list) &&
      list.length > 0 &&
      list.every((m: unknown) => {
        const { heading, blockId } = (m ?? {}) as Record<string, unknown>
        return (
          typeof heading === 'string' &&
          heading !== '' &&
          typeof blockId === 'string' &&
          blockId !== ''
        )
      })
    if (!fits) throw new Error(`a ${String(f.kind)} finding has a possible move that is not valid`)
  }
}

// True for a list of inventory rows by section. Each section has a name, and
// is in the list once. It has one valid rule ID or more, each once.
function rowsFit(sections: unknown[]): boolean {
  const names = new Set<string>()
  return sections.every((s) => {
    const { section, rules } = (s ?? {}) as Record<string, unknown>
    if (typeof section !== 'string' || section === '' || names.has(section)) return false
    names.add(section)
    return (
      Array.isArray(rules) &&
      rules.length > 0 &&
      rules.every((rule) => typeof rule === 'string' && RULE.test(rule)) &&
      new Set(rules).size === rules.length
    )
  })
}

// Throws for a moved finding whose hashes, texts or move do not fit its kind.
// It has the old hash, the new hash and the new text. Its old text can be
// null, because the snapshot stores the text of a mapped block only. Its new
// block is not its old block. A rule or an inventory row cites the old block.
function validateMove(f: Record<string, unknown>): void {
  if (
    typeof f.oldHash !== 'string' ||
    typeof f.newHash !== 'string' ||
    typeof f.newText !== 'string'
  ) {
    throw new Error('a moved finding has no old hash, no new hash or no new text')
  }
  const { heading, blockId, sections } = (f.move ?? {}) as Record<string, unknown>
  if (
    typeof heading !== 'string' ||
    heading === '' ||
    typeof blockId !== 'string' ||
    blockId === '' ||
    blockId === f.blockId
  ) {
    throw new Error('a moved finding has no new heading or new block, or its old block again')
  }
  if (!Array.isArray(sections) || !rowsFit(sections)) {
    throw new Error('a moved finding has no sections list, or a section that is not valid')
  }
  if (sections.length === 0 && (f.rules as unknown[]).length === 0) {
    throw new Error('a moved finding names no rule and no inventory row')
  }
}

// The change values of a tracked block.
const TRACKED_CHANGES = ['added', 'changed', 'removed']

// Throws for a tracked block that the classifier cannot have made.
export function validateTracked(value: unknown): asserts value is Tracked {
  const t = (value ?? {}) as Record<string, unknown>
  const fail = (what: string) => {
    throw new Error(`a tracked block ${what}`)
  }
  for (const field of ['page', 'heading', 'blockId']) {
    if (typeof t[field] !== 'string' || t[field] === '') fail(`has no ${field}`)
  }
  if (!URL_.test(String(t.page))) fail('has a page that is not an https URL')
  if (typeof t.change !== 'string' || !TRACKED_CHANGES.includes(t.change))
    fail(`has an unknown change: ${String(t.change)}`)
  if (typeof t.newHash !== 'string' && typeof t.oldHash !== 'string') fail('has no hash')
  for (const field of ['oldHash', 'newHash']) {
    const hash = t[field]
    if (hash !== null && !(typeof hash === 'string' && HASH.test(hash))) {
      fail(`has a ${field} that is not a SHA-256 hash`)
    }
  }
  for (const field of ['oldText', 'newText']) {
    if (t[field] !== null && typeof t[field] !== 'string') fail(`has a ${field} that is not text`)
  }
  // An added block has no old hash and no old text. A removed block has no new
  // hash and no new text. Other blocks have both hashes and the new text.
  const hasOld = t.change !== 'added'
  const hasNew = t.change !== 'removed'
  if (
    (typeof t.oldHash === 'string') !== hasOld ||
    (typeof t.newHash === 'string') !== hasNew ||
    (typeof t.newText === 'string') !== hasNew ||
    (!hasOld && t.oldText !== null)
  ) {
    fail(`has hashes or texts that do not fit the change ${String(t.change)}`)
  }
  const sections = t.sections
  if (!Array.isArray(sections) || sections.length === 0) fail('has no sections list')
  const names = new Set<string>()
  for (const s of sections as unknown[]) {
    const { section, rules } = (s ?? {}) as Record<string, unknown>
    if (typeof section !== 'string' || section === '' || names.has(section)) {
      fail('has a section with no name, or a section twice')
    }
    names.add(String(section))
    if (
      !Array.isArray(rules) ||
      rules.length === 0 ||
      !rules.every((rule) => typeof rule === 'string' && RULE.test(rule)) ||
      new Set(rules).size !== rules.length
    ) {
      fail('has a section with no rules, or a rule ID that is not valid, or twice')
    }
  }
}

// The group issue of an inventory section. Throws for a section with none.
function groupOf(section: string): number {
  const issue = Object.hasOwn(GROUP_ISSUES, section) ? GROUP_ISSUES[section] : undefined
  if (issue === undefined) {
    throw new Error(
      `the inventory section "${section}" has no group issue. Add it to GROUP_ISSUES.`,
    )
  }
  return issue
}

// The state of a group issue, and the keys of the tracked markers in its
// comments. A closed issue gets no comment, so its comments are not read.
function readGroup(repo: string, issue: number, run: Run): { open: boolean; keys: Set<string> } {
  const state = run(['api', `repos/${repo}/issues/${issue}`, '--jq', '.state']).trim()
  if (state !== 'open' && state !== 'closed') {
    throw new Error(`issue #${issue} has a state that is not open or closed: ${state}`)
  }
  if (state === 'closed') return { open: false, keys: new Set() }
  const out = run([
    'api',
    '--paginate',
    `repos/${repo}/issues/${issue}/comments?per_page=100`,
    '--jq',
    '.[] | {body}',
  ])
  const keys = new Set<string>()
  for (const line of out.split('\n')) {
    if (line.trim() === '') continue
    const { body } = JSON.parse(line) as { body: string | null }
    for (const m of String(body ?? '').matchAll(TRACKED_MARKER)) keys.add(m[1] ?? '')
  }
  return { open: true, keys }
}

// One comment for a group issue: a marker for each block first, then a
// section for each block. The text after the markers is cut to fit
// MAX_COMMENT, so a cut never removes a marker.
export function commentOf(
  blocks: { tracked: Tracked; rules: string[] }[],
  section: string,
): string {
  const markers = blocks.map((b) => trackedMarkerOf(b.tracked))
  const parts = [
    '## Docs changes to blocks that inventory rows cite',
    '',
    `The docs watch found a change to each block below. A row of the ${neutralize(section)} section of \`docs/rules-inventory.md\` cites it. Check each row against the new text when you build its rule. The block text is quoted data from the docs.`,
    '',
  ]
  for (const { tracked: t, rules } of blocks) {
    parts.push(
      `### ${inline(t.heading)}`,
      '',
      `- Page: ${t.page}`,
      `- Block: ${inline(t.blockId)}, ${t.change}`,
      `- Hashes: old \`${t.oldHash ?? 'none'}\`, new \`${t.newHash ?? 'none'}\``,
      `- Rows: ${rules.map((rule) => `\`${rule}\``).join(', ')}`,
      '',
      ...blockText(t, false),
    )
  }
  const head = `${markers.join('\n')}\n\n`
  const { text, note } = cap(parts.join('\n'), MAX_COMMENT - head.length)
  return `${head}${text}${note ? `\n\n${note}` : ''}\n`
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
  tracked = [],
  repo,
  run,
  dryRun,
  max = MAX_ISSUES,
  log,
}: {
  findings: unknown[]
  tracked?: unknown[]
  repo: string
  run: Run
  dryRun: boolean
  max?: number
  log: (text: string) => void
}): Promise<{
  opened: string[]
  skipped: number
  wouldOpen: number
  commented: string[]
  wouldComment: number
}> {
  const valid: Finding[] = []
  for (const f of findings) {
    validate(f)
    valid.push(f)
  }
  // The tracked blocks, by key, and the blocks of each group issue. A section
  // with no group issue throws here, before any gh call.
  const trackedBy = new Map<string, Tracked>()
  const byGroup = new Map<
    number,
    { section: string; blocks: { tracked: Tracked; rules: string[] }[] }
  >()
  for (const t of tracked) {
    validateTracked(t)
    if (trackedBy.has(keyOf(t)))
      throw new Error(`a tracked block is in the list twice: ${keyOf(t)}`)
    trackedBy.set(keyOf(t), t)
    for (const { section, rules } of t.sections) {
      const issue = groupOf(section)
      const group = byGroup.get(issue) ?? { section, blocks: [] }
      group.blocks.push({ tracked: t, rules })
      byGroup.set(issue, group)
    }
  }
  const groupState = new Map(
    [...byGroup.keys()].map((issue) => [issue, readGroup(repo, issue, run)]),
  )
  // A tracked block is covered while one of its group issues is open: the
  // comment there replaces an issue for a finding that names no rule.
  const covered = new Set(
    [...trackedBy]
      .filter(([, t]) => t.sections.some((s) => groupState.get(groupOf(s.section))?.open))
      .map(([key]) => key),
  )
  const comments: { issue: number; body: string }[] = []
  for (const [issue, group] of byGroup) {
    const state = groupState.get(issue)
    if (!state?.open) {
      log(`closed: #${issue}, so no comment for ${group.blocks.length} tracked block(s)`)
      continue
    }
    const fresh = group.blocks.filter((b) => !state.keys.has(keyOf(b.tracked)))
    if (fresh.length < group.blocks.length) {
      log(`skip: #${issue} already has ${group.blocks.length - fresh.length} tracked block(s)`)
    }
    if (fresh.length > 0) comments.push({ issue, body: commentOf(fresh, group.section) })
  }
  const open = openBodies(repo, run).map((issue) => ({
    number: issue.number,
    markers: markersIn(String(issue.body ?? '')),
  }))
  const groups = new Map<string, Finding[]>()
  let skipped = 0
  for (const f of valid) {
    if (f.rules.length === 0 && covered.has(keyOf(f))) {
      log(`comment: ${keyOf(f)} is tracked, and its group issue is open. No issue.`)
      skipped++
      continue
    }
    groups.set(keyOf(f), [...(groups.get(keyOf(f)) ?? []), f])
  }
  const toOpen: Finding[] = []
  for (const [key, group] of groups) {
    if (group.length > 1) log(`merge: ${group.length} findings for ${key}`)
    const f = merge(group)
    const marks = open.flatMap((issue) =>
      issue.markers.filter((m) => m.key === key).map((m) => ({ ...m, number: issue.number })),
    )
    const numbers = [...new Set(marks.map((m) => `#${m.number}`))].join(', ')
    const missing = f.rules.filter((rule) => !marks.some((m) => m.rules.includes(rule)))
    if (marks.length > 0 && missing.length === 0) {
      log(`skip: ${numbers} already has ${key}`)
      skipped += group.length
      continue
    }
    if (marks.length > 0) log(`open: ${numbers} has ${key}, but not ${missing.join(', ')}`)
    toOpen.push(f)
  }
  // Every title and body is built before the first comment or issue. A
  // tracked block with no open group issue gets the line of its rows.
  const rowsFor = (f: Finding) => (covered.has(keyOf(f)) ? undefined : trackedBy.get(keyOf(f)))
  // The new-rule and needs-triage findings that name no rule, by page. Each
  // other finding gets an issue of its own.
  const byPage = new Map<string, Finding[]>()
  const alone: Finding[] = []
  for (const f of toOpen) {
    if (f.rules.length === 0 && (f.kind === 'new-rule' || f.kind === 'needs-triage')) {
      byPage.set(f.page, [...(byPage.get(f.page) ?? []), f])
    } else {
      alone.push(f)
    }
  }
  const issues: { title: string; body: string; type: string; labels: string[] }[] = []
  const add = (title: string, body: string) =>
    issues.push({ title, body, type: 'Task', labels: [LABEL] })
  for (const f of alone) add(titleOf(f), bodyOf(f, repo, rowsFor(f)))
  for (const [page, list] of byPage) {
    for (let at = 0; at < list.length; at += MAX_DIGEST_BLOCKS) {
      const part = list.slice(at, at + MAX_DIGEST_BLOCKS)
      // A digest of one block is the issue of that block.
      if (part.length === 1) {
        const only = part[0] as Finding
        add(titleOf(only), bodyOf(only, repo, rowsFor(only)))
        continue
      }
      log(`digest: ${part.length} blocks of ${page} in one issue`)
      const blocks = part.map((f) => ({ finding: f, tracked: rowsFor(f) }))
      add(digestTitleOf(page, part.length), digestOf(page, blocks, repo))
    }
  }
  if (!dryRun && issues.length > max) {
    throw new Error(
      `${issues.length} new issues is more than the limit of ${max}. Triage by hand, or run again with --max.`,
    )
  }
  const commented: string[] = []
  for (const { issue, body } of comments) {
    if (dryRun) {
      log(`would comment on #${issue}:\n\n${body}`)
      continue
    }
    const out = run(
      [
        'api',
        '--method',
        'POST',
        `repos/${repo}/issues/${issue}/comments`,
        '--input',
        '-',
        '--jq',
        '.html_url',
      ],
      JSON.stringify({ body }),
    )
    commented.push(out.trim())
    log(`commented: ${out.trim()}`)
  }
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
  return {
    opened,
    skipped,
    wouldOpen: dryRun ? issues.length : 0,
    commented,
    wouldComment: dryRun ? comments.length : 0,
  }
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
  const { findings, tracked } = JSON.parse(readFileSync(path.resolve(file), 'utf8')) as {
    findings?: unknown
    tracked?: unknown
  }
  if (!Array.isArray(findings)) throw new Error(`${file} has no findings list`)
  if (!Array.isArray(tracked)) throw new Error(`${file} has no tracked list`)
  const result = await openIssues({
    findings,
    tracked,
    repo,
    run,
    dryRun: argv.includes('--dry-run'),
    max,
    log,
  })
  log(
    `${result.opened.length} opened, ${result.wouldOpen} would open, ${result.skipped} skipped, ${result.commented.length} commented, ${result.wouldComment} would comment`,
  )
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(error.message)
    return 1
  })
}
