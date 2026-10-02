// Writes docs/rule-sources.json. For each rule in src/rules, it reads the
// footnotes of docs/rules/<rule>.md that link to code.claude.com/docs. Each
// different pair of page URL and heading becomes one source. It makes no
// network call, and two runs give the same file. It stops with an error for a
// footnote that it cannot read. It also stops for a link to claude.com,
// claude.ai or anthropic.com that is not under code.claude.com/docs. When the
// map exists, a source that keeps its url and heading keeps its `hash`. The
// docs watch sets that field.
//
// Usage: node scripts/seed-rule-sources.ts [--stdout] [root]
// --stdout prints the map and writes no file. root defaults to this repository.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DOCS_PREFIX = 'https://code.claude.com/docs/'
// The start of a footnote definition.
const FOOTNOTE_START = /^\s*\[\^[^\]]+\]:/
// A Claude or Anthropic link. It must be under DOCS_PREFIX. The scheme is
// optional, and the match ignores case and a leading "<".
const OWN_HOST = /^<?(?:https?:)?\/\/(?:[^/]*\.)?(claude|anthropic)\.(?:com|ai)(?:[:/?#>]|$)/i
// A footnote definition that the script reads: [^id]: [label](url)
const FOOTNOTE = /^\[\^[^\]]+\]:\s*\[([^\]]+)\]\((\S+?)\)\s*$/

const args = process.argv.slice(2)
const toStdout = args.includes('--stdout')
const root = path.resolve(
  args.find((arg) => !arg.startsWith('--')) ?? path.join(import.meta.dirname, '..'),
)

const rules = readdirSync(path.join(root, 'src/rules'))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.slice(0, -'.ts'.length))
  .sort()

type Source = { url: string; heading: string; hash?: string }

const mapFile = path.join(root, 'docs/rule-sources.json')
const previous: Record<string, Source[]> = existsSync(mapFile)
  ? JSON.parse(readFileSync(mapFile, 'utf8'))
  : {}
const hashOf = (rule: string, url: string, heading: string) =>
  previous[rule]?.find((source) => source.url === url && source.heading === heading)?.hash

const map: Record<string, Source[]> = {}
for (const rule of rules) {
  const doc = readFileSync(path.join(root, 'docs/rules', `${rule}.md`), 'utf8')
  const sources: Source[] = []
  for (const line of doc.split('\n')) {
    if (!FOOTNOTE_START.test(line)) continue
    const [, label, link] = FOOTNOTE.exec(line) ?? []
    if (label === undefined || link === undefined) {
      throw new Error(`${rule}: cannot read the footnote: ${line}`)
    }
    if (!link.startsWith(DOCS_PREFIX)) {
      if (OWN_HOST.test(link)) throw new Error(`${rule}: link is not under ${DOCS_PREFIX}: ${link}`)
      continue
    }
    const url = link.split('#')[0] ?? link
    // The label reads "Page title: Heading". The heading is the text after the
    // first ": ". Without an anchor, or without a ": ", the whole label is the
    // heading.
    const colon = label.indexOf(': ')
    const heading = link.includes('#') && colon !== -1 ? label.slice(colon + 2) : label
    if (!sources.some((source) => source.url === url && source.heading === heading)) {
      const hash = hashOf(rule, url, heading)
      sources.push(hash === undefined ? { url, heading } : { url, heading, hash })
    }
  }
  map[rule] = sources
}

const json = `${JSON.stringify(map, null, 2)}\n`
if (toStdout) {
  process.stdout.write(json)
} else {
  writeFileSync(mapFile, json)
}
