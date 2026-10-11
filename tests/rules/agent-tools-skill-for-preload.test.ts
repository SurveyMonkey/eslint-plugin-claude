// The sub-agents page, frontmatter reference, `tools`: "To preload Skills into context, use the
// `skills` field rather than listing `Skill` here". A bare `Skill` in `tools` only lets the
// subagent call the Skill tool. A `Skill(...)` entry is the report of `agent-tools-known`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'

const AGENT = path.resolve('/project/.claude/agents/a.md')
const lint = (fields: string, filename = AGENT) =>
  lintAgent('agent-tools-skill-for-preload', agent(fields), filename)

describe('agent-tools-skill-for-preload', () => {
  it('reports Skill in a tools string, on the entry', () => {
    expect(lint('tools: Read, Skill\n')).toMatchObject([
      { messageId: 'skillTool', line: 4, column: 14, endColumn: 19 },
    ])
  })

  it('reports Skill in a tools list, on the item', () => {
    expect(lint('tools:\n  - Read\n  - Skill\n')).toMatchObject([
      { messageId: 'skillTool', line: 6, column: 5, endColumn: 10 },
    ])
  })

  it('reports a plugin agent', () => {
    expect(lint('tools: Skill\n', pluginAgent())).toMatchObject([{ messageId: 'skillTool' }])
  })

  it('reports when skills is empty or has no value', () => {
    expect(lint('tools: Skill\nskills: []\n')).toHaveLength(1)
    expect(lint('tools: Skill\nskills:\n')).toHaveLength(1)
  })

  it('stays silent when skills lists a skill', () => {
    expect(lint('tools: Read, Skill\nskills:\n  - deploy\n')).toEqual([])
  })

  it('stays silent for Skill with a specifier, which agent-tools-known reports', () => {
    expect(lint('tools: Skill(deploy)\n')).toEqual([])
  })

  it('stays silent for other tools, other names and other fields', () => {
    expect(lint('tools: Read, Grep\n')).toEqual([])
    expect(lint('tools: Skills\n')).toEqual([])
    expect(lint('disallowedTools: Skill\n')).toEqual([])
    expect(lint('')).toEqual([])
    expect(lint('tools: [unclosed\n')).toEqual([])
    expect(lint('tools: Skill\n', path.resolve('/project/docs/a.md'))).toEqual([])
  })
})
