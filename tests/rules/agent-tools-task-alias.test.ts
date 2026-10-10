// The sub-agents page: version 2.1.63 renamed the Task tool to Agent. A
// `Task(...)` entry still works as an alias.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'

describe('agent-tools-task-alias', () => {
  it.fails('reports Task in tools', () => {
    const messages = lintRule('agent-tools-task-alias', [], agentText('tools: Task, Read\n'), file)
    expect(messages).toMatchObject([{ messageId: 'alias', line: 4 }])
  })

  it.fails('stays silent for Agent', () => {
    expect(lintRule('agent-tools-task-alias', [], agentText('tools: Agent, Read\n'), file)).toEqual(
      [],
    )
  })
})
