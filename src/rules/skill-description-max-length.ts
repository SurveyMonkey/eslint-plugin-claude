// The Claude Code skill listing cuts `description` plus `when_to_use` at 1,536
// characters (docs/rules/skill-description-max-length.md). The option
// `listingMax` sets another limit. The setting `skillListingMaxDescChars` moves
// the cut, so the schema sets no maximum.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { parseFrontmatter, stringField } from '../frontmatter.ts'

const name = 'skill-description-max-length' as const

// The documented default cut, and the default of `listingMax`.
const LISTING_CUT = 1536

type Options = [{ listingMax: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'listingTruncated' | 'overConfiguredLimit'
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
    defaultOptions: [{ listingMax: LISTING_CUT }],
    messages: {
      listingTruncated:
        '`description` plus `when_to_use` has {{length}} characters. The skill listing cuts it at {{max}}.',
      overConfiguredLimit:
        '`description` plus `when_to_use` has {{length}} characters. The configured limit is {{max}}.',
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
            // At another value, the message names the configured limit and claims no cut.
            messageId: listingMax === LISTING_CUT ? 'listingTruncated' : 'overConfiguredLimit',
            data: { length: String(listing), max: String(listingMax) },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
