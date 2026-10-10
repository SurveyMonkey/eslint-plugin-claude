// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-project-dir-default (red)', () => {
  it.fails('reports a reference with no default', () => {
    const code = `{"mcpServers": {"a": {"command": "\${CLAUDE_PROJECT_DIR}/s"}}}`
    expect(lintJson('mcp-project-dir-default', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'noDefault',
    ])
  })
})
