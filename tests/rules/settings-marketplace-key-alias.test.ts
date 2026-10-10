// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

it.fails('settings-marketplace-key-alias reports the case of its row', () => {
  const messages = lintJson(
    'settings-marketplace-key-alias',
    '{"additionalMarketplaces":{}}',
    '.claude/settings.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['alias'])
})
