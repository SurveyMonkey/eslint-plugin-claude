// Watches the Claude Code docs pages that docs/rule-sources.json cites.
//
// Usage: node scripts/docs-watch.mjs [check|update] [root]
// check (default) fetches each cited page and compares it with the snapshot in
//   docs/docs-snapshot/. It writes no file. It prints a JSON report to stdout,
//   and a Markdown report to $GITHUB_STEP_SUMMARY when that variable is set.
//   It exits 0 when a page changed. It exits 1 when a fetch or a parse fails,
//   or when a mapped heading is missing from its page or appears twice.
// update writes the snapshot, and sets `hash` on each source in the map. A
//   person runs it, or a triage pull request does. The scheduled job does not.
// root defaults to this repository.
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SNAPSHOT_DIR = 'docs/docs-snapshot'
const MAP_FILE = 'docs/rule-sources.json'

export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// Removes inline Markdown from a heading: code marks, links, images and
// emphasis marks. The slug step drops angle brackets as punctuation.
export function stripInline(text) {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*~]/g, '')
    .trim()
}

// The ID of a heading: rendered text, lowercase, no punctuation, each space
// a hyphen. The site also turns a dot into a hyphen, as in "plugin-json".
export function slugify(heading) {
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
export function splitBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let fence = null
  for (const line of lines) {
    const mark = FENCE.exec(line)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null
    } else if (mark) {
      fence = mark
    } else {
      const match = HEADING.exec(line)
      if (match) {
        blocks.push({ level: match[1].length, title: stripInline(match[2]), lines: [line] })
        continue
      }
    }
    blocks.at(-1)?.lines.push(line)
  }
  const seen = new Map()
  return blocks.map(({ level, title, lines: own }) => {
    const id = slugify(title)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    const text = own.join('\n').trimEnd()
    return { id, key: count === 0 ? id : `${id}-${count}`, level, title, text, hash: sha256(text) }
  })
}

// Finds the block for a mapped heading. A heading equal to the page title
// makes the whole page the source. Throws, and never guesses, when the heading
// is missing or appears more than once.
export function resolveSource(url, heading, blocks, pageText) {
  const id = slugify(heading)
  const matches = blocks.filter((block) => block.id === id)
  if (matches.length === 0) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) is not on the page`)
  }
  if (matches.length > 1) {
    throw new Error(`${url}: heading "${heading}" (id ${id}) appears ${matches.length} times`)
  }
  const [block] = matches
  if (block.level === 1) {
    return { heading, id, hash: sha256(pageText), text: pageText }
  }
  return { heading, id, hash: block.hash, text: block.text }
}

// The pages that the map cites, each with its mapped headings.
export function pagesOf(map) {
  const pages = new Map()
  for (const sources of Object.values(map)) {
    for (const { url, heading } of sources) {
      const headings = pages.get(url) ?? []
      if (!headings.includes(heading)) headings.push(heading)
      pages.set(url, headings)
    }
  }
  return pages
}

export const snapshotName = (url) =>
  `${url
    .slice(url.indexOf('/docs/') + '/docs/'.length)
    .replace(/^en\//, '')
    .replaceAll('/', '__')}.json`

// Fetches, hashes and splits one page. Returns the state that update writes.
export async function readPage(url, headings, fetchText) {
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

// Compares the page now with its snapshot. `stored` is undefined when the
// snapshot is missing: the page is then new.
export function comparePage(current, stored) {
  const before = new Map((stored?.sources ?? []).map((source) => [source.id, source]))
  const sources = current.sources.map(({ heading, id, hash }) => ({
    heading,
    id,
    status: !before.has(id) ? 'new' : before.get(id).hash === hash ? 'unchanged' : 'changed',
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
    return {
      url: current.url,
      status: 'unchanged',
      blocks: { changed: [], added: [], removed: [], unchanged },
      sources,
    }
  }
  const old = new Map(stored.blocks.map((b) => [b.id, b.hash]))
  const now = new Map(current.blocks.map((b) => [b.id, b.hash]))
  const blocks = { changed: [], added: [], removed: [], unchanged: [] }
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
export async function checkPages({ map, snapshots, fetchText }) {
  const pages = []
  const errors = []
  for (const [url, headings] of pagesOf(map)) {
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

const list = (ids) => (ids.length === 0 ? 'none' : ids.map((id) => `\`${id}\``).join(', '))

export function renderMarkdown(report) {
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

const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`

export function loadSnapshots(root) {
  const dir = path.join(root, SNAPSHOT_DIR)
  const snapshots = new Map()
  let files = []
  try {
    files = readdirSync(dir).filter((file) => file.endsWith('.json'))
  } catch {
    // A missing directory is a missing snapshot, not a failure.
  }
  for (const file of files) {
    snapshots.set(file, JSON.parse(readFileSync(path.join(dir, file), 'utf8')))
  }
  return snapshots
}

export const loadMap = (root) => JSON.parse(readFileSync(path.join(root, MAP_FILE), 'utf8'))

// Reads every cited page, then writes the snapshot and the map hashes. It
// writes nothing when one page fails. It deletes the snapshot file of a page
// that no rule cites now.
export async function updateState({ root, fetchText }) {
  const map = loadMap(root)
  const current = []
  for (const [url, headings] of pagesOf(map)) {
    current.push(await readPage(url, headings, fetchText))
  }
  const dir = path.join(root, SNAPSHOT_DIR)
  mkdirSync(dir, { recursive: true })
  const keep = new Set(current.map((page) => snapshotName(page.url)))
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.json') && !keep.has(file)) rmSync(path.join(dir, file))
  }
  for (const page of current) writeFileSync(path.join(dir, snapshotName(page.url)), toJson(page))
  const hashes = new Map()
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

export async function fetchMarkdown(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

export async function main(argv, env, fetchText = fetchMarkdown, out = process.stdout) {
  const args = argv.filter((arg) => !arg.startsWith('--'))
  const mode = ['check', 'update'].includes(args[0]) ? args.shift() : 'check'
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error.message)
    return 1
  })
}
