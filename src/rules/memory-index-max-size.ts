// The size of the `MEMORY.md` index of a subagent (docs/rules/memory-index-max-size.md). Claude
// Code loads the first 200 lines or 25KB of the index, whichever comes first, and drops the rest.
// It strips YAML frontmatter and block-level HTML comments before the index loads, so they do not
// count. The rule counts what is left. It checks the lines and the bytes apart. The docs do not
// say whether 25KB is 25,000 or 25,600 bytes, so the rule uses 25,000, the stricter number.
import type { MarkdownRuleDefinition, MarkdownSourceCode } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { lineCount } from '../memory-files.ts'

const name = 'memory-index-max-size' as const

// The limits in the docs, and the defaults of the options. The docs show no setting that moves
// them, so the schema sets them as the maximums.
const LINES = 200
const BYTES = 25000

type Options = [{ maxLines: number; maxBytes: number }]

type Tree = { type: string; value?: string; children?: Tree[] }
type Node = Parameters<MarkdownSourceCode['getLoc']>[0]

// The nodes that hold blocks. An `html` node below another node is inline HTML, in a paragraph.
const CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem'])

/** The first line and the last line of each block-level HTML comment under `node`. A block
 *  comment ends at the line that holds `-->`, so it takes whole lines. */
function commentRanges(sourceCode: MarkdownSourceCode, node: Tree, found: [number, number][]) {
  for (const child of node.children as Tree[]) {
    if (child.type === 'html' && (child.value as string).trimStart().startsWith('<!--')) {
      const { start, end } = sourceCode.getLoc(child as Node)
      found.push([start.line, end.line])
    } else if (CONTAINERS.has(child.type)) {
      commentRanges(sourceCode, child, found)
    }
  }
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooManyLines' | 'overConfiguredLines' | 'tooManyBytes' | 'overConfiguredBytes'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a MEMORY.md index within 200 lines and 25,000 bytes',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxLines: { type: 'integer', minimum: 1, maximum: LINES },
          maxBytes: { type: 'integer', minimum: 1, maximum: BYTES },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxLines: LINES, maxBytes: BYTES }],
    messages: {
      tooManyLines:
        'This index has {{size}} lines after the frontmatter and block comments are removed. Claude Code loads the first {{max}} lines and drops the rest. Move detail into topic files.',
      overConfiguredLines: 'This index has {{size}} lines. The configured limit is {{max}} lines.',
      tooManyBytes:
        'This index has {{size}} bytes after the frontmatter and block comments are removed. Claude Code loads the first {{max}} bytes and drops the rest. Move detail into topic files.',
      overConfiguredBytes: 'This index has {{size}} bytes. The configured limit is {{max}} bytes.',
    },
  },
  create(context) {
    const [{ maxLines, maxBytes }] = context.options
    const { sourceCode } = context
    return {
      root() {
        const ast = sourceCode.ast as unknown as Tree
        // Lines that Claude Code removes: the frontmatter, and each block comment.
        const removed = new Set<number>()
        const front = (ast.children as Tree[])[0]
        if (front?.type === 'yaml') {
          const { end } = sourceCode.getLoc(front as Node)
          for (let line = 1; line <= end.line; line++) {
            removed.add(line)
          }
        }
        const comments: [number, number][] = []
        commentRanges(sourceCode, ast, comments)
        for (const [from, to] of comments) {
          for (let line = from; line <= to; line++) {
            removed.add(line)
          }
        }
        let lines = 0
        let bytes = 0
        const total = lineCount(sourceCode.text)
        for (let line = 1; line <= total; line++) {
          if (!removed.has(line)) {
            lines++
            const from = sourceCode.getIndexFromLoc({ line, column: 1 })
            const to =
              line < sourceCode.lines.length
                ? sourceCode.getIndexFromLoc({ line: line + 1, column: 1 })
                : sourceCode.text.length
            bytes += Buffer.byteLength(sourceCode.text.slice(from, to), 'utf8')
          }
        }
        const at = { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } }
        if (lines > maxLines) {
          context.report({
            loc: at,
            messageId: maxLines === LINES ? 'tooManyLines' : 'overConfiguredLines',
            data: { size: String(lines), max: String(maxLines) },
          })
        }
        if (bytes > maxBytes) {
          context.report({
            loc: at,
            messageId: maxBytes === BYTES ? 'tooManyBytes' : 'overConfiguredBytes',
            data: { size: String(bytes), max: String(maxBytes) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/agent-memory/*/MEMORY.md'],
  rule,
}
