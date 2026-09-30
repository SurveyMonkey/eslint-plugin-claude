// Watches the Claude Code docs pages that docs/rule-sources.json cites.
//
// Usage: node --experimental-strip-types scripts/docs-watch.ts [check|update] [root]
// Node 22.18 and later need no flag.
// check (default) fetches each cited page and compares it with the snapshot in
//   docs/docs-snapshot/. It writes no file. It prints a JSON report to stdout.
//   It also adds a Markdown report to $GITHUB_STEP_SUMMARY when that is set.
//   It exits 0 when a page changed. It exits 1 when a fetch or a parse fails.
//   It also exits 1 when the map cites no page. It exits 1 when a mapped
//   heading is not on its page or is on it twice.
// update writes the snapshot, and sets `hash` on each source in the map. A
//   person runs it, in a pull request. The scheduled job does not.
// root defaults to this repository.
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// One block of a page: a heading and its text.
export type Block = {
  id: string
  key: string
  level: number
  title: string
  text: string
  hash: string
}

// A mapped source, resolved on its page.
export type SnapshotSource = { heading: string; id: string; hash: string; text: string }

// The stored state of one page.
export type Snapshot = {
  url: string
  hash: string
  blocks: { id: string; hash: string }[]
  sources: SnapshotSource[]
}

export type SourceMap = Record<string, { url: string; heading: string; hash?: string }[]>
export type FetchText = (url: string) => Promise<string>
type Status = 'new' | 'changed' | 'unchanged'

export type PageReport = {
  url: string
  status: Status
  blocks: { changed: string[]; added: string[]; removed: string[]; unchanged: string[] }
  sources: { heading: string; id: string; status: Status }[]
}

export type Report = {
  changed: number
  unchanged: number
  pages: PageReport[]
  errors: string[]
}

const SNAPSHOT_DIR = 'docs/docs-snapshot'
const MAP_FILE = 'docs/rule-sources.json'

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

// Removes inline Markdown from a heading: code marks, links, images and
// emphasis marks. The slug step drops angle brackets as punctuation.
export function stripInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*~]/g, '')
    .trim()
}

