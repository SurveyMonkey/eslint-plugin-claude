// `mcp__<server>` in a tool reference names a server (permissions page, "MCP"). The rule reads
// the servers that the repository holds for the scope of the file. A project file uses the
// `.mcp.json` beside `.claude/` and the inline servers of the local agents. A plugin file uses
// the servers of its plugin, with the scoped name of the MCP page. The rule rests on an absence, so
// it stays silent when a source cannot be read. User-scope servers and connectors are not in the
// repository (ADR 001, Decision 14).
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson, lintMarkdown } from '../rule-tester.test-support.ts'

const NAME = 'mcp-tool-server-unknown'
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)
const servers = (...names: string[]) =>
  JSON.stringify({ mcpServers: Object.fromEntries(names.map((n) => [n, { command: 'x' }])) })
const allow = (...rules: string[]) => JSON.stringify({ permissions: { allow: rules } })

/** Lint the settings `code` as `file` of a repository with `files`. */
function settings(code: string, files: Record<string, string>, file = '.claude/settings.json') {
  return lintJson(NAME, code, path.join(repo(files), file))
}
/** Lint the tool list `tools` of the skill or command `file` of a repository with `files`. */
function skill(tools: string, files: Record<string, string>, file = '.claude/skills/s/SKILL.md') {
  return lintMarkdown(NAME, `---\nallowed-tools: ${tools}\n---\n`, path.join(repo(files), file))
}

