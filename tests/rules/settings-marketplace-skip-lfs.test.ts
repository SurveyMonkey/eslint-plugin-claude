// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

it.fails('settings-marketplace-skip-lfs reports the case of its row', () => {
  const messages = lintJson(
    'settings-marketplace-skip-lfs',
    '{"extraKnownMarketplaces":{"acme":{"source":{"source":"github","repo":"a/b","skipLfs":true}}}}',
    '.claude/settings.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['skipLfs'])
})
