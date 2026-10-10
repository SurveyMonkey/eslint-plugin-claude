// An unescaped `$` and a digit expands to an argument, also in a price such as `$1.00`
// (docs/rules/skill-literal-dollar.md). The rule is a heuristic: it reports the digit forms that
// read as an amount, and it does not report `$ARGUMENTS`, which has no static tell.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-literal-dollar' as const

/** A `$` and digits, then a decimal point or a thousands comma and a digit. A backslash in
 *  front, single or doubled, is left to the author: one escapes the token, and
 *  `skill-argument-escape` reports two. */
const AMOUNT = /(?<!\\)\$\d+(?=[.,]\d)/g

const rule: MarkdownRuleDefinition<{ MessageIds: 'literal' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Escape a dollar amount in a skill so that it is not an argument placeholder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal:
        'Claude Code replaces `{{token}}` with an argument. Write `\\{{token}}` to keep it as text.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        // The text after the frontmatter. The block does not need to parse.
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        for (const match of sourceCode.text.slice(start).matchAll(AMOUNT)) {
          const from = start + match.index
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(from + match[0].length),
            },
            messageId: 'literal',
            data: { token: match[0] },
          })
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
