// The entries of a frontmatter field that holds a list of tools, such as
// `allowed-tools` in a skill and `tools` in a subagent. The docs accept a
// string or a YAML list. The helper gives each entry with its location, so a
// rule reports at the entry. It parses no YAML itself: `skill-frontmatter.ts`
// does that.
import type { AST } from 'eslint'
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

/** A subagent separates entries with a comma only. */
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
 *  An entry is found in the text of the field, in order, so a report points at
 *  the entry. When the text does not hold the entry as written, such as a
 *  quoted string with an escape, the report points at the whole value. A
 *  value that is neither a string nor a list gives no entry, and nor does a
 *  list item that is not a string. */
export function listEntries(
  fm: SkillFrontmatter,
  yaml: string,
  key: string,
  separator: Separator,
): ListEntry[] {
  const value = fm.data[key]
  const texts = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === 'string' ? splitList(item, separator) : [],
  )
  if (texts.length === 0) {
    return []
  }
  // The field exists, because the data holds a value for it.
  const field = fm.fields.get(key) as { valueStart: number; valueEnd: number }
  const raw = yaml.slice(field.valueStart, field.valueEnd)
  let cursor = 0
  return texts.map((text) => {
    const found = raw.indexOf(text, cursor)
    cursor = found === -1 ? cursor : found + text.length
    const loc =
      found === -1
        ? fm.at(field.valueStart, field.valueEnd)
        : fm.at(field.valueStart + found, field.valueStart + found + text.length)
    return { text, loc }
  })
}
