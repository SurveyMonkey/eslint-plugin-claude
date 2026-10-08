// The key of an `extraKnownMarketplaces` entry must equal the `name` in the
// `marketplace.json` that its `file` or `directory` source points at
// (docs/rules/settings-extra-known-marketplaces-key-matches-name.md). The rule
// reads that file through `readMarketplaceFile`, and makes no report when it
// cannot read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { marketplacesOf, readMarketplaceFile, sourceOf } from '../marketplace-file.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-extra-known-marketplaces-key-matches-name' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'mismatch' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Key each extraKnownMarketplaces entry by the name in the marketplace.json that it points at',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      mismatch:
        'The "extraKnownMarketplaces" key "{{key}}" is not the "name" in the marketplace.json that it points at, which is "{{marketplace}}". The docs say to key a marketplace by its own "name".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const marketplaces = lastMember(node.body, 'extraKnownMarketplaces')?.value
        const declared = marketplacesOf(context.sourceCode.text)
        if (marketplaces?.type !== 'Object') {
          return
        }
        for (const member of marketplaces.members) {
          const key = keyOf(member.name)
          // Two members of one key read as the last, as `JSON.parse` does.
          if (lastMember(marketplaces, key) !== member) {
            continue
          }
          const read = readMarketplaceFile(context.filename, sourceOf(declared?.[key]))
          // A name that is missing, empty or not a string is for `marketplace-schema`.
          if (
            read.kind === 'marketplace' &&
            read.name !== undefined &&
            read.name !== '' &&
            read.name !== key
          ) {
            context.report({
              node: member.name,
              messageId: 'mismatch',
              data: { key, marketplace: read.name },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
