// A tool of a plugin MCP server is `mcp__plugin_<plugin>_<server>__<tool>`, where each character
// outside `A-Za-z0-9_-` is `_` (MCP page, "Plugin-provided MCP servers"). A bare
// `mcp__<server>__<tool>` for a server of the same plugin never matches. The plugin is on disk,
// so the cases use `Linter` and a repository with a `.git` directory.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintMarkdown, withoutAccess } from '../rule-tester.test-support.ts'

const NAME = 'mcp-plugin-tool-name-scoped'
const manifest = (name = 'p', rest: object = {}) => JSON.stringify({ name, ...rest })
const mcp = (...names: string[]) =>
  JSON.stringify({ mcpServers: Object.fromEntries(names.map((n) => [n, { command: 'x' }])) })
const skill = (tools: string, key = 'allowed-tools') => `---\n${key}: ${tools}\n---\n\nBody.\n`
const agent = (tools: string, key = 'tools') =>
  `---\nname: a\ndescription: d\n${key}: ${tools}\n---\n\nBody.\n`

const PLUGIN = {
  'p/.claude-plugin/plugin.json': manifest(),
  'p/.mcp.json': mcp('db'),
}

/** Lint `code` at `file` of a repository with `files`. */
function lint(code: string, file: string, files: Record<string, string> = PLUGIN) {
  return lintMarkdown(NAME, code, path.join(repo(files), file))
}
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

