// `permissionMode: auto` in a subagent file has no effect when the settings lock auto mode off
// with `disableAutoMode: "disable"`. The settings are on disk, because the rule reads
// `.claude/settings.json` and `.claude/settings.local.json`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as rule from '../../src/rules/agent-permission-mode-auto-unavailable.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const AGENT = '.claude/agents/a.md'
const AUTO = agent('permissionMode: auto\n')
const top = (value: unknown) => JSON.stringify({ disableAutoMode: value })
const inner = (value: unknown) => JSON.stringify({ permissions: { disableAutoMode: value } })
const run = (files: Record<string, string>, code = AUTO, at = AGENT) => {
  const root = repo(files)
  return lintWith(rule, code, path.join(root, at))
}

describe('agent-permission-mode-auto-unavailable', () => {
  it('reports when the top-level disableAutoMode is "disable"', () => {
    const messages = run({ '.claude/settings.json': top('disable') })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'unavailable',
      message:
        'The settings set `disableAutoMode` to "disable", so auto mode is not available. The subagent keeps the permission mode of the main conversation.',
      line: 4,
      column: 17,
      endColumn: 21,
    })
  })

  it('reports when permissions.disableAutoMode is "disable"', () => {
    const messages = run({ '.claude/settings.json': inner('disable') })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toBe(
      'The settings set `permissions.disableAutoMode` to "disable", so auto mode is not available. The subagent keeps the permission mode of the main conversation.',
    )
  })

  it('reports one time when both places set the lock', () => {
    const settings = JSON.stringify({
      disableAutoMode: 'disable',
      permissions: { disableAutoMode: 'disable' },
    })
    const messages = run({ '.claude/settings.json': settings })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`disableAutoMode`')
  })

  it('reports when only the local file sets the lock', () => {
    const messages = run({ '.claude/settings.local.json': inner('disable') })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`permissions.disableAutoMode`')
  })

  it('reports when the local file adds the lock to the project file', () => {
    const messages = run({
      '.claude/settings.json': '{"model":"sonnet"}',
      '.claude/settings.local.json': top('disable'),
    })
    expect(messages).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    const files = { '.claude/settings.json': top('disable') }
    expect(run(files, AUTO, '.claude/agents/team/a.md')).toHaveLength(1)
  })

  it('reports a quoted auto', () => {
    const files = { '.claude/settings.json': top('disable') }
    expect(run(files, agent('permissionMode: "auto"\n'))).toHaveLength(1)
  })

  describe('stays silent', () => {
    const locked = { '.claude/settings.json': top('disable') }

    it('for a plugin agent', () => {
      expect(lintWith(rule, AUTO, pluginAgent())).toEqual([])
    })
    it('without a settings file', () => {
      expect(run({})).toEqual([])
    })
    it('when the settings leave out the lock', () => {
      expect(run({ '.claude/settings.json': '{}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"permissions":5}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"permissions":{"defaultMode":"auto"}}' })).toEqual([])
    })
    // `permissions-disable-mode-value` reports these values. Claude Code rejects them, and
    // the lock does not apply.
    for (const value of [true, 'true', 'Disable', 1, null]) {
      it(`when disableAutoMode is ${JSON.stringify(value)}`, () => {
        expect(run({ '.claude/settings.json': top(value) })).toEqual([])
        expect(run({ '.claude/settings.json': inner(value) })).toEqual([])
      })
    }
    it('when the lock is under another key', () => {
      const settings = JSON.stringify({ sandbox: { disableAutoMode: 'disable' } })
      expect(run({ '.claude/settings.json': settings })).toEqual([])
    })
    it('for another permission mode', () => {
      for (const mode of ['default', 'manual', 'acceptEdits', 'plan', 'dontAsk', 'Auto']) {
        expect(run(locked, agent(`permissionMode: ${mode}\n`))).toEqual([])
      }
    })
    it('for an agent without permissionMode, or with a value of the wrong type', () => {
      expect(run(locked, agent(''))).toEqual([])
      expect(run(locked, agent('permissionMode:\n'))).toEqual([])
      expect(run(locked, agent('permissionMode: [auto]\n'))).toEqual([])
    })
    it('for a file with no frontmatter or broken frontmatter', () => {
      expect(run(locked, 'Body only.\n')).toEqual([])
      expect(run(locked, '---\npermissionMode: [unclosed\n---\n\nBody.\n')).toEqual([])
    })
    it('for a file outside the agents folders', () => {
      expect(run(locked, AUTO, 'docs/a.md')).toEqual([])
    })
    it('when a settings file does not parse', () => {
      expect(run({ ...locked, '.claude/settings.local.json': '{' })).toEqual([])
    })
    it('when a settings file cannot be read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo(locked)
      withoutAccess(path.join(root, '.claude/settings.json'), () => {
        expect(lintWith(rule, AUTO, path.join(root, AGENT))).toEqual([])
      })
    })
  })
})
