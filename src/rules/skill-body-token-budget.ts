// After compaction, Claude Code keeps the first 5,000 tokens of each invoked skill
// (docs/rules/skill-body-token-budget.md). No setting moves that number, so the option `max`
// has a schema maximum. The token count is an estimate: characters divided by 4.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-body-token-budget' as const

// The number from the docs, the default of `max`, and its schema maximum.
const COMPACTION_TOKENS = 5000

// The estimate of one token, in characters.
const CHARS_PER_TOKEN = 4

type Options = [{ max: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'overCompactionCap' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep the body of a skill within the tokens that compaction keeps',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1, maximum: COMPACTION_TOKENS },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: COMPACTION_TOKENS }],
    messages: {
      overCompactionCap:
        'The body of this file is about {{tokens}} tokens (characters divided by 4). After compaction, Claude Code keeps the first {{max}} tokens of a skill. Move reference material to supporting files.',
      overConfiguredLimit:
        'The body of this file is about {{tokens}} tokens (characters divided by 4). The configured limit is {{max}} tokens. Move reference material to supporting files.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const [{ max }] = context.options
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        // The body does not need the YAML to parse, so a bad block does not hide a long body.
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        // The line break that ends the frontmatter is not part of the body.
        const body = sourceCode.text.slice(start).replace(/^\r?\n/, '')
        const tokens = Math.ceil(body.length / CHARS_PER_TOKEN)
        if (tokens > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: max === COMPACTION_TOKENS ? 'overCompactionCap' : 'overConfiguredLimit',
            data: { tokens: String(tokens), max: String(max) },
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
