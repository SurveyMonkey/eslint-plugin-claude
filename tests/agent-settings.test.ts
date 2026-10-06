// `localAgentSettings` gives null for each file that is not a local agent.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { localAgentSettings } from '../src/agent-settings.ts'
import { repo } from './agent-settings.test-support.ts'

const SETTINGS = { '.claude/settings.json': '{"agent":"a"}' }

describe('localAgentSettings', () => {
  it('gives the settings of a local agent', () => {
    const root = repo({ ...SETTINGS, '.claude/agents/a.md': '' })
    expect(localAgentSettings(path.join(root, '.claude/agents/a.md'))).toEqual({ agent: 'a' })
  })

  it('gives null for a file that is no agent file', () => {
    const root = repo({ ...SETTINGS, '.claude/notes/a.md': '' })
    expect(localAgentSettings(path.join(root, '.claude/notes/a.md'))).toBeNull()
  })

  it('gives null for a plugin agent in a plugin root', () => {
    const root = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'plugins/p/agents/a.md': '' })
    expect(localAgentSettings(path.join(root, 'plugins/p/agents/a.md'))).toBeNull()
  })

  it('gives null for a plugin agent below a local agents directory', () => {
    const root = repo({
      ...SETTINGS,
      '.claude/agents/p/.claude-plugin/plugin.json': '{}',
      '.claude/agents/p/agents/a.md': '',
    })
    expect(localAgentSettings(path.join(root, '.claude/agents/p/agents/a.md'))).toBeNull()
  })
})
