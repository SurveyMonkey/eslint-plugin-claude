// The rule reports `mcpServers`, `lspServers`, `userConfig` and `channels` in
// an entry whose relative source has a `plugin.json`. The sources are on disk,
// because the rule reads them. The files glob and the decoy files are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'marketplace-entry-manifest-only-fields'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const FIELDS = ['mcpServers', 'lspServers', 'userConfig', 'channels']
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }
const entry = (fields: Record<string, unknown>, source: unknown = './plugins/p') =>
  marketplaceOf([{ name: 'p', source, ...fields }])

describe(RULE, () => {
  it.fails('reports the field, on the member, and says to declare it in plugin.json', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p", "mcpServers": {} }
  ]
}`
    const messages = lint(tree(PLUGIN), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'ignored',
      line: 4,
      column: 45,
      endColumn: 61,
    })
    expect(messages[0]?.message).toContain('"mcpServers"')
  })

  it.fails.each(FIELDS)('reports %s', (field) => {
    const messages = lint(tree(PLUGIN), entry({ [field]: {} }))
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain(`"${field}"`)
  })

  it.fails('reports each of the four fields once, and the other keys never', () => {
    const fields = {
      mcpServers: {},
      description: 'd',
      lspServers: {},
      commands: './c',
      userConfig: {},
      hooks: {},
      channels: [],
      strict: false,
    }
    const messages = lint(tree(PLUGIN), entry(fields))
    expect(messages.map((m) => m.messageId)).toEqual(['ignored', 'ignored', 'ignored', 'ignored'])
    expect(messages.map((m) => m.message.match(/"(\w+)"/g)?.[0])).toEqual([
      '"mcpServers"',
      '"lspServers"',
      '"userConfig"',
      '"channels"',
    ])
  })

  it.fails.each([
    ['an empty string', ''],
    ['null', null],
    ['an empty array', []],
    ['a number', 3],
  ])('reports a field set to %s, because the key is set', (_title, value) => {
    expect(lint(tree(PLUGIN), entry({ mcpServers: value }))).toHaveLength(1)
  })

  it.fails('reports each entry on its own', () => {
    const dir = tree({
      ...PLUGIN,
      'plugins/q/.claude-plugin/plugin.json': manifestOf({ name: 'q' }),
    })
    const code = marketplaceOf([
      { name: 'p', source: './plugins/p', userConfig: {} },
      { name: 'q', source: './plugins/q' },
      { name: 'r', source: './plugins/q', channels: [] },
    ])
    expect(lint(dir, code)).toHaveLength(2)
  })

  it.fails('reports a field once when the key appears twice', () => {
    const code = '{"plugins": [{"source": "./plugins/p", "mcpServers": {}, "mcpServers": []}]}'
    expect(lint(tree(PLUGIN), code)).toHaveLength(1)
  })

  it.fails('reports for a manifest that sets any keys, and for strict set to false', () => {
    const dir = tree({
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', mcpServers: {} }),
    })
    expect(lint(dir, entry({ lspServers: {}, strict: false }))).toHaveLength(1)
  })

  it.fails('reports a bare name under metadata.pluginRoot, and the source "."', () => {
    const dir = tree({
      ...PLUGIN,
      '.claude-plugin/plugin.json': manifestOf({ name: 'root' }),
    })
    const bare = marketplaceOf([{ name: 'p', source: 'p', userConfig: {} }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, bare)).toHaveLength(1)
    expect(lint(dir, entry({ userConfig: {} }, '.'))).toHaveLength(1)
  })

  it.skipIf(noLinks).fails('reports a source that is a link inside the marketplace root', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/alias', 'p')
    expect(lint(dir, entry({ channels: [] }, './plugins/alias'))).toHaveLength(1)
  })

  it.fails('reports in a tree with no .git', () => {
    expect(lint(tree(PLUGIN, false), entry({ mcpServers: {} }))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it.fails('stays silent when the source has no plugin.json, because the entry is then the manifest', () => {
    const dir = tree({ 'plugins/p/x.txt': 'x', 'plugins/q/.claude-plugin/other.json': '{}' })
    const all = Object.fromEntries(FIELDS.map((field) => [field, {}]))
    expect(lint(dir, entry(all))).toEqual([])
    expect(lint(dir, entry(all, './plugins/q'))).toEqual([])
  })

  it.fails('stays silent for an entry that sets none of the four fields', () => {
    const fields = { description: 'd', commands: './c', skills: './s', hooks: {}, strict: false }
    expect(lint(tree(PLUGIN), entry(fields))).toEqual([])
  })

  it.fails('stays silent for other spellings, which are other keys', () => {
    const fields = { mcpservers: {}, MCPServers: {}, mcp: {}, 'user-config': {} }
    expect(lint(tree(PLUGIN), entry(fields))).toEqual([])
  })

  it.fails('stays silent when the field is in plugin.json and not in the entry', () => {
    const dir = tree({
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', mcpServers: {} }),
    })
    expect(lint(dir, entry({}))).toEqual([])
  })

  it.fails.each([
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
    ['a source that is a file', { plugins: 'a file' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry({ mcpServers: {} }))).toEqual([])
  })

  it.fails.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/plugins/p'],
    ['a source with ..', './plugins/../plugins/p'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(tree(PLUGIN), entry({ mcpServers: {} }, source))).toEqual([])
  })

  it.fails('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'p', source: 'p', mcpServers: {} }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(tree(PLUGIN), code)).toEqual([])
  })

  it.fails('stays silent for an entry that is not an object', () => {
    expect(lint(tree(PLUGIN), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a manifest that is a dangling link', () => {
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, entry({ mcpServers: {} }))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a manifest link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'p' }) })
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, entry({ mcpServers: {} }))).toEqual([])
  })

  it.skipIf(noLinks).fails(
    'stays silent for a source that is a link out of the marketplace root',
    () => {
      const repo = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
      const dir = path.join(repo, 'site')
      link(dir, 'plugins/p', '../../shared/p')
      expect(lint(dir, entry({ mcpServers: {} }))).toEqual([])
    },
  )

  it.skipIf(noLinks).fails(
    'stays silent for a link out of the repository, and for a dangling link',
    () => {
      const outside = tree({ 'p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
      const dir = tree({})
      link(dir, 'plugins/far', path.join(outside, 'p'))
      link(dir, 'plugins/dead', 'gone')
      expect(lint(dir, entry({ mcpServers: {} }, './plugins/far'))).toEqual([])
      expect(lint(dir, entry({ mcpServers: {} }, './plugins/dead'))).toEqual([])
    },
  )

  it.skipIf(noLinks).fails('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }, false)
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry({ mcpServers: {} }))).toEqual([])
  })

  it.skipIf(chmodCannotBlock).fails('stays silent for a manifest that the rule cannot read', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins', 'p'), () => {
      expect(lint(dir, entry({ mcpServers: {} }))).toEqual([])
    })
  })
})
