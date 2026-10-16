// Stops a pull request that stores a docs change that nobody triaged.
//
// Usage: node scripts/docs-verify.ts <base> [root] [--repo owner/name]
// base is the ref or SHA of the base of the pull request. root defaults to
// this repository, with the head of the pull request at HEAD.
// A base that is empty, starts with a dash or is not a commit stops the gate.
// It reads the paths that changed from base to HEAD (`git diff base...HEAD`).
// It does not detect a rename, so a file moved out of the snapshot counts.
//   When no path is in docs/docs-snapshot/, and docs/rule-sources.json did
//   not change, it prints one line and exits 0.
// Else it needs TYPESAFE_API_KEY. With no key, it exits 1: a pull request
//   from a fork or from Dependabot gets no secret.
// It copies the base files that the classifier reads to a temporary root:
//   docs/rule-sources.json, docs/rules-inventory.md, docs/rules/ and
//   docs/docs-snapshot/. It classifies the live pages against that base
//   state (scripts/docs-classify.ts). Then it runs the issue step in dry run
//   on the findings (scripts/docs-issues.ts). The step logs each issue and
//   comment that it would make, with the key of each block.
// Then it reads the markers of the open issues and the tracked markers of
//   the open group issues. It makes the same gh reads as the issue step. It
//   accepts a block when one of them has its key. It does not compare the
//   rules (#316).
//   Jev can give a different answer in each run, so the rules can change.
//   The daily job still opens an issue or posts a comment for each
//   accepted block.
//   It exits 1 when a block has no key match, and names each such block. It
//   gives the reason of a needs-triage block, such as a failed Jev request.
//   It then prints the remedy, and the marker line of each such block in a
//   fence, for an issue that a person opens by hand.
//   It names each accepted block, the issues that have its key, and the
//   rules that their markers do not name.
// Then it runs the docs watch check on the head map and the head snapshot.
//   It exits 1 when a page changed: the docs changed after `update`, or the
//   map changed and `update` did not run. It also exits 1 when the check has
//   an error, such as a failed fetch.
// The two steps read each page once. So the head check compares the head
// snapshot with the text that the dry run read.
// The repository comes from --repo, $GITHUB_REPOSITORY or
// `gh repo view`. gh only reads. The gate writes nothing to GitHub.
// It fails closed: a step that throws, or an output that the gate cannot
// read, exits 1. It removes each GIT_ variable that points git at another
// repository, or changes how git reads config or paths. A git hook sets
// some of them.
// It prints a summary, and adds it to $GITHUB_STEP_SUMMARY when that is set.
// It removes the temporary root when it ends.
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Finding, JevFetch, Output } from './docs-classify.ts'
import { classify, loadInventory, loadRules } from './docs-classify.ts'
import type { Run } from './docs-issues.ts'
import {
  ghRunner,
  groupOf,
  keyOf,
  markersIn,
  merge,
  openBodies,
  openIssues,
  readGroup,
  trackedMarkersIn,
} from './docs-issues.ts'
import type { FetchText } from './docs-watch.ts'
import { checkPages, fetchMarkdown, loadMap, loadSnapshots } from './docs-watch.ts'

const MAP_FILE = 'docs/rule-sources.json'
const SNAPSHOT_DIR = 'docs/docs-snapshot/'
// The base paths that the classifier reads (see main in docs-classify.ts).
const BASE_PATHS = [MAP_FILE, 'docs/rules-inventory.md', 'docs/rules', SNAPSHOT_DIR]

type Out = { write: (text: string) => unknown }

// The variables that point git at a repository, or change how it reads
// config or paths. Git sets some of them when it runs a hook. The list is
// the list of src/git-state.ts.
const LOCATION = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
]
const AMBIENT =
  /^GIT_(CONFIG_(PARAMETERS|COUNT|KEY_\d+|VALUE_\d+)|(LITERAL|GLOB|NOGLOB|ICASE)_PATHSPECS)$/

// Runs git in the root, and returns stdout as bytes.
const gitIn =
  (root: string) =>
  (args: string[]): Buffer =>
    execFileSync('git', ['-C', root, ...args], {
      env: Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !LOCATION.includes(k) && !AMBIENT.test(k)),
      ),
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

