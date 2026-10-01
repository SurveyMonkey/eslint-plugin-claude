// The inline `!` command placeholder runs only at the start of a line or after
// whitespace (docs/rules/skill-inject-bang-position.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { unfencedLines } from '../markdown-lines.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-inject-bang-position' as const

// A placeholder after a character that is not whitespace. A backtick before
// the `!` is the form of an inline code example, so it does not count.
const MISPLACED = /[^\s`](!`[^`]+`)/g

const rule: MarkdownRuleDefinition<{ MessageIds: 'literal' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put an inline command placeholder at the start of a line or after whitespace',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal:
        'A `!` command placeholder runs only at the start of a line or after whitespace. Here it stays literal text.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    // The ranges of inline code spans. A `!` inside a span is code text.
    const spans: [number, number][] = []
    return {
      inlineCode(node) {
        spans.push(sourceCode.getRange(node))
      },
      'root:exit'(node) {
        const first = node.children[0]
        let after = 0
        if (first?.type === 'yaml') {
          if (readFrontmatter(sourceCode, first) === null) {
            return
          }
          after = sourceCode.getLoc(first).end.line
        }
        for (const { text, offset } of unfencedLines(sourceCode, after)) {
          for (const match of text.matchAll(MISPLACED)) {
            const placeholder = match[1] as string
            const from = offset + match.index + 1
            if (spans.some(([start, end]) => from >= start && from < end)) {
              continue
            }
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(from),
                end: sourceCode.getLocFromIndex(from + placeholder.length),
              },
              messageId: 'literal',
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
