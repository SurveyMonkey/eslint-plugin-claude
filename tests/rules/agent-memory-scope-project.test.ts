// The sub-agents page, "Persistent memory tips": `project` is the
// recommended default scope of `memory`.
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (code: string, at = '.claude/agents/a.md') =>
  lintMarkdown('agent-memory-scope-project', code, `${repo({})}/${at}`)

describe('agent-memory-scope-project', () => {
  it.fails('reports memory: user', () => {
    expect(lint(agent('memory: user\n'))).toMatchObject([
      { messageId: 'notProject', line: 4, column: 9, endColumn: 13 },
    ])
  })

  it.fails('stays silent for memory: project', () => {
    expect(lint(agent('memory: project\n'))).toEqual([])
  })
})