// Writes each base file of BASE_PATHS to the same path under dir.
function copyBase(git: (args: string[]) => Buffer, base: string, dir: string): void {
  const files = git(['ls-tree', '-r', '-z', '--name-only', base, '--', ...BASE_PATHS])
    .toString('utf8')
    .split('\0')
    .filter((file) => file !== '')
  for (const file of files) {
    const target = path.join(dir, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, git(['show', `${base}:${file}`]))
  }
}

// Each page is fetched once. A second read gets the same text, or the same
// failure.
function fetchOnce(fetchText: FetchText): FetchText {
  const pages = new Map<string, Promise<string>>()
  return (url) => {
    let page = pages.get(url)
    if (page === undefined) {
      page = fetchText(url)
      pages.set(url, page)
    }
    return page
  }
}

// The issues that have each key: an open issue with a marker of the key,
// or an open group issue with a tracked marker of the key. The rules are the
// rules of those markers. A tracked marker names no rule. These are the gh
// reads of the issue step.
function heldKeys(
  output: Output,
  repo: string,
  run: Run,
): Map<string, { issues: Set<number>; rules: Set<string> }> {
  const held = new Map<string, { issues: Set<number>; rules: Set<string> }>()
  const hold = (key: string, issue: number, rules: string[]) => {
    const entry = held.get(key) ?? { issues: new Set<number>(), rules: new Set<string>() }
    entry.issues.add(issue)
    for (const rule of rules) entry.rules.add(rule)
    held.set(key, entry)
  }
  for (const issue of openBodies(repo, run)) {
    for (const m of markersIn(String(issue.body ?? ''))) hold(m.key, issue.number, m.rules)
  }
  const groups = new Set(output.tracked.flatMap((t) => t.sections.map((s) => groupOf(s.section))))
  for (const issue of groups) {
    for (const key of readGroup(repo, issue, run).keys) hold(key, issue, [])
  }
  return held
}

// The blocks that the dry run would put in an issue or in a group issue
// comment. The step logs each body, and each body holds the marker of each
// block, so the markers name the blocks. A comment marker names no rule.
// It throws when the log does not name a block for each issue and comment
// of the report. Then a log that names no block cannot pass.
function loggedBlocks(
  log: string[],
  report: { wouldOpen: number; wouldComment: number },
): { open: { key: string; rules: string[] }[]; comment: string[] } {
  const opens = log.filter((text) => text.startsWith('would open: ')).map(markersIn)
  const comments = log.filter((text) => text.startsWith('would comment on ')).map(trackedMarkersIn)
  if (
    opens.length !== report.wouldOpen ||
    comments.length !== report.wouldComment ||
    [...opens, ...comments].some((markers) => markers.length === 0)
  ) {
    throw new Error('the issue step log does not name one block or more for each issue and comment')
  }
  return { open: opens.flat(), comment: comments.flat() }
}

// The count of the blocks with no key match. One line for each of them
// that the findings or the tracked list name, and one line for each
// accepted block. The count, not the lines, fails the gate. It also returns
// the marker line of each such block. A person puts that line in an issue
// that they open by hand.
function namedBlocks(
  output: Output,
  blocks: ReturnType<typeof loggedBlocks>,
  held: ReturnType<typeof heldKeys>,
): { unmatched: number; failed: string[]; markers: string[]; accepted: string[] } {
  const openKeys = new Set(blocks.open.map((m) => m.key).filter((key) => !held.has(key)))
  const commentKeys = new Set(blocks.comment.filter((key) => !held.has(key)))
  const byKey = new Map<string, Finding[]>()
  for (const f of output.findings) byKey.set(keyOf(f), [...(byKey.get(keyOf(f)) ?? []), f])
  // The hash of a removed block is `gone:` and its old hash, as in its key.
  const line = (kind: string, block: Pick<Finding, 'page' | 'blockId' | 'oldHash' | 'newHash'>) =>
    `- ${kind}: ${block.page} block ${block.blockId}, hash ${block.newHash ?? `gone:${block.oldHash}`}`
  const failed: string[] = []
  const markers: string[] = []
  for (const [key, group] of byKey) {
    const f = merge(group)
    // A needs-triage block names its reason, such as a failed Jev request.
    const why = f.kind === 'needs-triage' ? `: ${f.reason}` : ''
    if (openKeys.has(key)) {
      failed.push(`${line(f.kind, f)}${why}`)
      markers.push(`<!-- docs-watch:${f.kind}:${key} -->`)
    }
  }
  for (const t of output.tracked) {
    if (commentKeys.has(keyOf(t))) {
      failed.push(line('tracked', t))
      // The gate reads an issue marker of any kind, so a tracked block gets a rule-update
      // issue marker. It is not a docs-watch-tracked comment marker.
      markers.push(`<!-- docs-watch:rule-update:${keyOf(t)} -->`)
    }
  }
  const accepted: string[] = []
  const seen = new Set<string>()
  for (const { key, rules } of [
    ...blocks.open,
    ...blocks.comment.map((key) => ({ key, rules: [] })),
  ]) {
    const entry = held.get(key)
    if (entry === undefined || seen.has(key)) continue
    seen.add(key)
    const issues = [...entry.issues].map((n) => `#${n}`).join(', ')
    const fresh = rules.filter((rule) => !entry.rules.has(rule))
    accepted.push(
      `- accepted: ${key}, held by ${issues}${fresh.length > 0 ? `, new rules: ${fresh.join(', ')}` : ''}`,
    )
  }
  return { unmatched: openKeys.size + commentKeys.size, failed, markers, accepted }
}

