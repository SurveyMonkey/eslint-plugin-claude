// An entry of a `MEMORY.md` index takes one line (docs/rules/memory-index-entry-format.md). The
// docs say to keep one line for each entry, and to move detail into topic files. The
// first 200 lines or 25KB of the index load at the start of every session, so a long entry costs
// context each time. An entry is an item of a top-level list. The rule reads the syntax tree, so a
// list in a code block or in an HTML comment is not an entry. A nested item is part of its
// parent entry. The globs name the index files, so the rule checks no path itself.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'

const name = 'memory-index-entry-format' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'multiLine' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep each entry of a MEMORY.md index to one line',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      multiLine:
        'This index entry takes {{lines}} lines. Keep each entry to one line, and move the detail into a topic file.',
    },
  },
  create(context) {
    const { sourceCode } = context
    return {
      'root > list > listItem'(node) {
        const { start, end } = sourceCode.getLoc(node)
        if (end.line > start.line) {
          context.report({
            node,
            messageId: 'multiLine',
            data: { lines: String(end.line - start.line + 1) },
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