it.fails('reports a server that .mcp.json lacks, on the entry', () => {
  const code = allow('mcp__db__q', 'mcp__nope__x')
  const found = settings(code, { '.mcp.json': servers('db') })
  expect(ids(found)).toEqual(['unknown'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"mcp__nope') + 1 })
  expect(found[0]?.message).toContain('"nope"')
  expect(found[0]?.message).toContain('.mcp.json')
})
it.fails('reports the bare form, a glob and a specifier, in each list and in the local file', () => {
  const files = { '.mcp.json': servers('db') }
  const lists = JSON.stringify({
    permissions: { allow: ['mcp__a'], ask: ['mcp__b__*'], deny: ['mcp__c__t(x)'] },
  })
  expect(ids(settings(lists, files))).toEqual(['unknown', 'unknown', 'unknown'])
  expect(ids(settings(allow('mcp__a'), files, '.claude/settings.local.json'))).toEqual(['unknown'])
})
it.fails('reports in a skill and a command of the project', () => {
  const files = { '.mcp.json': servers('db') }
  expect(ids(skill('mcp__nope__x, mcp__db__q', files))).toEqual(['unknown'])
  expect(ids(skill('mcp__nope__x', files, '.claude/commands/c.md'))).toEqual(['unknown'])
})
it.fails('uses the .mcp.json of the project that holds the .claude folder', () => {
  const files = { '.mcp.json': servers('db'), 'packages/a/.mcp.json': servers('web') }
  const code = allow('mcp__web__t', 'mcp__db__t')
  expect(ids(settings(code, files, 'packages/a/.claude/settings.json'))).toEqual(['unknown'])
  expect(ids(settings(code, files))).toEqual(['unknown'])
})
it.fails('stays silent for a server that .mcp.json declares', () => {
  const files = { '.mcp.json': servers('db', 'my.server', 'a-b_c') }
  const code = allow(
    'mcp__db',
    'mcp__db__*',
    'mcp__db__t(x)',
    'mcp__my.server__t',
    'mcp__my_server__t',
    'mcp__a-b_c__t',
  )
  expect(ids(settings(code, files))).toEqual([])
})
it.fails('stays silent for the servers that no repository file declares', () => {
  const files = { '.mcp.json': servers('db') }
  const code = allow(
    'mcp__claude_ai_Gmail__send',
    'mcp__plugin_my-plugin_db__query',
    'mcp__workspace__bash',
    'mcp__*',
    'mcp____x',
    'mcp__',
    'mcp__d*__t',
    'mcp_nope__x',
    'Bash',
  )
  expect(ids(settings(code, files))).toEqual([])
})
it.fails('stays silent for an inline server of a local agent', () => {
  const agent =
    '---\nname: a\ndescription: d\nmcpServers:\n  - inline:\n      command: x\n  - db\n---\n'
  const files = { '.mcp.json': servers('db'), '.claude/agents/a.md': agent }
  expect(ids(settings(allow('mcp__inline__t', 'mcp__nope__t'), files))).toEqual(['unknown'])
  const nested = {
    ...files,
    '.claude/agents/sub/b.md':
      '---\nname: b\ndescription: d\nmcpServers:\n  - deep:\n      command: x\n---\n',
  }
  expect(ids(settings(allow('mcp__deep__t'), nested))).toEqual([])
})
it.fails('stays silent when a local agent cannot be read', () => {
  const files = {
    '.mcp.json': servers('db'),
    '.claude/agents/a.md': '---\nname: [\nmcpServers: x\n---\n',
  }
  expect(ids(settings(allow('mcp__nope__t'), files))).toEqual([])
  const plain = {
    '.mcp.json': servers('db'),
    '.claude/agents/a.md': 'No frontmatter, and no servers.\n',
  }
  expect(ids(settings(allow('mcp__nope__t'), plain))).toEqual(['unknown'])
})
it.fails('stays silent when there is no .mcp.json, or the rule cannot read it', () => {
  const code = allow('mcp__nope__t')
  expect(ids(settings(code, {}))).toEqual([])
  expect(ids(settings(code, { '.mcp.json': '{ not json' }))).toEqual([])
  expect(ids(settings(code, { '.mcp.json': '{"servers": {"a": {}}}' }))).toEqual([])
  expect(ids(settings(code, { '.mcp.json': '{"mcpServers": []}' }))).toEqual([])
  expect(ids(settings(code, { '.claude/.mcp.json': servers('x') }))).toEqual([])
})
it.fails('stays silent for a .mcp.json that is a link out of the repository, or dangling', () => {
  const root = repo({})
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-unknown-outside-'))
  try {
    writeFileSync(path.join(outside, 'mcp.json'), servers('other'))
    const at = path.join(root, '.claude', 'settings.json')
    symlinkSync(path.join(outside, 'mcp.json'), path.join(root, '.mcp.json'))
    expect(ids(lintJson(NAME, allow('mcp__nope__t'), at))).toEqual([])
    rmSync(path.join(root, '.mcp.json'))
    symlinkSync(path.join(root, 'nothing.json'), path.join(root, '.mcp.json'))
    expect(ids(lintJson(NAME, allow('mcp__nope__t'), at))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it.fails('stays silent in a managed file and a hidden drop-in', () => {
  const files = { '.mcp.json': servers('db') }
  for (const file of [
    'managed-settings.json',
    'managed-settings.d/10-a.json',
    'managed-settings.d/.10-a.json',
  ]) {
    expect(ids(settings(allow('mcp__nope__t'), files, file)), file).toEqual([])
  }
})
it.fails('stays silent for rules it cannot read', () => {
  const files = { '.mcp.json': servers('db') }
  expect(
    ids(settings('{"permissions": {"allow": "mcp__nope", "deny": [1, null]}}', files)),
  ).toEqual([])
  expect(ids(settings(allow('mcp__nope(', 'mcp__nope__t) x'), files))).toEqual([])
  expect(ids(settings('[]', files))).toEqual([])
})

// A plugin file names its own servers as `mcp__plugin_<plugin>_<server>__<tool>`.
const manifest = (extra: object = {}, name: unknown = 'my-plugin') =>
  JSON.stringify({ name, ...extra })
const PLUGIN = { 'p/.claude-plugin/plugin.json': manifest(), 'p/.mcp.json': servers('db') }
const inPlugin = (tools: string, files: Record<string, string>, file = 'p/skills/s/SKILL.md') =>
  skill(tools, files, file)

it.fails('reports a scoped name of its own plugin for a server that the plugin lacks', () => {
  const found = inPlugin('mcp__plugin_my-plugin_nope__t, mcp__plugin_my-plugin_db__t', PLUGIN)
  expect(ids(found)).toEqual(['unknown'])
  expect(found[0]?.message).toContain('"nope"')
  expect(found[0]?.message).toContain('my-plugin')
  expect(ids(inPlugin('mcp__plugin_my-plugin_nope__t', PLUGIN, 'p/commands/c.md'))).toEqual([
    'unknown',
  ])
})
it.fails('knows the servers of the manifest, of a declared file and of a name with an underscore', () => {
  const files = {
    'p/.claude-plugin/plugin.json': manifest({
      mcpServers: ['./s.json', { 'in.line': { command: 'x' } }],
    }),
    'p/s.json': servers('filed'),
  }
  const tools =
    'mcp__plugin_my-plugin_filed__t mcp__plugin_my-plugin_in_line__t mcp__plugin_my-plugin_ghost__t'
  expect(ids(inPlugin(tools, files))).toEqual(['unknown'])
  const dotted = {
    ...files,
    'p/.claude-plugin/plugin.json': manifest({}, 'my.plugin'),
    'p/.mcp.json': servers('db'),
  }
  expect(ids(inPlugin('mcp__plugin_my_plugin_db__t', dotted))).toEqual([])
})
it.fails('stays silent in a plugin file for a name that is not scoped to its plugin', () => {
  const tools =
    'mcp__db__t mcp__nope__t mcp__plugin_other_x__t mcp__plugin_my-plugin mcp__claude_ai_X__t'
  expect(ids(inPlugin(tools, PLUGIN))).toEqual([])
})
it.fails('stays silent when a plugin source cannot be read', () => {
  const tools = 'mcp__plugin_my-plugin_nope__t'
  expect(ids(inPlugin(tools, { ...PLUGIN, 'p/.mcp.json': '{ not json' }))).toEqual([])
  const declared = (value: unknown) => ({
    ...PLUGIN,
    'p/.claude-plugin/plugin.json': manifest({ mcpServers: value }),
  })
  for (const value of [
    './gone.json',
    './b.mcpb',
    'https://x.test/b.mcpb',
    ['./gone.json', {}],
    '../out.json',
  ]) {
    expect(ids(inPlugin(tools, declared(value))), JSON.stringify(value)).toEqual([])
  }
  expect(ids(inPlugin(tools, declared('./s.json')))).toEqual([])
  expect(ids(inPlugin(tools, { ...declared('./s.json'), 'p/s.json': '[' }))).toEqual([])
  expect(ids(inPlugin(tools, { ...declared('./s.json'), 'p/s.json': servers('x') }))).toEqual([
    'unknown',
  ])
})
it.fails('stays silent when the plugin has no readable name, or an unreadable .mcp.json link', () => {
  const tools = 'mcp__plugin_my-plugin_nope__t'
  for (const name of [undefined, 5, '']) {
    const files = { ...PLUGIN, 'p/.claude-plugin/plugin.json': manifest({}, name) }
    expect(ids(inPlugin(tools, files)), String(name)).toEqual([])
  }
  const root = repo({ 'p/.claude-plugin/plugin.json': manifest() })
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-unknown-plugin-'))
  try {
    writeFileSync(path.join(outside, 'm.json'), servers('other'))
    mkdirSync(path.join(root, 'p'), { recursive: true })
    symlinkSync(path.join(outside, 'm.json'), path.join(root, 'p', '.mcp.json'))
    const file = path.join(root, 'p', 'skills', 's', 'SKILL.md')
    expect(ids(lintMarkdown(NAME, `---\nallowed-tools: ${tools}\n---\n`, file))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
