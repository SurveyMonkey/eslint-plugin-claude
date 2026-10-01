// The lines of a Markdown file that are not in fenced code. A rule that
// reads the text of the body asks here which lines to skip. It would see a
// line of fenced code as any other line.
import type { MarkdownSourceCode } from '@eslint/markdown'

export interface BodyLine {
  /** 1-based line number. */
  line: number
  text: string
  /** The offset of the first character of the line. */
  offset: number
}

type Tree = { type: string; children?: Tree[] }

/** The line ranges of the fenced code blocks under `node`. */
function fencedRanges(sourceCode: MarkdownSourceCode, node: Tree, found: [number, number][]) {
  if (node.type === 'code') {
    const typed = node as Parameters<MarkdownSourceCode['getRange']>[0]
    const start = sourceCode.getRange(typed)[0]
    if (sourceCode.text.startsWith('```', start) || sourceCode.text.startsWith('~~~', start)) {
      const { start: from, end: to } = sourceCode.getLoc(typed)
      found.push([from.line, to.line])
    }
  }
  for (const child of node.children ?? []) {
    fencedRanges(sourceCode, child, found)
  }
}

/** Each line after line `after`, except the lines of fenced code. */
export function unfencedLines(sourceCode: MarkdownSourceCode, after = 0): BodyLine[] {
  const fences: [number, number][] = []
  fencedRanges(sourceCode, sourceCode.ast, fences)
  const lines: BodyLine[] = []
  for (const [index, text] of sourceCode.lines.entries()) {
    const line = index + 1
    if (line > after && !fences.some(([from, to]) => line >= from && line <= to)) {
      lines.push({ line, text, offset: sourceCode.getIndexFromLoc({ line, column: 1 }) })
    }
  }
  return lines
}
