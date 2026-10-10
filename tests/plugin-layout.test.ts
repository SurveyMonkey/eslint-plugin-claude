// The lists are literal copies of the "Standard layout" table and of the
// section "How each key combines with its default location" of the manifest
// reference.
import { describe, expect, it } from 'vitest'
import {
  PLUGIN_COMPONENT_NAMES,
  PLUGIN_PATH_KEYS,
  PLUGIN_SETTINGS_KEYS,
  REPLACED_DEFAULTS,
} from '../src/data/plugin-layout.ts'

describe('plugin component names', () => {
  it('holds the first part of each default location, once', () => {
    expect(PLUGIN_COMPONENT_NAMES).toEqual([
      '.lsp.json',
      '.mcp.json',
      'agents',
      'bin',
      'commands',
      'hooks',
      'monitors',
      'output-styles',
      'settings.json',
      'skills',
      'themes',
      'workflows',
    ])
  })
})

describe('keys that replace a default folder', () => {
  it('holds the six keys of the docs, each with its folder', () => {
    expect(REPLACED_DEFAULTS.map(({ key, folder }) => `${key.join('.')} -> ${folder}`)).toEqual([
      'commands -> commands',
      'agents -> agents',
      'outputStyles -> output-styles',
      'workflows -> workflows',
      'experimental.themes -> themes',
      'experimental.monitors -> monitors',
    ])
  })

  it('names a folder that is a default location', () => {
    for (const { folder } of REPLACED_DEFAULTS) {
      expect(PLUGIN_COMPONENT_NAMES).toContain(folder)
    }
  })
})

describe('plugin settings keys', () => {
  it('holds the two keys that take effect, as the docs name them', () => {
    expect(PLUGIN_SETTINGS_KEYS).toEqual(['agent', 'subagentStatusLine'])
  })
})

describe('manifest keys that name component paths', () => {
  it('holds the component keys of the Fields table that take a path, with the map flag of commands', () => {
    expect(
      PLUGIN_PATH_KEYS.map(({ key, map }) => `${key.join('.')}${map ? ' (map)' : ''}`),
    ).toEqual([
      'skills',
      'commands (map)',
      'agents',
      'hooks',
      'mcpServers',
      'lspServers',
      'outputStyles',
      'workflows',
      'experimental.themes',
      'experimental.monitors',
      'themes',
      'monitors',
    ])
  })

  it('has no key that names a path that is not a component', () => {
    const keys = PLUGIN_PATH_KEYS.map(({ key }) => key.join('.'))
    expect(keys).not.toContain('types')
    expect(keys).not.toContain('experimental.evals')
  })
})
