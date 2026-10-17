// Parse the YAML frontmatter of a Markdown file, for each rule that reads a
// field. `@eslint/markdown` gives the frontmatter as one `yaml` node with the
// raw text in `value`. It does not parse the fields.
import { isMap, isScalar, type Node, parse, parseDocument, YAMLParseError } from 'yaml'

/** What the strict `yaml` parser makes of the text of a frontmatter block. An
 *  empty block, and a block of comments only, give `not-mapping` with the value
 *  null. A parse error gives the first error, and the line of the text where it
 *  starts. An error of alias resolution, such as an alias with no anchor, has no line. */
export type FrontmatterParse =
  | { kind: 'mapping'; data: Record<string, unknown> }
  | { kind: 'not-mapping'; value: unknown }
  | { kind: 'error'; message: string; line: number | null }

/** Tells YAML that gives a mapping from YAML that gives another value, and from
 *  YAML that does not parse. */
export function classifyFrontmatter(text: string): FrontmatterParse {
  let value: unknown
  try {
    // With no pretty errors, the message has no position and no copy of the text.
    value = parse(text, { prettyErrors: false })
  } catch (error) {
    // `parse` throws a YAMLParseError, with an offset, for text that does not parse. It throws a
    // ReferenceError, with no offset, for an alias that it cannot resolve, or for too many aliases.
    const line =
      error instanceof YAMLParseError ? text.slice(0, error.pos[0]).split('\n').length : null
    return { kind: 'error', message: (error as Error).message, line }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'not-mapping', value }
  }
  return { kind: 'mapping', data: value as Record<string, unknown> }
}

/** The fields of a frontmatter block as a plain object. Returns null when
 *  the YAML does not parse, or when its top level is not a mapping. The rules
 *  that read a field stay silent on bad YAML. */
export function parseFrontmatter(text: string): Record<string, unknown> | null {
  const result = classifyFrontmatter(text)
  return result.kind === 'mapping' ? result.data : null
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
