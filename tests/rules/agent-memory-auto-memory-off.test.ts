// `memory` in a subagent file needs auto memory. The settings can turn auto
// memory off with `autoMemoryEnabled` or with `CLAUDE_CODE_DISABLE_AUTO_MEMORY`.
// The settings are on disk, because the rule reads `.claude/settings.json`
// and `.claude/settings.local.json`.
import { rmSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import rule from '../../src/rules/agent-memory-auto-memory-off.ts'
import { agent, lintWith, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const AGENT = '.claude/agents/a.md'
const DISABLE = 'CLAUDE_CODE_DISABLE_AUTO_MEMORY'
const flag = (value: unknown) => JSON.stringify({ autoMemoryEnabled: value })
const env = (value: unknown) => JSON.stringify({ env: { [DISABLE]: value } })
const run = (files: Record<string, string>, code = agent('memory: project\n'), at = AGENT) => {
  const root = repo(files)
  return lintWith(rule, code, path.join(root, at))
}

describe('agent-memory-auto-memory-off', () => {
  it('reports when autoMemoryEnabled is false', () => {
    const messages = run({ '.claude/settings.json': flag(false) })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'off', line: 4, column: 1, endColumn: 16 })
  })

  for (const value of [0, '', null, 'false']) {
    it(`stays silent when autoMemoryEnabled is ${JSON.stringify(value)}`, () => {
      expect(run({ '.claude/settings.json': flag(value) })).toEqual([])
    })
  }

  for (const value of ['1', 'true', 'TRUE']) {
    it(`reports when ${DISABLE} is ${value}`, () => {
      expect(run({ '.claude/settings.json': env(value) })).toHaveLength(1)
    })
  }

  for (const scope of ['user', 'project', 'local']) {
    it(`reports the scope ${scope}`, () => {
      const code = agent(`memory: ${scope}\n`)
      expect(run({ '.claude/settings.json': flag(false) }, code)).toHaveLength(1)
    })
  }

  it('reports when the local file turns auto memory off', () => {
    const messages = run({
      '.claude/settings.json': flag(true),
      '.claude/settings.local.json': flag(false),
    })
    expect(messages).toHaveLength(1)
  })

  it('reports an agent in a subfolder of agents', () => {
    const files = { '.claude/settings.json': flag(false) }
    expect(run(files, agent('memory: user\n'), '.claude/agents/team/a.md')).toHaveLength(1)
  })

  describe('stays silent', () => {
    const off = { '.claude/settings.json': flag(false) }

    it('for a plugin agent', () => {
      expect(lintWith(rule, agent('memory: project\n'), pluginAgent())).toEqual([])
    })
    it('without a settings file', () => {
      expect(run({})).toEqual([])
    })
    it('when the settings leave out both keys', () => {
      expect(run({ '.claude/settings.json': '{}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"env":{"OTHER":"1"}}' })).toEqual([])
      expect(run({ '.claude/settings.json': '{"env":5}' })).toEqual([])
    })
    it('when the settings keep auto memory on', () => {
      expect(run({ '.claude/settings.json': flag(true) })).toEqual([])
      expect(run({ '.claude/settings.json': flag('false') })).toEqual([])
      expect(run({ '.claude/settings.json': env('0') })).toEqual([])
      expect(run({ '.claude/settings.json': env('false') })).toEqual([])
    })
    it('when the local file overrides autoMemoryEnabled to true', () => {
      expect(run({ ...off, '.claude/settings.local.json': flag(true) })).toEqual([])
    })
    it('when the local file overrides the variable to a safe value', () => {
      const files = { '.claude/settings.json': env('1'), '.claude/settings.local.json': env('0') }
      expect(run(files)).toEqual([])
    })
    it('for an agent without memory, or with a scope the docs do not list', () => {
      expect(run(off, agent(''))).toEqual([])
      expect(run(off, agent('memory:\n'))).toEqual([])
      expect(run(off, agent('memory: team\n'))).toEqual([])
    })
    it('for a memory of the wrong type', () => {
      expect(run(off, agent('memory: 5\n'))).toEqual([])
      expect(run(off, agent('memory: [user]\n'))).toEqual([])
    })
    it('for a file with no frontmatter or broken frontmatter', () => {
      expect(run(off, 'Body only.\n')).toEqual([])
      expect(run(off, '---\nmemory: [unclosed\n---\n\nBody.\n')).toEqual([])
    })
    it('for a file outside the agents folders', () => {
      expect(run(off, agent('memory: user\n'), 'docs/a.md')).toEqual([])
    })
    it('when a settings file does not parse', () => {
      expect(run({ '.claude/settings.json': '{' })).toEqual([])
    })
    it('when a settings file cannot be read', () => {
      if (chmodCannotBlock) {
        return
      }
      const root = repo(off)
      withoutAccess(path.join(root, '.claude/settings.json'), () => {
        expect(lintWith(rule, agent('memory: project\n'), path.join(root, AGENT))).toEqual([])
      })
    })
  })

  // A `.claude` link goes to a directory out of the repository. The rule reads no file there.
  it('stays silent when .claude is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'settings.json': flag(false) })
    // Remove its `.git`. The old walk from the real path would take it as the repository.
    rmSync(path.join(outside, '.git'), { recursive: true })
    symlinkSync(outside, path.join(root, '.claude'))
    expect(lintWith(rule, agent('memory: project\n'), path.join(root, AGENT))).toEqual([])
  })

  it('reports when .claude is a real directory', () => {
    expect(run({ '.claude/settings.json': flag(false) })).toHaveLength(1)
  })
})
