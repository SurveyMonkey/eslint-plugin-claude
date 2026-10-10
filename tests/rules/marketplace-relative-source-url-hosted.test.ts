// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintMarketplace, marketplaceOf, tree } from '../marketplace-tree.test-support.ts'

it.fails('marketplace-relative-source-url-hosted reports the case of its row', () => {
  const settings = JSON.stringify({
    extraKnownMarketplaces: {
      acme: { source: { source: 'url', url: 'https://plugins.example.com/marketplace.json' } },
    },
  })
  const dir = tree({ '.claude/settings.json': settings })
  const code = marketplaceOf([{ name: 'p', source: './plugins/p' }])
  const messages = lintMarketplace('marketplace-relative-source-url-hosted', dir, code)
  expect(messages.map((m) => m.messageId)).toEqual(['relativeInUrl'])
})
