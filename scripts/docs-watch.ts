// Watches the Claude Code docs pages that docs/rule-sources.json cites.
//
// Usage: node scripts/docs-watch.ts [check|update] [root]
// check (default) fetches each cited page and compares it with the snapshot in
//   docs/docs-snapshot/. It writes no file. It prints a JSON report to stdout.
//   It also adds a Markdown report to $GITHUB_STEP_SUMMARY when that is set.
//   It exits 0 when a page changed.
//   It exits 1 when a fetch or a parse fails, or when the map cites no page.
//   It exits 1 when a mapped heading is not on its page or is on it twice.
//   It exits 1 for an unknown option, or for a map or snapshot file that it
//   cannot read. Both modes exit 1 on any failure.
// update writes the snapshot, and sets `hash` on each source in the map. A
//   person runs it, in a pull request. The scheduled job does not.
// A snapshot file holds { url, hash, blocks, sources }. Each block is
//   { id, hash, bodyHash }. bodyHash is the hash of the block text after its
//   heading (see splitBlocks). It is optional: an old snapshot file, or a block
//   with no body, does not have it. check does not read it.
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

// One block of a page: a heading and its text. `bodyHash` is the hash of the
// body (see splitBlocks). It is null when the block has no body.
export type Block = {
  id: string
  key: string
  level: number
  title: string
  text: string
  hash: string
  bodyHash: string | null
}

// A mapped source, resolved on its page.
export type SnapshotSource = { heading: string; id: string; hash: string; text: string }

