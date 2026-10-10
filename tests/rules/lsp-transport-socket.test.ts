// Red first: the rule does not exist yet, so the case is expected to fail.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

describe('lsp-transport-socket (red)', () => {
  it.fails('reports transport socket in .lsp.json at a plugin root', () => {
    const root = repo({ '.claude-plugin/plugin.json': '{"name": "p"}' })
    const code =
      '{"go": {"command": "gopls", "extensionToLanguage": {".go": "go"}, "transport": "socket"}}'
    expect(
      lintJson('lsp-transport-socket', code, path.join(root, '.lsp.json')).map((m) => m.messageId),
    ).toEqual(['socket'])
  })
})
