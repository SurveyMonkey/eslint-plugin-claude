// A numbered procedure of many steps in a CLAUDE.md (docs/rules/claude-md-procedure-to-skill.md).
// The docs say that a multi-step procedure belongs in a skill or a path-scoped rule, because
// CLAUDE.md holds the facts that Claude needs in every session. The docs give no number, so the
// rule has the option `maxSteps` and no default. It makes no report when the option is not set.
// The syntax tree decides what a list is, so a numbered line in a code block does not count.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-procedure-to-skill' as const

type Options = [{ maxSteps?: number }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'tooManySteps' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Move a long numbered procedure from CLAUDE.md into a skill or a scoped rule',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { maxSteps: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      tooManySteps:
        'This numbered list has {{count}} steps. The configured limit is {{max}} steps. Move a long procedure into a skill or a path-scoped rule. Claude loads these only when it needs them.',
    },
  },
  create(context) {
    const [{ maxSteps }] = context.options
    const kind = classifyMemoryFile(context.filename)
    if (maxSteps === undefined || (kind !== 'claude-md' && kind !== 'claude-local')) {
      return {}
    }
    return {
      list(node) {
        if (node.ordered && node.children.length > maxSteps) {
          context.report({
            node,
            messageId: 'tooManySteps',
            data: { count: String(node.children.length), max: String(maxSteps) },
          })
        }
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
