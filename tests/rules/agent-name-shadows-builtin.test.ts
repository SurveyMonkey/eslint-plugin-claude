// The sub-agents page: a project or user subagent named `Explore` overrides
// the built-in subagent of that name.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'

describe('agent-name-shadows-builtin', () => {
  it.fails('reports a name that equals a built-in subagent', () => {
    const messages = lintRule('agent-name-shadows-builtin', [], agentText('', 'Explore'), file)
    expect(messages).toMatchObject([{ messageId: 'shadows', line: 2 }])
  })

  it.fails('stays silent for another name', () => {
    expect(lintRule('agent-name-shadows-builtin', [], agentText('', 'explorer'), file)).toEqual([])
  })

  it.fails('stays silent for a name in the allow option', () => {
    expect(
      lintRule(
        'agent-name-shadows-builtin',
        [{ allow: ['Explore'] }],
        agentText('', 'Explore'),
        file,
      ),
    ).toEqual([])
  })
})
