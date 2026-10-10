// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

it.fails('settings-strict-known-marketplaces-skills-dir reports the case of its row', () => {
  const messages = lintJson(
    'settings-strict-known-marketplaces-skills-dir',
    '{"strictKnownMarketplaces":[{"source":"github","repo":"a/b"}]}',
    'managed-settings.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['missing'])
})
