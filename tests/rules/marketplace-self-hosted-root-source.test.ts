// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import {
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  tree,
} from '../marketplace-tree.test-support.ts'

it.fails('marketplace-self-hosted-root-source reports the case of its row', () => {
  const dir = tree({ '.claude-plugin/plugin.json': manifestOf({ name: 'deploy-helper' }) })
  const code = marketplaceOf([{ name: 'deploy-helper', source: './plugins/deploy-helper' }])
  const messages = lintMarketplace('marketplace-self-hosted-root-source', dir, code)
  expect(messages.map((m) => m.messageId)).toEqual(['noRootEntry'])
})
