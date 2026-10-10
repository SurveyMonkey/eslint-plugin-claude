// The sub-agents page marks `omitClaudeMd` (v2.1.271) and
// `experimental.cacheTtl` (v2.1.248) with the version that adds them. The
// changelog adds the `manual` alias of `permissionMode` in v2.1.200, and the
// Boolean forms in v2.1.218.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'

const file = '/repo/.claude/agents/a.md'

describe('agent-field-min-version', () => {
  it.fails('reports omitClaudeMd when minVersion is below 2.1.271', () => {
    const messages = lintRule(
      'agent-field-min-version',
      [{ minVersion: '2.1.270' }],
      agentText('omitClaudeMd: true\n'),
      file,
    )
    expect(messages).toMatchObject([{ messageId: 'needsVersion', line: 4, column: 1 }])
  })

  it.fails('stays silent when minVersion is 2.1.271', () => {
    const messages = lintRule(
      'agent-field-min-version',
      [{ minVersion: '2.1.271' }],
      agentText('omitClaudeMd: true\n'),
      file,
    )
    expect(messages).toEqual([])
  })

  it.fails('stays silent when minVersion is not set', () => {
    expect(
      lintRule('agent-field-min-version', [], agentText('omitClaudeMd: true\n'), file),
    ).toEqual([])
  })
})
