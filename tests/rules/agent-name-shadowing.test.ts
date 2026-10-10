// The sub-agents page, "Choose the subagent scope": project subagents are
// found from the working directory up to the repository root. When several
// of these directories define one `name`, the closest one wins. The files
// are on disk, because the rule reads the agents of the folders above.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { agent, repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (root: string, at: string, code = agent('', 'dup')) =>
  lintMarkdown('agent-name-shadowing', code, path.join(root, at))

describe('agent-name-shadowing', () => {
  it.fails('reports a nested agent with the name of an agent at the repository root', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'dup') })
    const messages = lint(root, 'pkg/.claude/agents/a.md')
    expect(messages).toMatchObject([{ messageId: 'shadows', line: 2, column: 7, endColumn: 10 }])
    expect(messages[0]?.message).toContain('`../../.claude/agents/top.md`')
  })

  it.fails('stays silent for an agent that no folder above shadows', () => {
    const root = repo({ '.claude/agents/top.md': agent('', 'other') })
    expect(lint(root, 'pkg/.claude/agents/a.md')).toEqual([])
  })
})
