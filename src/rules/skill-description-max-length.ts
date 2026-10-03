// The Claude Code skill listing cuts `description` plus `when_to_use` at 1,536
// characters (docs/rules/skill-description-max-length.md). The option
// `listingMax` sets a stricter limit. The schema refuses a value above the cut.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { parseFrontmatter, stringField } from '../frontmatter.ts'

const name = 'skill-description-max-length' as const

// The documented cut, the default of `listingMax` and its largest value.
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
          listingMax: { type: 'integer', minimum: 1, maximum: LISTING_CUT },
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
            // At a team value the skill listing does not cut at the limit.
            messageId: listingMax === LISTING_CUT ? 'listingTruncated' : 'overConfiguredLimit',
            data: { length: String(listing), max: String(listingMax) },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