// Classifies the live pages against the base state, then runs the issue
// step in dry run. Returns the lines to print and the failures.
async function dryRun({
  baseRoot,
  repo,
  run,
  fetchText,
  jev,
  steps,
}: {
  baseRoot: string
  repo: string
  run: Run
  fetchText: FetchText
  jev: { fetch: JevFetch; key: string; wait?: (ms: number) => Promise<void> }
  steps: { classify: typeof classify; openIssues: typeof openIssues }
}): Promise<{ lines: string[]; failures: string[] }> {
  try {
    const output = await steps.classify({
      map: loadMap(baseRoot),
      inventory: loadInventory(baseRoot),
      snapshots: loadSnapshots(baseRoot),
      ...loadRules(baseRoot),
      fetchText,
      jev,
    })
    if (!Array.isArray(output?.findings) || !Array.isArray(output?.tracked)) {
      throw new Error('the classifier output has no findings or tracked list')
    }
    const log: string[] = []
    const report = await steps.openIssues({
      findings: output.findings,
      tracked: output.tracked,
      repo,
      run,
      dryRun: true,
      log: (text) => log.push(text),
    })
    if (!Number.isInteger(report?.wouldOpen) || !Number.isInteger(report?.wouldComment)) {
      throw new Error('the issue step report has no wouldOpen or wouldComment count')
    }
    const blocks = loggedBlocks(log, report)
    const { unmatched, failed, markers, accepted } = namedBlocks(
      output,
      blocks,
      heldKeys(output, repo, run),
    )
    const lines = [
      `The dry run would open ${report.wouldOpen} issue(s) and post ${report.wouldComment} comment(s).`,
      ...failed,
    ]
    if (accepted.length > 0) {
      lines.push(
        'An open issue or group issue comment has the key of each block below. ' +
          'The gate accepts these blocks. The daily job still opens an issue or posts a comment for each of them.',
        ...accepted,
      )
    }
    if (unmatched > 0) {
      const remedy =
        'The pull request stores a docs change that no open issue or group issue comment names. ' +
        'Run the docs watch workflow, triage what it opens, then run `update` again. ' +
        'If the workflow opens no issue for a failed block above, open one by hand. ' +
        'Start its body with the marker line of that block, and leave it open:'
      // The step summary is Markdown, and it hides an HTML comment. A fence shows the markers.
      lines.push('', remedy, '```', ...markers, '```')
      return { lines, failures: [remedy] }
    }
    return { lines, failures: [] }
  } catch (error) {
    const message = `The dry run failed: ${(error as Error).message}`
    return { lines: [message], failures: [message] }
  }
}