// The ID of a heading: rendered text, lowercase, no punctuation, each space
// a hyphen. The site also turns a dot into a hyphen, as in "plugin-json".
export function slugify(heading: string): string {
  return stripInline(heading)
    .toLowerCase()
    .replaceAll('.', '-')
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^[ \t]*(`{3,}|~{3,})/

// Splits a page into blocks. A block is a heading and its text, up to the next
// heading of any level. A heading inside a code fence starts no block. Text
// before the first heading is not a block. `key` is `id`, with a numeric
// suffix on the second and later blocks that share an ID.
export function splitBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: { level: number; title: string; lines: string[] }[] = []
  let fence: string | null = null
  for (const line of lines) {
    const mark = FENCE.exec(line)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null
    } else if (mark) {
      fence = mark
    } else {
      const match = HEADING.exec(line)
      if (match) {
        blocks.push({
          level: match[1]?.length ?? 1,
          title: stripInline(match[2] ?? ''),
          lines: [line],
        })
        continue
      }
    }
    blocks.at(-1)?.lines.push(line)
  }
  const seen = new Map<string, number>()
  return blocks.map(({ level, title, lines: own }) => {
    const id = slugify(title)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    const text = own.join('\n').trimEnd()
    return { id, key: count === 0 ? id : `${id}-${count}`, level, title, text, hash: sha256(text) }
  })
}

// Finds the block for a mapped heading. A heading at level 1 makes the whole
// page the source. Throws, and never guesses, when the heading is not on the
// page or is on it more than once.
export function resolveSource(
  url: string,
  heading: string,
  blocks: Block[],
  pageText: string,
): SnapshotSource {
  const id = slugify(heading)
  const matches = blocks.filter((block) => block.id === id)
  if (matches.length === 0) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) is not on the page`)
  }
  if (matches.length > 1) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) appears ${matches.length} times`)
  }
  const [block] = matches
  if (block === undefined) throw new Error(`${url}: heading "${heading}" is not on the page`)
  if (block.level === 1) {
    return { heading, id, hash: sha256(pageText), text: pageText }
  }
  return { heading, id, hash: block.hash, text: block.text }
}

// The pages that the map cites, each with its mapped headings.
export function pagesOf(map: SourceMap): Map<string, string[]> {
  const pages = new Map<string, string[]>()
  for (const sources of Object.values(map)) {
    for (const { url, heading } of sources) {
      const headings = pages.get(url) ?? []
      if (!headings.includes(heading)) headings.push(heading)
      pages.set(url, headings)
    }
  }
  return pages
}

export const snapshotName = (url: string): string =>
  `${url
    .slice(url.indexOf('/docs/') + '/docs/'.length)
    .replace(/^en\//, '')
    .replaceAll('/', '__')}.json`

// Fetches, hashes and splits one page. Returns the state that update writes.
export async function readPage(
  url: string,
  headings: string[],
  fetchText: FetchText,
): Promise<Snapshot> {
  const raw = await fetchText(`${url}.md`)
  const pageText = raw.replace(/\r\n?/g, '\n')
  const blocks = splitBlocks(pageText)
  if (blocks[0]?.level !== 1) throw new Error(`${url}: the page has no title heading`)
  return {
    url,
    hash: sha256(pageText),
    blocks: blocks.map(({ key, hash }) => ({ id: key, hash })),
    sources: headings.map((heading) => resolveSource(url, heading, blocks, pageText)),
  }
}

// A hash that is not stored yet means the block is new.
const statusOf = (before: string | undefined, now: string): Status =>
  before === undefined ? 'new' : before === now ? 'unchanged' : 'changed'

// Compares the page now with its snapshot. `stored` is undefined when the
// snapshot is missing: the page is then new. A page with the same hash is
// changed when a mapped source is not in the snapshot yet.
export function comparePage(current: Snapshot, stored: Snapshot | undefined): PageReport {
  const before = new Map((stored?.sources ?? []).map((source) => [source.id, source]))
  const sources = current.sources.map(({ heading, id, hash }) => ({
    heading,
    id,
    status: statusOf(before.get(id)?.hash, hash),
  }))
  if (!stored) {
    return {
      url: current.url,
      status: 'new',
      blocks: { changed: [], added: current.blocks.map((b) => b.id), removed: [], unchanged: [] },
      sources,
    }
  }
  if (stored.hash === current.hash) {
    const unchanged = current.blocks.map((b) => b.id)
    const settled = sources.every((source) => source.status === 'unchanged')
    return {
      url: current.url,
      status: settled ? 'unchanged' : 'changed',
      blocks: { changed: [], added: [], removed: [], unchanged },
      sources,
    }
  }
  const old = new Map(stored.blocks.map((b) => [b.id, b.hash]))
  const now = new Map(current.blocks.map((b) => [b.id, b.hash]))
  const blocks: PageReport['blocks'] = { changed: [], added: [], removed: [], unchanged: [] }
  for (const [id, hash] of now) {
    if (!old.has(id)) blocks.added.push(id)
    else if (old.get(id) === hash) blocks.unchanged.push(id)
    else blocks.changed.push(id)
  }
  for (const id of old.keys()) {
    if (!now.has(id)) blocks.removed.push(id)
  }
  return { url: current.url, status: 'changed', blocks, sources }
}

// Checks every cited page. Never throws: a failure goes in `errors`.
export async function checkPages({
  map,
  snapshots,
  fetchText,
}: {
  map: SourceMap
  snapshots: Map<string, Snapshot>
  fetchText: FetchText
}): Promise<Report> {
  const pages: PageReport[] = []
  const errors: string[] = []
  const cited = pagesOf(map)
  if (cited.size === 0) errors.push('the map cites no page')
  for (const [url, headings] of cited) {
    try {
      const current = await readPage(url, headings, fetchText)
      pages.push(comparePage(current, snapshots.get(snapshotName(url))))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  const changed = pages.filter((page) => page.status !== 'unchanged').length
  return { changed, unchanged: pages.length - changed, pages, errors }
}

const list = (ids: string[]) =>
  ids.length === 0 ? 'none' : ids.map((id) => `\`${id}\``).join(', ')

