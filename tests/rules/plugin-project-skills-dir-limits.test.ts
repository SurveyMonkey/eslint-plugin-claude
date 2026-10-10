// A plugin in `.claude/skills/<name>/` of a project loads with limits (plugin
// loading reference, "Plugins shared through a repository"). Claude Code loads
// no background monitor from it. It skips an MCP server that comes from a
// `.mcpb` or `.dxt` bundle, or from a file out of the plugin directory. The
// trees are on disk, because the rule finds the plugin root and reads the
// files around it. The files glob and the decoy files are in
// tests/configs.test.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-project-skills-dir-limits'
const check = it.fails
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const AT = '.claude/skills/p/'
const MONITORS =
  'Claude Code does not load background monitors from a plugin in `.claude/skills/`. Move the plugin to a marketplace, or remove the monitors.'
const bundle = (file: string) =>
  `Claude Code skips the MCP bundle \`${file}\` in a plugin in \`.claude/skills/\`. Declare the server inline, or in a \`.mcp.json\` inside the plugin.`
const outside = (file: string) =>
  `Claude Code skips the MCP server file \`${file}\` in a plugin in \`.claude/skills/\`, because the file is out of the plugin directory. Move the file into the plugin, or declare the servers inline.`
const run = (fields: Record<string, unknown>, files: Record<string, string> = {}, at = AT) => {
  const { dir, code } = pluginTree({ name: 'p', ...fields }, files, at)
  return lint(dir, code)
}
const messages = (fields: Record<string, unknown>, files: Record<string, string> = {}) =>
  run(fields, files).map((m) => m.message)

