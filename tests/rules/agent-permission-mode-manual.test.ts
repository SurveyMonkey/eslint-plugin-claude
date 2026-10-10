// The sub-agents page, "Permission modes": `manual` is an alias for `default`,
// and the page says to write the config value. Claude Code ignores
// `permissionMode` in a plugin agent, so the rule checks local agents only.
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (code: string, at = '.claude/agents/a.md') =>
  lintMarkdown('agent-permission-mode-manual', code, `${repo({})}/${at}`)

describe('agent-permission-mode-manual', () => {
  it.fails('reports manual in a local agent', () => {
    expect(lint(agent('permissionMode: manual\n'))).toMatchObject([
      { messageId: 'manual', line: 4, column: 17, endColumn: 23 },
    ])
  })

  it.fails('stays silent for default', () => {
    expect(lint(agent('permissionMode: default\n'))).toEqual([])
  })
})
