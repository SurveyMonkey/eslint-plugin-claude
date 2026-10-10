// A `directory` marketplace source with an absolute path in a committed `.claude/settings.json`
// (docs/rules/settings-extra-known-marketplaces-directory.md). The path names one machine. The
// docs name `directory` for development, or for a marketplace that an organization deploys to each
// machine. A relative path resolves against the repository, and the docs describe it for a
// repository (plugins/org, "Require plugins per repository"), so the rule leaves it.
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { absolute } from '../marketplace-file.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { marketplaceMember } from '../marketplace-settings.ts'

const name = 'settings-extra-known-marketplaces-directory' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'directory' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not point a committed extraKnownMarketplaces entry at a directory by an absolute path',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      directory:
        'This "directory" source names the absolute path "{{path}}", which exists on one machine. The docs name "directory" for development. Use a path relative to the repository, or a "github" or "git" source.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const marketplaces = marketplaceMember(node.body, 'extraKnownMarketplaces')?.value
        if (marketplaces?.type !== 'Object') {
          return
        }
        for (const member of marketplaces.members) {
          // Two members of one key read as the last, as `JSON.parse` does.
          if (lastMember(marketplaces, keyOf(member.name)) !== member) {
            continue
          }
          const source = lastMember(member.value, 'source')?.value
          const type = lastMember(source, 'source')?.value
          const given = lastMember(source, 'path')?.value
          if (
            type?.type === 'String' &&
            type.value === MARKETPLACE_SOURCE_TYPES.directory &&
            given?.type === 'String' &&
            absolute(given.value)
          ) {
            context.report({ node: given, messageId: 'directory', data: { path: given.value } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
