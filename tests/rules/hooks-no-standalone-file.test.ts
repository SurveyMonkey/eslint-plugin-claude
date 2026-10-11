// Claude Code reads no standalone hooks file for project or user hooks. Only a plugin loads
// `hooks/hooks.json`, from its root (https://code.claude.com/docs/en/debug-your-config#check-hooks
// and https://code.claude.com/docs/en/plugins-reference#plugin-manifest-schema). The files exist
// on disk where the rule must read a manifest or a plugin root.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { jsonIds } from '../hooks.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-no-standalone-file'
const MANIFEST = '.claude-plugin/plugin.json'
const ids = (file: string, files: Record<string, string> = {}) => {
  const root = repo(files)
  return jsonIds(name, '{"hooks": {}}', path.join(root, file))
}

describe(`${name}: the files that Claude Code does not read`, () => {
  it('reports .claude/hooks.json and .claude/hooks/hooks.json', () => {
    expect(ids('.claude/hooks.json')).toEqual(['standalone'])
    expect(ids('.claude/hooks/hooks.json')).toEqual(['standalone'])
    expect(ids('packages/x/.claude/hooks/hooks.json')).toEqual(['standalone'])
  })

  it('reports a hooks file under .claude-plugin/, with the plugin layout in the message', () => {
    expect(ids('.claude-plugin/hooks.json')).toEqual(['pluginDir'])
    expect(ids('.claude-plugin/hooks/hooks.json')).toEqual(['pluginDir'])
    const root = repo({})
    const [message] = lintJson(name, '{}', path.join(root, '.claude-plugin/hooks.json'))
    expect(message?.message).toContain('hooks/hooks.json')
    expect(message?.message).toContain('plugin root')
  })

  it('reports a file under .claude-plugin/ that the manifest does not name', () => {
    const manifest = { [MANIFEST]: JSON.stringify({ name: 'p', hooks: './other.json' }) }
    expect(ids('.claude-plugin/hooks.json', manifest)).toEqual(['pluginDir'])
    const inline = { [MANIFEST]: JSON.stringify({ name: 'p', hooks: { Stop: [] } }) }
    expect(ids('.claude-plugin/hooks.json', inline)).toEqual(['pluginDir'])
    const plain = { [MANIFEST]: JSON.stringify({ name: 'p' }) }
    expect(ids('.claude-plugin/hooks.json', plain)).toEqual(['pluginDir'])
  })

  it('reports .claude/hooks.json even when .claude is a plugin root', () => {
    const files = { '.claude/.claude-plugin/plugin.json': '{"name": "p"}' }
    expect(ids('.claude/hooks.json', files)).toEqual(['standalone'])
  })

  it('reports at line 1, column 1', () => {
    const root = repo({})
    const found = lintJson(name, '{\n  "hooks": {}\n}', path.join(root, '.claude/hooks.json'))
    expect(found.map(({ line, column }) => [line, column])).toEqual([[1, 1]])
  })
})

describe(`${name}: the files that Claude Code reads`, () => {
  it('is silent for hooks/hooks.json at the root of a plugin', () => {
    expect(
      ids('plugins/p/hooks/hooks.json', { 'plugins/p/.claude-plugin/plugin.json': '{}' }),
    ).toEqual([])
    expect(ids('hooks/hooks.json')).toEqual([])
  })

  it('is silent for .claude/hooks/hooks.json when .claude is a plugin root', () => {
    const files = { '.claude/.claude-plugin/plugin.json': '{"name": "p"}' }
    expect(ids('.claude/hooks/hooks.json', files)).toEqual([])
  })

  it('is silent for a file under .claude-plugin/ that the manifest names', () => {
    const path1 = {
      [MANIFEST]: JSON.stringify({ name: 'p', hooks: './.claude-plugin/hooks.json' }),
    }
    expect(ids('.claude-plugin/hooks.json', path1)).toEqual([])
    const list = {
      [MANIFEST]: JSON.stringify({
        name: 'p',
        hooks: [{ Stop: [] }, './.claude-plugin/hooks/hooks.json'],
      }),
    }
    expect(ids('.claude-plugin/hooks/hooks.json', list)).toEqual([])
  })

  it('is silent for a hooks.json outside the four places, and for other files', () => {
    expect(ids('config/hooks.json')).toEqual([])
    expect(ids('hooks.json')).toEqual([])
    expect(jsonIds(name, '{}', '/repo/.claude/settings.json')).toEqual([])
  })
})

describe(`${name}: a plugin that the rule cannot see`, () => {
  it('is silent when the manifest is not an object', () => {
    const files = { [MANIFEST]: '[]' }
    expect(ids('.claude-plugin/hooks.json', files)).toEqual([])
  })

  it('is silent when .claude cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ '.claude/hooks/hooks.json': '{}' })
    const dir = path.join(root, '.claude')
    withoutAccess(dir, () => {
      expect(jsonIds(name, '{}', path.join(dir, 'hooks/hooks.json'))).toEqual([])
    })
  })
})
