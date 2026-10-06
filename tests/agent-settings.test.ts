// `localAgentSettings` gives null for each file that is not a local agent.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { envOf, isOn, localAgentSettings } from '../src/agent-settings.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
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

  it('gives null for a plugin agent, also when the plugin root holds settings', () => {
    const root = repo({
      'plugins/p/.claude-plugin/plugin.json': '{}',
      'plugins/p/settings.json': '{"agent":"a"}',
      'plugins/p/agents/a.md': '',
    })
    expect(localAgentSettings(path.join(root, 'plugins/p/agents/a.md'))).toBeNull()
  })

  it('reads the settings of the nearest .claude directory, not the root one', () => {
    const root = repo({
      '.claude/settings.json': '{"agent":"root"}',
      'pkg/.claude/settings.json': '{"agent":"pkg"}',
      'pkg/.claude/agents/a.md': '',
    })
    expect(localAgentSettings(path.join(root, 'pkg/.claude/agents/a.md'))).toEqual({ agent: 'pkg' })
  })

  it('bounds the settings read by the repository', () => {
    const outside = repo({ 'settings.json': '{"agent":"a"}' })
    const root = repo({ '.claude/agents/a.md': '' })
    symlinkSync(path.join(outside, 'settings.json'), path.join(root, '.claude/settings.json'))
    expect(localAgentSettings(path.join(root, '.claude/agents/a.md'))).toBe(UNREADABLE)
  })
})

describe('isOn', () => {
  it('accepts the strings 1 and true in any case, with outer spaces', () => {
    for (const value of ['1', 'true', 'TRUE', ' 1 ', ' True ']) {
      expect(isOn(value)).toBe(true)
    }
  })

  it('refuses every other value', () => {
    for (const value of ['0', 'false', 'yes', 'on', '', 1, true, null, undefined]) {
      expect(isOn(value)).toBe(false)
    }
  })
})

describe('envOf', () => {
  it('gives the env object', () => {
    expect(envOf({ env: { A: '1' } })).toEqual({ A: '1' })
  })

  it('gives an empty object when env is not an object', () => {
    for (const env of [null, ['A'], 'A', 5, undefined]) {
      expect(envOf({ env })).toEqual({})
    }
  })
})
