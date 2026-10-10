// Claude Code skips an MCP server that a plugin under `.claude/skills/` declares as an MCP
// bundle. The loading page says so in "Plugins shared through a repository". The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import pluginOfRules from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-project-plugin-bundle')

const manifest = '.claude/skills/p/.claude-plugin/plugin.json'
const plugin = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

jsonTester.run('mcp-project-plugin-bundle (valid)', rule, {
  valid: [
    { name: 'no mcpServers', code: JSON.stringify({ name: 'p' }), filename: manifest },
    { name: 'array body', code: '[]', filename: manifest },
    { name: 'a json file', code: plugin('./mcp/servers.json'), filename: manifest },
    { name: 'an inline map', code: plugin({ db: { command: 'node' } }), filename: manifest },
    {
      name: 'an inline map named like a bundle',
      code: plugin({ 'a.mcpb': { command: 'node' } }),
      filename: manifest,
    },
    { name: 'an empty array', code: plugin([]), filename: manifest },
    {
      name: 'an array of a file and a map',
      code: plugin(['./a.json', { db: { command: 'node' } }]),
      filename: manifest,
    },
    // A value that is no string, no array and no map.
    { name: 'a number', code: plugin(1), filename: manifest },
    { name: 'null', code: plugin(null), filename: manifest },
    { name: 'an array with a number', code: plugin([1, null]), filename: manifest },
    // The extension decides. A near miss is no bundle.
    { name: 'a name that holds mcpb', code: plugin('./mcpb/servers.json'), filename: manifest },
    { name: 'mcpb without a dot', code: plugin('./servers-mcpb'), filename: manifest },
    { name: 'dxt without a dot', code: plugin('./dxt'), filename: manifest },
    { name: 'an extension in the middle', code: plugin('./a.mcpb.json'), filename: manifest },
    { name: 'an upper case extension', code: plugin('./a.MCPB'), filename: manifest },
    {
      name: 'a bundle extension in the query',
      code: plugin('https://x.test/a.json?f=a.mcpb'),
      filename: manifest,
    },
    {
      name: 'a bundle extension in the fragment',
      code: plugin('https://x.test/a.json#a.dxt'),
      filename: manifest,
    },
    { name: 'a path with a query', code: plugin('./a.mcpb?x=1'), filename: manifest },
    // A path that leaves the plugin directory fails `claude plugin validate`.
    {
      name: 'a path out of the plugin',
      code: plugin('../shared/servers.json'),
      filename: manifest,
    },
    // A URL is no file path.
    {
      name: 'a json URL',
      code: plugin('https://example.com/servers.json'),
      filename: manifest,
    },
    // The last of two keys counts.
    {
      name: 'duplicate key, the last is a json file',
      code: '{"mcpServers": "./a.mcpb", "mcpServers": "./a.json"}',
      filename: manifest,
    },
    // Another plugin.json field is not read.
    {
      name: 'a bundle in another field',
      code: JSON.stringify({ name: 'p', skills: './a.mcpb', lspServers: './b.dxt' }),
      filename: manifest,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-project-plugin-bundle (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a mcpb path, with the position of the value',
      code: plugin('./server.mcpb'),
      filename: manifest,
      errors: [
        {
          messageId: 'skipped',
          data: { bundle: './server.mcpb' },
          line: 1,
          column: 26,
          endColumn: 41,
        },
      ],
    },
    {
      name: 'a dxt path',
      code: plugin('./server.dxt'),
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: './server.dxt' } }],
    },
    {
      name: 'a bundle URL',
      code: plugin('https://example.com/server.mcpb'),
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: 'https://example.com/server.mcpb' } }],
    },
    {
      name: 'a bundle URL with a query',
      code: plugin('https://example.com/server.dxt?v=2#top'),
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
    {
      name: 'a bundle in an array, with a file and a map',
      code: plugin(['./a.json', './b.mcpb', { db: { command: 'node' } }, './c.dxt']),
      filename: manifest,
      errors: [
        { messageId: 'skipped', data: { bundle: './b.mcpb' } },
        { messageId: 'skipped', data: { bundle: './c.dxt' } },
      ],
    },
    {
      name: 'a bundle outside the plugin',
      code: plugin('../shared/server.mcpb'),
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
    {
      name: 'duplicate key, the last is a bundle',
      code: '{"mcpServers": "./a.json", "mcpServers": "./a.mcpb"}',
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: './a.mcpb' } }],
    },
    {
      name: 'an absolute bundle is a bundle',
      code: plugin('/opt/server.mcpb'),
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: '/opt/server.mcpb' } }],
    },
    {
      name: 'an absolute path, a drive path and a network path',
      code: plugin([
        '/opt/servers.json',
        'C:\\mcp\\servers.json',
        'D:/mcp.json',
        '//host/share/s.json',
        '\\\\host\\s.json',
      ]),
      filename: manifest,
      errors: [
        { messageId: 'outside', data: { path: '/opt/servers.json' } },
        { messageId: 'outside', data: { path: 'C:\\mcp\\servers.json' } },
        { messageId: 'outside', data: { path: 'D:/mcp.json' } },
        { messageId: 'outside', data: { path: '//host/share/s.json' } },
        { messageId: 'outside', data: { path: '\\\\host\\s.json' } },
      ],
    },
    {
      name: 'a nested directory',
      code: plugin('./a.mcpb'),
      filename: 'packages/app/.claude/skills/p/.claude-plugin/plugin.json',
      errors: [{ messageId: 'skipped' }],
    },
  ],
})

