// Emphasis on many lines of a CLAUDE.md (docs/rules/claude-md-emphasis-overuse.md). The best
// practices page says to add emphasis such as "IMPORTANT" to a line that Claude does not follow,
// and warns that if you emphasize many lines, none of them stands out. The docs give no number,
// so the rule has the option `max` and no default. It makes no report when the option is not
// set. The rule counts lines, not words. The syntax tree decides what is prose, so a word in a
// code span, a code block or an HTML comment does not count.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-emphasis-overuse' as const

type Options = [{ max?: number }]

// The words of emphasis, in capitals, as whole words.
const EMPHASIS = /\b(?:IMPORTANT|CRITICAL|MUST|NEVER|ALWAYS|SHALL|REQUIRED|DO NOT)\b/g

/** True when `text`, the source of a strong or emphasis span, has at least three letters and
 *  all of them are capitals. */
function isCapitals(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '')
  return letters.length >= 3 && letters === letters.toUpperCase()
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'tooMany' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not use emphasis words on many lines of a CLAUDE.md',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      tooMany:
        '{{count}} lines of this file use emphasis words such as IMPORTANT or MUST. The configured limit is {{max}} lines. If you emphasize many lines, none of them stands out.',
    },
  },
  create(context) {
    const [{ max }] = context.options
    const kind = classifyMemoryFile(context.filename)
    if (max === undefined || (kind !== 'claude-md' && kind !== 'claude-local')) {
      return {}
    }
    const { sourceCode } = context
    const lines = new Set<number>()

    return {
      text(node) {
        const from = sourceCode.getRange(node)[0]
        for (const match of sourceCode.getText(node).matchAll(EMPHASIS)) {
          lines.add(sourceCode.getLocFromIndex(from + match.index).line)
        }
      },
      'strong, emphasis'(node) {
        const source = sourceCode.getText(node).replace(/^[*_]+|[*_]+$/g, '')
        if (isCapitals(source)) {
          lines.add(sourceCode.getLoc(node).start.line)
        }
      },
      'root:exit'() {
        if (lines.size <= max) {
          return
        }
        // The first line past the limit, in the order of the file.
        const line = [...lines].sort((a, b) => a - b)[max] as number
        const text = sourceCode.lines[line - 1] as string
        context.report({
          loc: { start: { line, column: 1 }, end: { line, column: text.length + 1 } },
          messageId: 'tooMany',
          data: { count: String(lines.size), max: String(max) },
        })
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md'],
  rule,
}
