// Red first: the rule is not built yet, so ESLint reports "Definition for rule not found",
// which has no `messageId`. The `.fails` mark goes away with the rule.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { expect, it } from 'vitest'
import plugin from '../../src/index.ts'

it.fails('marketplace-min-version reports a feature above the configured version', () => {
  const file = path.resolve('.claude-plugin/marketplace.json')
  const messages = new Linter({ cwd: path.parse(file).root }).verify(
    '{"plugins":[{"name":"p","source":"./p","metadata":{}}]}',
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { 'claude/marketplace-min-version': ['error', { minVersion: '2.1.99' }] },
      },
    ],
    { filename: file },
  )
  expect(messages.map((m) => m.messageId)).toEqual(['tooNew'])
})
