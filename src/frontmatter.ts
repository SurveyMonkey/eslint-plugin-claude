// Parse the YAML frontmatter of a Markdown file, for each rule that reads a
// field. `@eslint/markdown` gives the frontmatter as one `yaml` node with the
// raw text in `value`. It does not parse the fields.
import { parse } from 'yaml'

/** The fields of a frontmatter block as a plain object. Returns null when
 *  the YAML does not parse, or when its top level is not a mapping. The rules
 *  stay silent on bad YAML. */
export function parseFrontmatter(text: string): Record<string, unknown> | null {
  let data: unknown
  try {
    data = parse(text)
  } catch {
    return null
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  return data as Record<string, unknown>
}

/** The field `key` when it is a string, or the empty string. */
export function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}
