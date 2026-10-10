// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

it.fails('marketplace-command-source reports the case of its row', () => {
  const messages = lintJson(
    'marketplace-command-source',
    '{"plugins":[{"name":"p","source":{"source":"command","command":"my-tool"}}]}',
    '.claude-plugin/marketplace.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['review'])
})