export function renderMarkdown(report: Report): string {
  const lines = ['# Claude Code docs watch', '']
  lines.push(
    `${report.changed} page(s) changed or new, ${report.unchanged} unchanged, ${report.errors.length} error(s).`,
    '',
  )
  for (const error of report.errors) lines.push(`- ERROR: ${error}`)
  if (report.errors.length > 0) lines.push('')
  for (const page of report.pages) {
    lines.push(`## ${page.url}: ${page.status}`, '')
    if (page.status === 'unchanged') continue
    const { changed, added, removed, unchanged } = page.blocks
    lines.push(
      `- Changed blocks: ${list(changed)}`,
      `- Added blocks: ${list(added)}`,
      `- Removed blocks: ${list(removed)}`,
      `- Unchanged blocks: ${unchanged.length}`,
      '- Cited blocks:',
      ...page.sources.map((source) => `  - \`${source.id}\`: ${source.status}`),
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export function loadSnapshots(root: string): Map<string, Snapshot> {
  const dir = path.join(root, SNAPSHOT_DIR)
  const snapshots = new Map<string, Snapshot>()
  let files: string[] = []
  try {
    files = readdirSync(dir).filter((file) => file.endsWith('.json'))
  } catch (error) {
    // A missing directory is a missing snapshot. Any other fault is a failure.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  for (const file of files) snapshots.set(file, readJson(path.join(dir, file)))
  return snapshots
}

// Reads a JSON file. A parse error names the file.
function readJson(file: string) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`, { cause: error })
  }
}

export const loadMap = (root: string): SourceMap => readJson(path.join(root, MAP_FILE))

// Reads every cited page, then writes the snapshot and the map hashes. It
// writes nothing when one page fails. It deletes the snapshot file of a page
// that no rule cites now.
export async function updateState({
  root,
  fetchText,
}: {
  root: string
  fetchText: FetchText
}): Promise<{ pages: number }> {
  const map = loadMap(root)
  const current: Snapshot[] = []
  const cited = pagesOf(map)
  if (cited.size === 0) throw new Error('the map cites no page')
  for (const [url, headings] of cited) {
    current.push(await readPage(url, headings, fetchText))
  }
  const dir = path.join(root, SNAPSHOT_DIR)
  mkdirSync(dir, { recursive: true })
  const keep = new Set(current.map((page) => snapshotName(page.url)))
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.json') && !keep.has(file)) rmSync(path.join(dir, file))
  }
  for (const page of current) writeFileSync(path.join(dir, snapshotName(page.url)), toJson(page))
  const hashes = new Map<string, string>()
  for (const page of current) {
    for (const source of page.sources) hashes.set(`${page.url}\n${source.heading}`, source.hash)
  }
  for (const sources of Object.values(map)) {
    for (const source of sources) {
      source.hash = hashes.get(`${source.url}\n${source.heading}`)
    }
  }
  writeFileSync(path.join(root, MAP_FILE), toJson(map))
  return { pages: current.length }
}

export async function fetchMarkdown(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  } catch (error) {
    const reason = (error as Error).cause instanceof Error ? (error as Error).cause : error
    throw new Error(`${url}: ${(reason as Error).message}`, { cause: error })
  }
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

export async function main(
  argv: string[],
  env: Record<string, string | undefined>,
  fetchText: FetchText = fetchMarkdown,
  out: { write: (text: string) => unknown } = process.stdout,
): Promise<number> {
  const flag = argv.find((arg) => arg.startsWith('--'))
  if (flag) throw new Error(`unknown option ${flag}`)
  const args = [...argv]
  const mode = args[0] === 'check' || args[0] === 'update' ? args.shift() : 'check'
  const root = path.resolve(args[0] ?? path.join(import.meta.dirname, '..'))
  if (mode === 'update') {
    const { pages } = await updateState({ root, fetchText })
    out.write(`updated ${pages} page snapshot(s) and the map hashes\n`)
    return 0
  }
  const report = await checkPages({
    map: loadMap(root),
    snapshots: loadSnapshots(root),
    fetchText,
  })
  out.write(toJson(report))
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, renderMarkdown(report))
  return report.errors.length > 0 ? 1 : 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env).catch((error: Error) => {
    console.error(error.message)
    return 1
  })
}
