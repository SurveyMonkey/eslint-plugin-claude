// The Claude Code skill listing cuts `description` plus `when_to_use` at 1,536
// characters (docs/rules/skill-description-max-length.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { parseFrontmatter, stringField } from '../frontmatter.ts'

const name = 'skill-description-max-length' as const

type Options = [{ listingMax: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'listingTruncated'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Limit the length of a skill description',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          listingMax: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ listingMax: 1536 }],
    messages: {
      listingTruncated:
        '`description` plus `when_to_use` has {{length}} characters. The skill listing cuts it at {{max}}.',
    },
  },
  create(context) {
    const [{ listingMax }] = context.options
    return {
      yaml(node) {
        const data = parseFrontmatter(node.value)
        if (data === null) {
          return
        }
        const listing =
          stringField(data, 'description').length + stringField(data, 'when_to_use').length
        if (listing > listingMax) {
          context.report({
            node,
            messageId: 'listingTruncated',
            data: { length: String(listing), max: String(listingMax) },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
