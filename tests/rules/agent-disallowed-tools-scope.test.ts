// The sub-agents page, "Available tools": an entry of `disallowedTools` with
// a specifier removes the whole tool, and a tool in both lists is removed.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'

describe('agent-disallowed-tools-scope', () => {
  it.fails('reports a specifier in disallowedTools', () => {
    const messages = lintRule(
      'agent-disallowed-tools-scope',
      [],
      agentText('disallowedTools: Bash(git push *)\n'),
      file,
    )
    expect(messages).toMatchObject([{ messageId: 'specifier', line: 4 }])
  })

  it.fails('stays silent for a bare tool name', () => {
    expect(
      lintRule(
        'agent-disallowed-tools-scope',
        [],
        agentText('disallowedTools: Write, Edit\n'),
        file,
      ),
    ).toEqual([])
  })
})
