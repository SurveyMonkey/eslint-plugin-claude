// The sub-agents page, "Available tools": a background subagent keeps only a
// set of built-in tools, and the background is the default. A subagent at
// the depth limit has no `Agent` tool.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'

describe('agent-tools-conditional', () => {
  it.fails('reports a tool that a background subagent loses', () => {
    const messages = lintRule(
      'agent-tools-conditional',
      [],
      agentText('tools: Read, CronCreate\n'),
      file,
    )
    expect(messages).toMatchObject([{ messageId: 'background', line: 4 }])
  })

  it.fails('stays silent when background is true', () => {
    expect(
      lintRule(
        'agent-tools-conditional',
        [],
        agentText('background: true\ntools: Read, CronCreate\n'),
        file,
      ),
    ).toEqual([])
  })
})
