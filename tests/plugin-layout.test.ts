// The lists are literal copies of tables of the manifest reference and the components page. The
// source of each list is in src/data/plugin-layout.ts.
import { describe, expect, it } from 'vitest'
import {
  EVAL_CASE_SCHEMA_VERSION,
  EVAL_ENV_KEY,
  EVAL_GRADER_ARMS,
  EVAL_GRADER_TARGETS,
  EVAL_GRADER_TYPES,
  EVAL_MOCK_TYPES,
  EVAL_PROMPT_FIELDS,
  EVAL_PROMPT_LIMITS,
  PLUGIN_COMMAND_FIELDS,
  PLUGIN_COMPONENT_NAMES,
  PLUGIN_PATH_KEYS,
  PLUGIN_SETTINGS_KEYS,
  REPLACED_DEFAULTS,
  SYSTEM_COMMANDS,
  THEME_BASES,
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

describe('bases of a custom theme', () => {
  it('holds the six presets of the table, in its order', () => {
    expect(THEME_BASES).toEqual([
      'dark',
      'light',
      'dark-daltonized',
      'light-daltonized',
      'dark-ansi',
      'light-ansi',
    ])
  })
})

describe('system commands that a bin file cannot shadow', () => {
  it('holds the two commands that the docs name, and the choice of the plugin, once', () => {
    expect(SYSTEM_COMMANDS).toEqual([
      'awk',
      'bash',
      'cat',
      'cp',
      'curl',
      'find',
      'git',
      'grep',
      'ls',
      'mkdir',
      'mv',
      'rm',
      'sed',
      'sh',
      'ssh',
      'tar',
    ])
  })
})

describe('formats of an eval suite', () => {
  it('holds the thirteen fields of prompt.md, in the order of the table', () => {
    expect(EVAL_PROMPT_FIELDS).toEqual([
      'schema_version',
      'name',
      'description',
      'tags',
      'plugins',
      'runs',
      'expected_outcome',
      'model',
      'max_turns',
      'timeout_seconds',
      'allowed_tools',
      'append_system_prompt',
      'env',
    ])
  })

  it('holds the limits that the docs give, and no lower bound that they do not give', () => {
    expect([...EVAL_PROMPT_LIMITS]).toEqual([
      ['runs', { min: 1, max: 50 }],
      ['max_turns', { max: 200 }],
      ['timeout_seconds', { max: 3600 }],
    ])
  })

  it('holds the version of case.yaml and the pattern of an env key', () => {
    expect(EVAL_CASE_SCHEMA_VERSION).toBe('1.1')
    expect(EVAL_ENV_KEY.test('EVAL_A1')).toBe(true)
    expect(EVAL_ENV_KEY.test('EVAL_')).toBe(true)
    expect(EVAL_ENV_KEY.test('PATH')).toBe(false)
    expect(EVAL_ENV_KEY.test('EVAL_a')).toBe(false)
    expect(EVAL_ENV_KEY.test('XEVAL_A')).toBe(false)
    expect(EVAL_ENV_KEY.test('EVAL_A-B')).toBe(false)
    expect(EVAL_ENV_KEY.test('EVAL_A\n')).toBe(false)
  })

  it('holds the grader types, arms and targets, and the mock types, of the tables', () => {
    expect(EVAL_GRADER_TYPES).toEqual([
      'regex',
      'tool_used',
      'tool_order',
      'file_exists',
      'llm',
      'baseline',
    ])
    expect(EVAL_GRADER_ARMS).toEqual(['with-only', 'both'])
    expect(EVAL_GRADER_TARGETS).toEqual(['last_message', 'trace', 'files', 'mock_calls'])
    expect(EVAL_MOCK_TYPES).toEqual(['fixed', 'agent'])
  })
})