describe(RULE, () => {
  check('reports experimental.monitors, on the member, with the full message', () => {
    const { dir, code } = pluginTree(
      { name: 'p', experimental: { monitors: './monitors.json' } },
      {},
      AT,
    )
    const found = lint(dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'monitors',
      message: MONITORS,
      line: 1,
      column: 29,
      endColumn: 57,
    })
  })

  check.each([
    ['a path', { experimental: { monitors: './config/monitors.json' } }],
    [
      'an inline array',
      { experimental: { monitors: [{ name: 'm', command: 'x', description: 'd' }] } },
    ],
    ['the top-level key, which still loads', { monitors: './monitors.json' }],
  ])('reports monitors as %s', (_title, fields) => {
    expect(messages(fields)).toEqual([MONITORS])
  })

  check('reports each of the two monitor keys', () => {
    const fields = { monitors: [], experimental: { monitors: [] } }
    expect(messages(fields)).toEqual([MONITORS, MONITORS])
  })

  check('reports the default monitors/monitors.json when no key is set, on the first line', () => {
    const found = run({}, { 'monitors/monitors.json': '[]' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ messageId: 'monitors', message: MONITORS, line: 1, column: 1 })
  })

  check('reports the key once when the default file is there too', () => {
    const fields = { experimental: { monitors: './other.json' } }
    expect(messages(fields, { 'monitors/monitors.json': '[]' })).toEqual([MONITORS])
  })

  check.each([
    ['a .mcpb path', './server.mcpb', 'bundle'],
    ['a .dxt path', './mcp/server.dxt', 'bundle'],
    ['a bundle URL', 'https://example.com/server.mcpb', 'bundle'],
    ['a bundle that is out of the plugin', '../shared/server.mcpb', 'bundle'],
    ['a file out of the plugin', '../shared/servers.json', 'outside'],
    ['a file that is out of the plugin and not on disk', '../ghost.json', 'outside'],
    ['a path that leaves and comes back', './a/../../p2/servers.json', 'outside'],
    ['an absolute path', '/etc/servers.json', 'outside'],
  ])('reports mcpServers as %s', (_title, entry, kind) => {
    const expected = kind === 'bundle' ? bundle(entry) : outside(entry)
    expect(messages({ mcpServers: entry })).toEqual([expected])
  })

  check('reports each path of an array, and skips the inline map in it', () => {
    const fields = {
      mcpServers: ['./a.mcpb', { s: { command: 'x' } }, './own.json', '../b.json', 3],
    }
    expect(messages(fields, { 'own.json': '{}' })).toEqual([
      bundle('./a.mcpb'),
      outside('../b.json'),
    ])
  })

  check('reports the path string, with its location', () => {
    const { dir, code } = pluginTree({ name: 'p', mcpServers: '../s.json' }, {}, AT)
    expect(lint(dir, code)[0]).toMatchObject({
      messageId: 'outside',
      line: 1,
      column: 26,
      endColumn: 37,
    })
  })

  check('reports monitors and a bundle together', () => {
    const fields = { mcpServers: './a.dxt', monitors: [] }
    expect(messages(fields)).toEqual([MONITORS, bundle('./a.dxt')])
  })

  check(
    'reports a plugin in a nested .claude/skills/, because the docs name no fault in its place',
    () => {
      expect(run({ monitors: [] }, {}, 'packages/x/.claude/skills/p/')).toHaveLength(1)
    },
  )

  linked('reports an MCP file that is a link to a file out of the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p', mcpServers: './servers.json' }, {}, AT)
    mkdirSync(path.join(top, 'shared'), { recursive: true })
    writeFileSync(path.join(top, 'shared', 'servers.json'), '{}')
    link(dir, 'servers.json', '../../../shared/servers.json')
    expect(lint(dir, code).map((m) => m.message)).toEqual([outside('./servers.json')])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a .json file in the plugin', { mcpServers: './mcp/servers.json' }],
    ['an inline map', { mcpServers: { s: { command: 'node', args: ['x.js'] } } }],
    [
      'an array of an inline map and a file in the plugin',
      { mcpServers: [{ s: {} }, './own.json'] },
    ],
    ['a file that is not on disk, in the plugin', { mcpServers: './ghost.json' }],
    ['no components', {}],
    ['a different spelling of the key', { Monitors: [], MCPServers: './a.mcpb' }],
    ['mcpServers as a number', { mcpServers: 3 }],
    ['experimental as a string', { experimental: 'monitors' }],
    ['experimental with other keys', { experimental: { themes: './t' } }],
  ])('stays silent for %s', (_title, fields) => {
    expect(messages(fields, { 'mcp/servers.json': '{}', 'own.json': '{}' })).toEqual([])
  })

  check('stays silent for a .mcp.json at the plugin root', () => {
    expect(messages({}, { '.mcp.json': '{}' })).toEqual([])
  })

  check('stays silent for the last of two mcpServers keys, which is an inline map', () => {
    const { dir } = pluginTree({ name: 'p' }, {}, AT)
    expect(lint(dir, '{"name": "p", "mcpServers": "./a.mcpb", "mcpServers": {}}')).toEqual([])
  })

  check.each([
    ['a plugin in plugins/', 'plugins/p/'],
    ['a plugin at the repository root', ''],
    ['a plugin in .claude/plugins/', '.claude/plugins/p/'],
    ['a plugin two folders below .claude/skills/', '.claude/skills/group/p/'],
    ['a plugin in a folder named skills of another directory', 'docs/skills/p/'],
    ['the skills folder itself as the plugin', '.claude/skills/'],
  ])('stays silent for %s', (_title, at) => {
    const fields = { monitors: [], mcpServers: ['./a.mcpb', '../b.json'] }
    expect(run(fields, { 'monitors/monitors.json': '[]' }, at)).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ '.claude/skills/p/monitors/monitors.json': '[]' })
    expect(lint(path.join(top, '.claude', 'skills', 'p'), '{"name": "p", "monitors": []}')).toEqual(
      [],
    )
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, { 'monitors/monitors.json': '[]' }, AT)
    expect(lint(dir, '{"name": "p", "monitors": []}')).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ '.claude/skills/p/monitors/monitors.json': '[]' })
    const dir = path.join(top, '.claude', 'skills', 'p')
    link(dir, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(dir, '{"name": "p", "monitors": []}')).toEqual([])
  })

  linked('makes no report for a default monitors file that is a link out of the repository', () => {
    const elsewhere = tree({ 'monitors.json': '[]' })
    const { dir, code } = pluginTree({ name: 'p' }, {}, AT)
    link(dir, 'monitors/monitors.json', path.join(elsewhere, 'monitors.json'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a default monitors file that is a dangling link', () => {
    const { dir, code } = pluginTree({ name: 'p' }, {}, AT)
    link(dir, 'monitors/monitors.json', 'ghost.json')
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for an MCP file that is a link out of the repository', () => {
    const elsewhere = tree({ 'servers.json': '{}' })
    const { dir, code } = pluginTree({ name: 'p', mcpServers: './servers.json' }, {}, AT)
    link(dir, 'servers.json', path.join(elsewhere, 'servers.json'))
    expect(lint(dir, code)).toEqual([])
  })

  locked('makes no report for a .claude-plugin directory that it cannot read', () => {
    const { dir, code } = pluginTree({ name: 'p', monitors: [] }, {}, AT)
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, '.claude-plugin'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
