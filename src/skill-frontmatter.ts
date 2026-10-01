// The frontmatter of a skill or command file, for a rule that reports on a
// field. It gives the parsed fields and the location of each key and value.
// A rule can then report on the narrowest part.
import type { MarkdownSourceCode } from '@eslint/markdown'
import { type FrontmatterField, frontmatterFields, parseFrontmatter } from './frontmatter.ts'

type YamlNode = Parameters<MarkdownSourceCode['getRange']>[0] & { value: string }

type Loc = ReturnType<MarkdownSourceCode['getLoc']>

export interface SkillFrontmatter {
  data: Record<string, unknown>
  fields: Map<string, FrontmatterField>
  /** The file offset of the first character of the YAML text. */
  base: number
  /** The location of the YAML text from `start` to `end`. */
  at: (start: number, end: number) => Loc
}

/** The fields of the `yaml` node. Returns null when the YAML does not parse. */
export function readFrontmatter(
  sourceCode: MarkdownSourceCode,
  node: YamlNode,
): SkillFrontmatter | null {
  const data = parseFrontmatter(node.value)
  if (data === null) {
    return null
  }
  const base = sourceCode.text.indexOf(node.value, sourceCode.getRange(node)[0])
  return {
    data,
    fields: new Map(frontmatterFields(node.value).map((field) => [field.key, field])),
    base,
    at: (start, end) => ({
      start: sourceCode.getLocFromIndex(base + start),
      end: sourceCode.getLocFromIndex(base + end),
    }),
  }
}
