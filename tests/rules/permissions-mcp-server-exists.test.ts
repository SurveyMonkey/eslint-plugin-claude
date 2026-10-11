// A rule `mcp__plugin_<plugin>_<server>` names a server of a plugin that the project must enable
// (https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers). `mcp-tool-server-unknown`
// owns the other `mcp__<server>` names of a project file, so this rule reads plugin names only.
// The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-mcp-server-exists'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'

const text = (code: unknown) => (typeof code === 'string' ? code : JSON.stringify(code))
const lint = (root: string, file: string, code: unknown) =>
  lintJson(name, text(code), path.join(root, file))
const ids = (root: string, file: string, code: unknown) =>
  lint(root, file, code).map((message) => message.messageId)
const rules = (...allow: string[]) => ({ permissions: { allow } })
const enabled = (plugins: Record<string, boolean>, ...allow: string[]) => ({
  enabledPlugins: plugins,
  ...rules(...allow),
})

describe(`${name}: reports`, () => {
  it('reports a plugin tool when the project enables other plugins only', () => {
    const code = enabled({ 'lint@acme': true }, 'mcp__plugin_ghost_search__query')
    for (const file of [PROJECT, LOCAL]) {
      expect(ids(repo({}), file, code), file).toEqual(['unknown'])
    }
  })

  it('reports a deny rule and an ask rule, and a rule for the server alone', () => {
    const code = {
      enabledPlugins: { 'lint@acme': true },
      permissions: {
        deny: ['mcp__plugin_ghost_search'],
        ask: ['mcp__plugin_ghost_search__query'],
      },
    }
    expect(ids(repo({}), PROJECT, code)).toEqual(['unknown', 'unknown'])
  })

  it('reports a plugin that the project sets to false', () => {
    const code = enabled({ 'ghost@acme': false }, 'mcp__plugin_ghost_search__query')
    expect(ids(repo({}), PROJECT, code)).toEqual(['unknown'])
  })

  it('names the tool and the server, at the rule', () => {
    const code = enabled({ 'lint@acme': true }, 'mcp__plugin_ghost_search__query')
    const [message] = lint(repo({}), PROJECT, code)
    expect(message).toMatchObject({ line: 1, messageId: 'unknown' })
    expect(message?.message).toContain('"mcp__plugin_ghost_search__query"')
    expect(message?.message).toContain('"plugin_ghost_search"')
    expect(message?.message).toContain('enabledPlugins')
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for a plugin that the same file enables', () => {
    const code = enabled({ 'ghost@acme': true }, 'mcp__plugin_ghost_search__query')
    expect(ids(repo({}), PROJECT, code)).toEqual([])
  })

  it('stays silent for a plugin that the other project file enables', () => {
    const other = repo({ [LOCAL]: text({ enabledPlugins: { 'ghost@acme': true } }) })
    expect(ids(other, PROJECT, enabled({}, 'mcp__plugin_ghost_search__query'))).toEqual([])
    const first = repo({ [PROJECT]: text({ enabledPlugins: { 'ghost@acme': true } }) })
    expect(ids(first, LOCAL, rules('mcp__plugin_ghost_search__query'))).toEqual([])
  })

  it('reads the plugin part as the docs write it: other characters become underscores', () => {
    const code = enabled({ 'my.plugin@acme': true }, 'mcp__plugin_my_plugin_db-tools__query')
    expect(ids(repo({}), PROJECT, code)).toEqual([])
  })

  it('stays silent when an enabled plugin name can start the server part', () => {
    // `my` and `plugin_srv` is one reading of the name. The rule cannot tell the plugin part
    // from the server part, so it accepts every plugin name that fits.
    const code = enabled({ 'my@acme': true }, 'mcp__plugin_my_plugin_srv__tool')
    expect(ids(repo({}), PROJECT, code)).toEqual([])
  })

  it('reads a key with no marketplace as a plugin name, and a key with no name as none', () => {
    const named = enabled({ ghost: true }, 'mcp__plugin_ghost_search__query')
    expect(ids(repo({}), PROJECT, named)).toEqual([])
    const empty = enabled({ '@acme': true }, 'mcp__plugin_ghost_search__query')
    expect(ids(repo({}), PROJECT, empty)).toEqual(['unknown'])
  })

  it('stays silent when no project file lists enabledPlugins', () => {
    expect(ids(repo({}), PROJECT, rules('mcp__plugin_ghost_search__query'))).toEqual([])
    expect(ids(repo({}), PROJECT, { enabledPlugins: [], ...rules('mcp__plugin_ghost_x') })).toEqual(
      [],
    )
  })

  it('stays silent for the names that mcp-tool-server-unknown owns, and for others', () => {
    const code = enabled(
      { 'lint@acme': true },
      'mcp__github__search',
      'mcp__claude_ai_Slack__post',
      'mcp__workspace__bash',
      'mcp__plugin_*',
      'mcp__plugin_',
      'mcp__plugin_ghost*',
      'Bash(mcp__plugin_ghost_x)',
      'mcp__plugin_ghost_x(',
    )
    expect(ids(repo({}), PROJECT, code)).toEqual([])
  })

  it('stays silent in a managed file, which is not for one project', () => {
    const code = enabled({ 'lint@acme': true }, 'mcp__plugin_ghost_search__query')
    expect(ids(repo({}), MANAGED, code)).toEqual([])
    expect(ids(repo({}), 'managed-settings.d/10-a.json', code)).toEqual([])
  })
})

describe(`${name}: a file that the rule cannot read`, () => {
  const code = enabled({ 'lint@acme': true }, 'mcp__plugin_ghost_search__query')

  it('stays silent when the other project file is not an object, or does not parse', () => {
    expect(ids(repo({ [LOCAL]: '[1]' }), PROJECT, code)).toEqual([])
    expect(ids(repo({ [LOCAL]: '{' }), PROJECT, code)).toEqual([])
    expect(ids(repo({ [PROJECT]: '{' }), LOCAL, code)).toEqual([])
  })

  it('reports when the other project file is readable and enables nothing that fits', () => {
    expect(ids(repo({ [LOCAL]: '{}' }), PROJECT, code)).toEqual(['unknown'])
  })
})