json5Tester.run('mcp-project-plugin-bundle (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ mcpServers: './a.mcpb' }",
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-project-plugin-bundle (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: plugin('./a.mcpb'),
      filename: manifest,
      errors: [
        {
          message:
            'Claude Code skips the MCP bundle "./a.mcpb" in a plugin under .claude/skills/. Declare the server inline, or in a .mcp.json inside the plugin directory.',
        },
      ],
    },
  ],
})

// A path to a file in the plugin that is a link. The rule reads the real path, and only in the
// repository (ADR 001, Decision 14). A path with `..` is for `claude plugin validate`.
describe('mcp-project-plugin-bundle (links and absolute paths on disk)', () => {
  const plugin = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })
  const lint = (dir: string, code: string) =>
    new Linter({ cwd: path.parse(dir).root }).verify(
      code,
      [
        {
          files: ['**/.claude-plugin/plugin.json'],
          plugins: { json, claude: pluginOfRules },
          language: 'json/json',
          rules: { 'claude/mcp-project-plugin-bundle': 'error' },
        },
      ],
      { filename: path.join(dir, '.claude/skills/p/.claude-plugin/plugin.json') },
    )
  const base = {
    '.claude/skills/p/.claude-plugin/plugin.json': '{}',
    '.claude/skills/p/ok.json': '{}',
    'shared/s.json': '{}',
  }
  const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

  it.skipIf(noLinks)('reports a link out of the plugin, inside the repository', () => {
    const dir = tree(base)
    link(dir, '.claude/skills/p/out.json', '../../../shared/s.json')
    link(dir, '.claude/skills/p/dir', '../../../shared')
    expect(ids(lint(dir, plugin(['./out.json', './dir/s.json'])))).toEqual(['escapes', 'escapes'])
  })
  it.skipIf(noLinks)('reports the path of the link as written, in the full message', () => {
    const dir = tree(base)
    link(dir, '.claude/skills/p/out.json', '../../../shared/s.json')
    expect(lint(dir, plugin('./out.json')).map((m) => m.message)).toEqual([
      'The MCP path "./out.json" leads out of the plugin directory through a link. Claude Code does not load it. Keep the target of the link inside the plugin.',
    ])
  })
  it.skipIf(noLinks)('is silent for a link inside the plugin', () => {
    const dir = tree(base)
    link(dir, '.claude/skills/p/in.json', 'ok.json')
    expect(lint(dir, plugin(['./in.json', './ok.json']))).toEqual([])
  })
  it.skipIf(noLinks)(
    'is silent for a link out of the repository, a dangling link and a missing path',
    () => {
      const dir = tree(base)
      const outside = tree({ 'x.json': '{}' }, false)
      link(dir, '.claude/skills/p/far.json', path.join(outside, 'x.json'))
      link(dir, '.claude/skills/p/gone.json', 'nowhere.json')
      expect(lint(dir, plugin(['./far.json', './gone.json', './absent.json']))).toEqual([])
    },
  )
  it.skipIf(noLinks)('is silent for a path with .., which claude plugin validate reports', () => {
    expect(lint(tree(base), plugin('../../../shared/s.json'))).toEqual([])
  })
  it('is silent for a path in the plugin and a URL', () => {
    expect(lint(tree(base), plugin(['./ok.json', 'https://example.com/s.json']))).toEqual([])
  })
  it('is silent for an absolute path that points into the plugin directory', () => {
    const dir = tree(base)
    const inside = path.join(dir, '.claude/skills/p/ok.json')
    expect(lint(dir, plugin(inside))).toEqual([])
    expect(ids(lint(dir, plugin(path.join(dir, 'shared/s.json'))))).toEqual(['outside'])
  })
  it('makes no read for a manifest with no mcpServers', () => {
    expect(lint(tree(base), JSON.stringify({ name: 'p' }))).toEqual([])
  })
})