it('reports a bare tool of a server that the plugin declares, with the scoped name', () => {
  const found = lint(skill('Read mcp__db__query'), 'p/skills/s/SKILL.md')
  expect(ids(found)).toEqual(['bare'])
  expect(found[0]).toMatchObject({ line: 2, column: 21, endColumn: 35 })
  expect(found[0]?.message).toContain('"mcp__db__query"')
  expect(found[0]?.message).toContain('"mcp__plugin_p_db__query"')
})
it('reports a bare server name, a glob, a specifier and a disallowed tool', () => {
  const tools = 'mcp__db, mcp__db__*, mcp__db__query(x)'
  expect(ids(lint(skill(tools), 'p/skills/s/SKILL.md'))).toEqual(['bare', 'bare', 'bare'])
  expect(ids(lint(skill('mcp__db__q', 'disallowed-tools'), 'p/skills/s/SKILL.md'))).toEqual([
    'bare',
  ])
  expect(ids(lint(skill('\n  - Read\n  - mcp__db__q'), 'p/skills/s/SKILL.md'))).toEqual(['bare'])
})
it('reads a command file, a skill at the plugin root, and an agent', () => {
  expect(ids(lint(skill('mcp__db__q'), 'p/commands/c.md'))).toEqual(['bare'])
  expect(ids(lint(skill('mcp__db__q'), 'p/commands/ns/c.md'))).toEqual(['bare'])
  expect(ids(lint(skill('mcp__db__q'), 'p/SKILL.md'))).toEqual(['bare'])
  expect(ids(lint(agent('Read, mcp__db__q'), 'p/agents/a.md'))).toEqual(['bare'])
  expect(ids(lint(agent('mcp__db__q', 'disallowedTools'), 'p/agents/sub/a.md'))).toEqual(['bare'])
})
it('names the server of an inline map and of a declared file', () => {
  const files = {
    'p/.claude-plugin/plugin.json': manifest('p', {
      mcpServers: ['./servers.json', { web: { command: 'x' } }],
    }),
    'p/servers.json': mcp('api'),
  }
  expect(ids(lint(skill('mcp__web__q mcp__api__q'), 'p/skills/s/SKILL.md', files))).toEqual([
    'bare',
    'bare',
  ])
})
it('writes each character outside A-Za-z0-9_- as an underscore in the scoped name', () => {
  const files = {
    'p/.claude-plugin/plugin.json': manifest('my.plugin'),
    'p/.mcp.json': mcp('db.tools'),
  }
  const raw = lint(skill('mcp__db.tools__q'), 'p/skills/s/SKILL.md', files)
  expect(raw[0]?.message).toContain('"mcp__plugin_my_plugin_db_tools__q"')
  // The name that a user types for the server is also bare: the dot is `_` in a tool name.
  const sanitized = lint(skill('mcp__db_tools__q'), 'p/skills/s/SKILL.md', files)
  expect(ids(sanitized)).toEqual(['bare'])
  expect(sanitized[0]?.message).toContain('"mcp__plugin_my_plugin_db_tools__q"')
})
it('stays silent for the scoped name, an other server and an other tool', () => {
  const tools =
    'mcp__plugin_p_db__query mcp__other__q mcp__database__q mcp__* mcp____q Read Bash(ls)'
  expect(ids(lint(skill(tools), 'p/skills/s/SKILL.md'))).toEqual([])
  // A server name is matched whole, so `dbx` is not `db`.
  expect(ids(lint(skill('mcp__dbx__q mcp__dbx'), 'p/skills/s/SKILL.md'))).toEqual([])
})
it('reports once for an entry when two servers match', () => {
  const files = { ...PLUGIN, 'p/.mcp.json': mcp('db', 'db__x') }
  expect(ids(lint(skill('mcp__db__x__q'), 'p/skills/s/SKILL.md', files))).toEqual(['bare'])
})
it('stays silent outside a plugin, where the bare name is right', () => {
  const files = { '.mcp.json': mcp('db'), 'p/.mcp.json': mcp('db') }
  expect(ids(lint(skill('mcp__db__q'), '.claude/skills/s/SKILL.md', files))).toEqual([])
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', files))).toEqual([])
  expect(ids(lint(agent('mcp__db__q'), '.claude/agents/a.md', files))).toEqual([])
})
it('stays silent when the plugin has no name, no server, or a file it cannot read', () => {
  const noName = { 'p/.claude-plugin/plugin.json': '{}', 'p/.mcp.json': mcp('db') }
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', noName))).toEqual([])
  const badName = { 'p/.claude-plugin/plugin.json': '{"name": 7}', 'p/.mcp.json': mcp('db') }
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', badName))).toEqual([])
  const noServer = { 'p/.claude-plugin/plugin.json': manifest() }
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', noServer))).toEqual([])
  const badMcp = { ...PLUGIN, 'p/.mcp.json': '{ not json' }
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', badMcp))).toEqual([])
  const badManifest = { 'p/.claude-plugin/plugin.json': '{ not json', 'p/.mcp.json': mcp('db') }
  expect(ids(lint(skill('mcp__db__q'), 'p/skills/s/SKILL.md', badManifest))).toEqual([])
})
it('stays silent for a file that is no skill or agent, and for a field it does not read', () => {
  expect(ids(lint(skill('mcp__db__q'), 'p/docs/readme.md'))).toEqual([])
  expect(ids(lint(skill('mcp__db__q', 'description'), 'p/skills/s/SKILL.md'))).toEqual([])
  expect(ids(lint('---\n: [\n---\n', 'p/skills/s/SKILL.md'))).toEqual([])
  expect(ids(lint('No frontmatter.\n', 'p/skills/s/SKILL.md'))).toEqual([])
})
it('keeps the report that the readable files support when the .mcp.json is locked', () => {
  const root = repo({
    ...PLUGIN,
    'p/.claude-plugin/plugin.json': manifest('p', { mcpServers: { web: { command: 'x' } } }),
  })
  if (chmodCannotBlock) {
    return
  }
  const file = path.join(root, 'p', 'skills', 's', 'SKILL.md')
  const found = withoutAccess(path.join(root, 'p', '.mcp.json'), () =>
    lintMarkdown(NAME, skill('mcp__db__q mcp__web__q'), file),
  )
  expect(ids(found)).toEqual(['bare'])
  expect(found[0]?.message).toContain('mcp__web__q')
})
it('stays silent for a server with an empty name', () => {
  const files = { ...PLUGIN, 'p/.mcp.json': mcp('') }
  expect(ids(lint(skill('mcp____q mcp__'), 'p/skills/s/SKILL.md', files))).toEqual([])
})
