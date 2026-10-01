// Parse the YAML frontmatter of a Markdown file, for each rule that reads a
// field. `@eslint/markdown` gives the frontmatter as one `yaml` node with the
// raw text in `value`. It does not parse the fields.
import { isMap, isScalar, type Node, parse, parseDocument } from 'yaml'

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

/** One top-level field of a frontmatter block, with where its key and value
 *  sit in the text. A key with no value has an empty value range. */
export interface FrontmatterField {
  key: string
  keyStart: number
  keyEnd: number
  valueStart: number
  valueEnd: number
}

/** The top-level fields of a frontmatter block, in order, with text offsets.
 *  A key that is not a plain string is left out. Call it after
 *  `parseFrontmatter` gives a mapping. */
export function frontmatterFields(text: string): FrontmatterField[] {
  const { contents } = parseDocument(text)
  if (!isMap(contents)) {
    return []
  }
  const fields: FrontmatterField[] = []
  for (const { key, value } of contents.items) {
    if (!isScalar(key) || typeof key.value !== 'string') {
      continue
    }
    // A scalar that the parser read always has a range.
    const [keyStart, keyEnd] = key.range as [number, number, number]
    const [valueStart, valueEnd] = (value as Node | null)?.range ?? [keyEnd, keyEnd]
    fields.push({ key: key.value, keyStart, keyEnd, valueStart, valueEnd })
  }
  return fields
}