// Checks the head snapshot against the live docs.
async function checkHead(
  root: string,
  fetchText: FetchText,
): Promise<{ lines: string[]; failures: string[] }> {
  try {
    const report = await checkPages({
      map: loadMap(root),
      snapshots: loadSnapshots(root),
      fetchText,
    })
    if (report.changed === 0 && report.errors.length === 0) {
      return { lines: ['The head snapshot is the live docs.'], failures: [] }
    }
    const lines: string[] = []
    if (report.changed > 0) {
      lines.push(
        `${report.changed} page(s) of the head snapshot are not the live docs. ` +
          'The docs changed after `update`, or the map changed and `update` did not run. ' +
          'Run `node scripts/docs-watch.ts update` again, and push.',
      )
    }
    if (report.errors.length > 0) {
      lines.push(
        `The check of the head has ${report.errors.length} error(s):`,
        ...report.errors.map((e) => `- ${e}`),
      )
    }
    return { lines, failures: lines.slice(0, 1) }
  } catch (error) {
    const message = `The check of the head failed: ${(error as Error).message}`
    return { lines: [message], failures: [message] }
  }
}

export async function main(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: {
    fetchText?: FetchText
    fetch?: JevFetch
    wait?: (ms: number) => Promise<void>
    run?: Run
    classify?: typeof classify
    openIssues?: typeof openIssues
    out?: Out
  } = {},
): Promise<number> {
  const args: string[] = []
  let repoFlag: string | undefined
  const usage = 'usage: docs-verify.ts <base> [root] [--repo owner/name]'
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--repo') {
      repoFlag = argv[++i]
      if (repoFlag === undefined || repoFlag === '' || repoFlag.startsWith('-')) {
        throw new Error('--repo needs a value, owner/name')
      }
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`)
    else args.push(arg)
  }
  const [base, rootArg] = args
  // An empty base makes `...HEAD`, which is HEAD...HEAD, an empty diff. git
  // reads a base that starts with a dash as an option. Both would pass.
  if (args.length > 2 || base === undefined || base === '' || base.startsWith('-')) {
    throw new Error(usage)
  }
  const root = path.resolve(rootArg ?? path.join(import.meta.dirname, '..'))
  const out = deps.out ?? process.stdout
  const git = gitIn(root)
  // The commit of the base. It throws when the base is not a commit.
  const baseSha = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`])
    .toString('utf8')
    .trim()
  const changed = git(['diff', '--no-renames', '--name-only', '-z', `${baseSha}...HEAD`])
    .toString('utf8')
    .split('\0')
  if (!changed.some((file) => file === MAP_FILE || file.startsWith(SNAPSHOT_DIR))) {
    out.write(
      `docs-snapshot: the diff changes no file in ${SNAPSHOT_DIR} and not ${MAP_FILE}. Pass.\n`,
    )
    return 0
  }
  const lines = ['# docs-snapshot', '', `Base: \`${base}\``, '']
  const failures: string[] = []
  const key = env.TYPESAFE_API_KEY
  if (!key) {
    const message =
      'TYPESAFE_API_KEY is not set, and the diff changes the docs watch state. ' +
      'The gate needs the key for the dry run. ' +
      'A pull request from a fork or from Dependabot gets no secret: a maintainer pushes the change.'
    failures.push(message)
    lines.push(message)
  } else {
    const run = deps.run ?? ghRunner
    const repo =
      repoFlag ??
      env.GITHUB_REPOSITORY ??
      run(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim()
    const fetchText = fetchOnce(deps.fetchText ?? fetchMarkdown)
    const baseRoot = mkdtempSync(path.join(tmpdir(), 'docs-verify-'))
    try {
      copyBase(git, baseSha, baseRoot)
      const dry = await dryRun({
        baseRoot,
        repo,
        run,
        fetchText,
        jev: { fetch: deps.fetch ?? fetch, key, wait: deps.wait },
        steps: { classify: deps.classify ?? classify, openIssues: deps.openIssues ?? openIssues },
      })
      const head = await checkHead(root, fetchText)
      lines.push(...dry.lines, '', ...head.lines, '')
      failures.push(...dry.failures, ...head.failures)
    } finally {
      rmSync(baseRoot, { recursive: true, force: true })
    }
  }
  lines.push(failures.length === 0 ? 'docs-snapshot: pass' : 'docs-snapshot: fail', '')
  const text = lines.join('\n')
  out.write(text)
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text)
  return failures.length === 0 ? 0 : 1
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(error.message)
    return 1
  })
}
