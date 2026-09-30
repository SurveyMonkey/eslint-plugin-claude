// Writes docs/rule-sources.json. For each rule in src/rules, it reads the
// footnotes of docs/rules/<rule>.md that link to code.claude.com/docs. Each
// link becomes one source: the page URL and the heading. It makes no network
// call, and two runs give the same file.
//
// Usage: node --experimental-strip-types scripts/seed-rule-sources.ts [--stdout] [root]
// --stdout prints the map and writes no file. root defaults to this repository.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DOCS_PREFIX = 'https://code.claude.com/docs/'
// A footnote definition: [^id]: [label](url)
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

const map: Record<string, { url: string; heading: string }[]> = {}
for (const rule of rules) {
  const doc = readFileSync(path.join(root, 'docs/rules', `${rule}.md`), 'utf8')
  const sources: { url: string; heading: string }[] = []
  for (const line of doc.split('\n')) {
    const match = FOOTNOTE.exec(line)
    const [, label, link] = match ?? []
    if (label === undefined || !link?.startsWith(DOCS_PREFIX)) continue
    const url = link.split('#')[0] ?? link
    // The label reads "Page title: Heading". A link to a page with no anchor
    // has only the page title, so that title is the heading.
    const colon = label.indexOf(': ')
    const heading = link.includes('#') && colon !== -1 ? label.slice(colon + 2) : label
    if (!sources.some((source) => source.url === url && source.heading === heading)) {
      sources.push({ url, heading })
    }
  }
  map[rule] = sources
}

const json = `${JSON.stringify(map, null, 2)}\n`
if (toStdout) {
  process.stdout.write(json)
} else {
  writeFileSync(path.join(root, 'docs/rule-sources.json'), json)
}
