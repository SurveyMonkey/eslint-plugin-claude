// The entries of a frontmatter field that holds a list of tools. Examples are
// `allowed-tools` in a skill and `tools` in a subagent. The docs accept a
// string or a YAML list. The helper gives each entry with its location, so a
// rule reports at the entry. `skill-frontmatter.ts` reads the frontmatter.
// This file reads only the range of each list item from the YAML text.
import type { AST } from 'eslint'
import { isSeq, type Node, parseDocument } from 'yaml'
import type { SkillFrontmatter } from './skill-frontmatter.ts'

/** One entry of a tool list, and where it sits in the file. */
export interface ListEntry {
  readonly text: string
  readonly loc: AST.SourceLocation
}

/** True for a character that ends an entry outside parentheses. */
export type Separator = (char: string) => boolean

/** A skill separates entries with a space or a comma. */
export const SPACE_OR_COMMA: Separator = (char) => /[\s,]/.test(char)

/** The sub-agents page gives a comma-separated string, so a subagent splits
 *  at a comma only. */
export const COMMA: Separator = (char) => char === ','

/** The entries of one string. An entry ends at a separator outside
 *  parentheses, so `Bash(git add *)` stays whole. An unclosed parenthesis
 *  takes the rest of the string. Space around an entry is dropped, and an
 *  empty entry is left out. */
function splitList(text: string, separator: Separator): string[] {
  const entries: string[] = []
  let depth = 0
  let entry = ''
  for (const char of text) {
    depth = Math.max(0, depth + (char === '(' ? 1 : char === ')' ? -1 : 0))
    if (depth === 0 && separator(char)) {
      entries.push(entry)
      entry = ''
    } else {
      entry += char
    }
  }
  return [...entries, entry].map((item) => item.trim()).filter((item) => item !== '')
}

/** The entries of the field `key`. `yaml` is the text that `fm` was read from.
 *  The search for an entry covers the text of its list item. For a string
 *  value, it covers the text of the field. So a report points at the entry,
 *  and a comment or another item cannot hold the match.
 *
 *  Sometimes the text does not hold an entry as written. A quoted string with
 *  an escape is one case. A plain string folded over two lines is another. The
 *  report for that entry then points at the whole item. The same is true for
 *  each later entry of the item: the position of a missed entry is not known,
 *  so a later match could lie inside it.
 *
 *  A value that is neither a string nor a list gives no entry. A list item
 *  that is not a string gives none either. */
export function listEntries(
  fm: SkillFrontmatter,
  yaml: string,
  key: string,
  separator: Separator,
): ListEntry[] {
  // A key written as an alias is in the data, but it has no field.
  const field = fm.fields.get(key)
  if (field === undefined) {
    return []
  }
  const value = fm.data[key]
  const node = parseDocument(yaml).get(key, true)
  const nodes: unknown[] = isSeq(node) ? node.items : []
  return (Array.isArray(value) ? value : [value]).flatMap((item, index) => {
    if (typeof item !== 'string') {
      return []
    }
    const [start, end] = (nodes[index] as Node | null | undefined)?.range ?? [
      field.valueStart,
      field.valueEnd,
    ]
    const raw = yaml.slice(start, end)
    let cursor = 0
    let missed = false
    return splitList(item, separator).map((text) => {
      const found = missed ? -1 : raw.indexOf(text, cursor)
      if (found === -1) {
        missed = true
        return { text, loc: fm.at(start, end) }
      }
      cursor = found + text.length
      return { text, loc: fm.at(start + found, start + found + text.length) }
    })
  })
}