// The stored state of one page. `id` of a block is its key. `bodyHash` is
// optional: a snapshot from before the body hash, or a block with no body,
// does not have it.
export type Snapshot = {
  url: string
  hash: string
  blocks: { id: string; hash: string; bodyHash?: string }[]
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

// The slug of a heading title: rendered text, lowercase, no punctuation, each
// space a hyphen. A Markdown heading has this slug as its ID. The site also turns a dot into a hyphen, as in "plugin-json".
export function slugify(heading: string): string {
  return stripInline(heading)
    .toLowerCase()
    .replaceAll('.', '-')
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^[ \t]*(`{3,}|~{3,})/
// An HTML heading, as the live pages write it: the opening tag alone on a line
// at column 0, the title on the next lines, and the closing tag alone on a
// line. Attributes are name="value" pairs. The title keeps inner HTML tags.
// Any other form of a heading tag is an error, not text (see splitBlocks).
const HTML_OPEN = /^<h([1-6])((?:[ \t]+[a-z-]+="[^"]*")*)[ \t]*>$/
const HTML_LIKE = /^\s*<h[1-6][\s>]/i
const HTML_ID = /(?:^|[ \t])id="([^"]*)"/
// The most lines that may sit between the opening tag and the closing tag.
const HTML_TITLE_LINES = 5

// Reads an HTML heading that starts at lines[start]. Returns undefined when
// the line is not an opening tag, or when no closing tag follows it soon. The
// scan stops at a line that starts another heading or a code fence.
function readHtmlHeading(lines: string[], start: number) {
  const open = HTML_OPEN.exec(lines[start] ?? '')
  if (!open) return undefined
  const level = Number(open[1])
  for (let end = start + 1; end <= start + HTML_TITLE_LINES + 1; end++) {
    const line = lines[end] ?? ''
    if (line === `</h${level}>`) {
      const title = stripInline(
        lines
          .slice(start + 1, end)
          .join(' ')
          .replace(/\s+/g, ' '),
      )
      return { level, title, id: HTML_ID.exec(open[2] ?? '')?.[1], end }
    }
    if (HTML_OPEN.test(line) || HEADING.test(line) || FENCE.test(line)) break
  }
  return undefined
}

// Splits a page into blocks. A block is a heading and its text, up to the next
// heading of any level. A heading is a Markdown heading, or an HTML heading
// with the tags on their own lines. A heading inside a code fence starts no
// block. Text before the first heading is not a block. The ID of an HTML
// heading is its `id` attribute, which is the anchor of the site. `key` is
// `id`, with a numeric suffix on the second and later blocks that share an ID.
// It throws for a code fence that is not closed, and for a line that looks
// like an HTML heading but is not in the form above. Setext headings and
// indented Markdown headings are not supported.
//
// The body of a block is its text after the heading. The heading of a
// Markdown block is its first line. The heading of an HTML block is all its
// lines from the opening tag to the closing tag. The body has no blank lines
// at its start and no white space at its end. `bodyHash` is the SHA-256 of the
// body, or null when the body is empty.
export function splitBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: { level: number; title: string; id?: string; head: number; lines: string[] }[] = []
  let fence: string | null = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ''
    const mark = FENCE.exec(line)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null
    } else if (mark) {
      fence = mark
    } else {
      const html = readHtmlHeading(lines, index)
      if (html) {
        blocks.push({
          level: html.level,
          title: html.title,
          id: html.id,
          head: html.end + 1 - index,
          lines: lines.slice(index, html.end + 1),
        })
        index = html.end
        continue
      }
      const match = HEADING.exec(line)
      if (match) {
        blocks.push({
          level: match[1]?.length ?? 1,
          title: stripInline(match[2] ?? ''),
          head: 1,
          lines: [line],
        })
        continue
      }
      if (HTML_LIKE.test(line)) {
        throw new Error(`line ${index + 1} looks like an HTML heading that the parser cannot read`)
      }
    }
    blocks.at(-1)?.lines.push(line)
  }
  if (fence) throw new Error('a code fence is not closed')
  const seen = new Map<string, number>()
  return blocks.map(({ level, title, id: explicit, head, lines: own }) => {
    const id = explicit || slugify(title)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    const text = own.join('\n').trimEnd()
    const body = own
      .slice(head)
      .join('\n')
      .replace(/^(?:[ \t]*\n)+/, '')
      .trimEnd()
    return {
      id,
      key: count === 0 ? id : `${id}-${count}`,
      level,
      title,
      text,
      hash: sha256(text),
      bodyHash: body === '' ? null : sha256(body),
    }
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
  // A block matches by its ID first. Only when no ID matches does a block match
  // by the slug of the title that the page shows. An HTML heading has an ID
  // that can differ from the slug of its title.
  const byId = blocks.filter((block) => block.id === id)
  const matches = byId.length > 0 ? byId : blocks.filter((block) => slugify(block.title) === id)
  if (matches.length === 0) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) is not on the page`)
  }
  if (matches.length > 1) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) appears ${matches.length} times`)
  }
  const [block] = matches
  if (block === undefined) throw new Error(`${url}: heading "${heading}" is not on the page`)
  if (block.level === 1) {
    return { heading, id: block.id, hash: sha256(pageText), text: pageText }
  }
  return { heading, id: block.id, hash: block.hash, text: block.text }
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
// Each block has its key, its hash and, when its body is not empty, its body
// hash. It throws when the page has no title heading, or when a mapped heading
// is not on the page or is on it twice.
export async function readPage(
  url: string,
  headings: string[],
  fetchText: FetchText,
): Promise<Snapshot> {
  const raw = await fetchText(`${url}.md`)
  const pageText = raw.replace(/\r\n?/g, '\n')
  let blocks: Block[]
  try {
    blocks = splitBlocks(pageText)
  } catch (error) {
    throw new Error(`${url}: ${(error as Error).message}`, { cause: error })
  }
  if (blocks[0]?.level !== 1) throw new Error(`${url}: the page has no title heading`)
  return {
    url,
    hash: sha256(pageText),
    blocks: blocks.map(({ key, hash, bodyHash }) =>
      bodyHash === null ? { id: key, hash } : { id: key, hash, bodyHash },
    ),
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
  // The mapped heading is unique on a page. The block ID is not, when two
  // HTML headings share an `id` attribute.
  const before = new Map((stored?.sources ?? []).map((source) => [source.heading, source]))
  const sources = current.sources.map(({ heading, id, hash }) => ({
    heading,
    id,
    status: statusOf(before.get(heading)?.hash, hash),
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
