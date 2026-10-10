// The lists are literal copies of tables of the manifest reference and the components page. The
// source of each list is in src/data/plugin-layout.ts.
import { describe, expect, it } from 'vitest'
import {
  PLUGIN_COMMAND_FIELDS,
  PLUGIN_COMPONENT_NAMES,
  PLUGIN_PATH_KEYS,
  PLUGIN_SETTINGS_KEYS,
  REPLACED_DEFAULTS,
  USER_CONFIG_TYPES,
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

describe('fields of a command entry', () => {
  it('holds the six fields of the table, in its order', () => {
    expect(PLUGIN_COMMAND_FIELDS).toEqual([
      'source',
      'content',
      'description',
      'argumentHint',
      'model',
      'allowedTools',
    ])
  })
})

describe('types of a userConfig option', () => {
  it('holds the five types of the table, in its order', () => {
    expect(USER_CONFIG_TYPES).toEqual(['string', 'number', 'boolean', 'directory', 'file'])
  })
})
