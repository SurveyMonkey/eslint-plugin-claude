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
//   on the findings (scripts/docs-issues.ts). It exits 1 when the dry run
//   would open an issue or post a comment, and names each block. It gives
//   the reason of a needs-triage block, such as a failed Jev request. The
//   job's own dedupe decides each block, so the daily job and the gate agree.
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
import { ghRunner, keyOf, markersIn, merge, openIssues, trackedMarkersIn } from './docs-issues.ts'
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

// One line for each block that the dry run would put in an issue or in a
// group issue comment. The step logs each body, and each body holds the
// marker of each block, so the markers name the blocks.
function namedBlocks(output: Output, log: string[]): string[] {
  const openKeys = new Set(
    log
      .filter((text) => text.startsWith('would open: '))
      .flatMap((text) => markersIn(text).map((marker) => marker.key)),
  )
  const commentKeys = new Set(
    log.filter((text) => text.startsWith('would comment on ')).flatMap(trackedMarkersIn),
  )
  const byKey = new Map<string, Finding[]>()
  for (const f of output.findings) byKey.set(keyOf(f), [...(byKey.get(keyOf(f)) ?? []), f])
  // The hash of a removed block is `gone:` and its old hash, as in its key.
  const line = (kind: string, block: Pick<Finding, 'page' | 'blockId' | 'oldHash' | 'newHash'>) =>
    `- ${kind}: ${block.page} block ${block.blockId}, hash ${block.newHash ?? `gone:${block.oldHash}`}`
  const lines: string[] = []
  for (const [key, group] of byKey) {
    const f = merge(group)
    // A needs-triage block names its reason, such as a failed Jev request.
    const why = f.kind === 'needs-triage' ? `: ${f.reason}` : ''
    if (openKeys.has(key)) lines.push(`${line(f.kind, f)}${why}`)
  }
  for (const t of output.tracked) {
    if (commentKeys.has(keyOf(t))) lines.push(line('tracked', t))
  }
  return lines
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
    const lines = [
      `The dry run would open ${report.wouldOpen} issue(s) and post ${report.wouldComment} comment(s).`,
      ...namedBlocks(output, log),
    ]
    if (report.wouldOpen > 0 || report.wouldComment > 0) {
      return {
        lines,
        failures: [
          'The pull request stores a docs change that no open issue or group issue comment names. ' +
            'Run the docs watch workflow, triage what it opens, then run `update` again.',
        ],
      }
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
