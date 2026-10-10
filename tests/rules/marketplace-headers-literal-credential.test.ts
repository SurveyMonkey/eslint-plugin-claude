// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

it.fails('marketplace-headers-literal-credential reports the case of its row', () => {
  const messages = lintJson(
    'marketplace-headers-literal-credential',
    '{"plugins":[{"name":"p","source":{"source":"archive","url":"https://x.test/p.zip"},"headers":{"Authorization":"Bearer abc123"}}]}',
    '.claude-plugin/marketplace.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['literal'])
})
