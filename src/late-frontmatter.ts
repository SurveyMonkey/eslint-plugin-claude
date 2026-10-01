// Find a frontmatter block that is not at the start of a file. Claude Code
// reads frontmatter only when the opening `---` is line 1. `@eslint/markdown`
// gives no `yaml` node for a block below line 1, so this reads the lines.
import type { MarkdownSourceCode } from '@eslint/markdown'
import { parseFrontmatter } from './frontmatter.ts'
import { type BodyLine, unfencedLines } from './markdown-lines.ts'

// A marker line starts or ends a block. The docs name only `---` as a marker
// (https://code.claude.com/docs/en/glossary#frontmatter).
const MARKER = /^---\s*$/

/** The opening marker of a block below line 1 that has at least one of
 *  `fields`, or null. A file with frontmatter on line 1 gives null. */
export function lateFrontmatter(
  sourceCode: MarkdownSourceCode,
  fields: readonly string[],
): BodyLine | null {
  if (sourceCode.ast.children[0]?.type === 'yaml') {
    return null
  }
  // Each marker line can close one block and open the next. A horizontal
  // rule above a block must not hide the block.
  const markers = unfencedLines(sourceCode).filter((l) => MARKER.test(l.text))
  for (const [index, opening] of markers.entries()) {
    const closing = markers[index + 1]
    if (closing === undefined) {
      return null
    }
    const between = sourceCode.lines.slice(opening.line, closing.line - 1)
    const data = parseFrontmatter(between.join('\n'))
    if (data !== null && fields.some((field) => field in data)) {
      return opening
    }
  }
  return null
}
