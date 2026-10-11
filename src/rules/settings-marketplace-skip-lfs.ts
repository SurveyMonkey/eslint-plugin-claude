// A `skipLfs` field in the `source` of an `extraKnownMarketplaces` entry has no effect
// (docs/rules/settings-marketplace-skip-lfs.md). Claude Code accepts the field and ignores it from
// v2.1.274. The rule reads the project settings files and the managed settings files.
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { marketplaceMember } from '../marketplace-settings.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-marketplace-skip-lfs' as const

/** The source types that take `skipLfs` (the marketplace reference, "Fields by type"). */
const TYPES: readonly string[] = [MARKETPLACE_SOURCE_TYPES.github, MARKETPLACE_SOURCE_TYPES.git]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'skipLfs' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Remove skipLfs from a marketplace source, because Claude Code ignores it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skipLfs:
        'Claude Code accepts "skipLfs" and ignores it from v2.1.274. It never downloads Git LFS content when it clones a marketplace. Remove the field.',
    },
  },
  create(context) {
    return {
      Document(node) {
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
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
          const skipLfs = lastMember(source, 'skipLfs')
          if (skipLfs !== undefined && type?.type === 'String' && TYPES.includes(type.value)) {
            context.report({ node: skipLfs.name, messageId: 'skipLfs' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
