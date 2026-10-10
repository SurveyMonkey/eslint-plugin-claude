// Red first: the rule does not exist yet, so the case is expected to fail.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

describe('lsp-json-schema (red)', () => {
  it.fails('reports a server with no command in .lsp.json at a plugin root', () => {
    const root = repo({ '.claude-plugin/plugin.json': '{"name": "p"}' })
    const code = '{"go": {"extensionToLanguage": {".go": "go"}}}'
    expect(
      lintJson('lsp-json-schema', code, path.join(root, '.lsp.json')).map((m) => m.messageId),
    ).toEqual(['missing'])
  })
})
