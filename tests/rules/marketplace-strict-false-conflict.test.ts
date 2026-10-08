// The rule reports a component field in an entry with `"strict": false`, when
// the relative source of the entry has a `plugin.json`. The sources are on
// disk, because the rule reads them. The files glob and the decoy files are in
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

const RULE = 'marketplace-strict-false-conflict'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const FIELDS = ['commands', 'agents', 'skills', 'hooks', 'outputStyles', 'themes']
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }
const entry = (fields: Record<string, unknown>, source: unknown = './plugins/p') =>
  marketplaceOf([{ name: 'p', source, ...fields }])
const message = (field: string) =>
  `The entry sets "strict": false and "${field}", and its source has a plugin.json. The plugin fails to load with a conflict of manifests. Remove "${field}" from the entry, or remove "strict": false.`

describe(RULE, () => {
  it('reports the component field, on the member, with the full message', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p", "strict": false, "commands": "./c" }
  ]
}`
    const messages = lint(tree(PLUGIN), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'conflict',
      message: message('commands'),
      line: 4,
      column: 62,
      endColumn: 79,
    })
  })

  it.each(FIELDS)('reports %s', (field) => {
    const messages = lint(tree(PLUGIN), entry({ strict: false, [field]: './x' }))
    expect(messages.map((m) => m.message)).toEqual([message(field)])
  })

  it('reports each declared field once, and the other keys never', () => {
    const fields = {
      skills: ['./s'],
      description: 'd',
      strict: false,
      hooks: {},
      mcpServers: {},
      themes: './t',
    }
    const messages = lint(tree(PLUGIN), entry(fields))
    expect(messages.map((m) => m.message)).toEqual([
      message('skills'),
      message('hooks'),
      message('themes'),
    ])
  })

  it.each([
    ['an empty string', ''],
    ['null', null],
    ['an empty array', []],
    ['an empty object', {}],
    ['a number', 3],
  ])('reports a field set to %s, because the key is set', (_title, value) => {
    expect(lint(tree(PLUGIN), entry({ strict: false, agents: value }))).toHaveLength(1)
  })

  it('reports each entry on its own', () => {
    const dir = tree({
      ...PLUGIN,
      'plugins/q/.claude-plugin/plugin.json': manifestOf({ name: 'q' }),
    })
    const code = marketplaceOf([
      { name: 'p', source: './plugins/p', strict: false, hooks: {} },
      { name: 'q', source: './plugins/q', strict: false },
      { name: 'r', source: './plugins/q', strict: true, skills: './s' },
      { name: 's', source: './plugins/q', strict: false, agents: './a' },
    ])
    expect(lint(dir, code).map((m) => m.line)).toHaveLength(2)
  })

  it('reads the last of two keys, as JSON.parse does', () => {
    const open = '{"plugins": [{"source": "./plugins/p", "commands": "./c", '
    expect(lint(tree(PLUGIN), `${open}"strict": true, "strict": false}]}`)).toHaveLength(1)
    expect(lint(tree(PLUGIN), `${open}"strict": false, "strict": true}]}`)).toEqual([])
    const twice =
      '{"plugins": [{"source": "./plugins/p", "strict": false, "agents": 1, "agents": 2}]}'
    expect(lint(tree(PLUGIN), twice)).toHaveLength(1)
  })

  it('reports when plugin.json declares the same fields, and when it declares none', () => {
    const dir = tree({
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', commands: './c' }),
    })
    expect(lint(dir, entry({ strict: false, commands: './c' }))).toHaveLength(1)
    expect(lint(tree(PLUGIN), entry({ strict: false, commands: './c' }))).toHaveLength(1)
  })

  it('reports a bare name under metadata.pluginRoot, and the source "."', () => {
    const dir = tree({
      ...PLUGIN,
      '.claude-plugin/plugin.json': manifestOf({ name: 'root' }),
    })
    const bare = marketplaceOf([{ name: 'p', source: 'p', strict: false, skills: './s' }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, bare)).toHaveLength(1)
    expect(lint(dir, entry({ strict: false, skills: './s' }, '.'))).toHaveLength(1)
  })

  it.skipIf(noLinks)('reports a source that is a link inside the marketplace root', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/alias', 'p')
    expect(lint(dir, entry({ strict: false, hooks: {} }, './plugins/alias'))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    expect(lint(tree(PLUGIN, false), entry({ strict: false, hooks: {} }))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['strict unset', {}],
    ['strict true', { strict: true }],
    ['strict as the string "false"', { strict: 'false' }],
    ['strict as null', { strict: null }],
    ['strict as 0', { strict: 0 }],
    ['strict as an object', { strict: {} }],
  ])('stays silent with %s', (_title, fields) => {
    expect(lint(tree(PLUGIN), entry({ ...fields, commands: './c', hooks: {} }))).toEqual([])
  })

  it('stays silent for strict false with no component field', () => {
    const fields = {
      strict: false,
      description: 'd',
      mcpServers: {},
      lspServers: {},
      userConfig: {},
      channels: [],
      version: '1.0.0',
    }
    expect(lint(tree(PLUGIN), entry(fields))).toEqual([])
  })

  it('stays silent for other spellings, which are other keys', () => {
    const fields = {
      strict: false,
      Commands: './c',
      command: './c',
      skill: './s',
      'output-styles': 1,
    }
    expect(lint(tree(PLUGIN), entry(fields))).toEqual([])
  })

  it('stays silent when only plugin.json declares the fields', () => {
    const dir = tree({
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', commands: './c', hooks: {} }),
    })
    expect(lint(dir, entry({ strict: false }))).toEqual([])
  })

  it('stays silent when the source has no plugin.json, because the entry is then the manifest', () => {
    const dir = tree({ 'plugins/p/x.txt': 'x', 'plugins/q/.claude-plugin/other.json': '{}' })
    const fields = { strict: false, commands: './c', hooks: {} }
    expect(lint(dir, entry(fields))).toEqual([])
    expect(lint(dir, entry(fields, './plugins/q'))).toEqual([])
  })

  it.each([
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
    ['a source that is a file', { plugins: 'a file' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry({ strict: false, commands: './c' }))).toEqual([])
  })

  it.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/plugins/p'],
    ['a source with ..', './plugins/../plugins/p'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(tree(PLUGIN), entry({ strict: false, commands: './c' }, source))).toEqual([])
  })

  it('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'p', source: 'p', strict: false, commands: './c' }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(tree(PLUGIN), code)).toEqual([])
  })

  it('stays silent for an entry that is not an object', () => {
    expect(lint(tree(PLUGIN), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest that is a dangling link', () => {
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, entry({ strict: false, commands: './c' }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'p' }) })
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, entry({ strict: false, commands: './c' }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a source that is a link out of the marketplace root', () => {
    const repo = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry({ strict: false, commands: './c' }))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a link out of the repository, and for a dangling link',
    () => {
      const outside = tree({ 'p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
      const dir = tree({})
      link(dir, 'plugins/far', path.join(outside, 'p'))
      link(dir, 'plugins/dead', 'gone')
      const fields = { strict: false, commands: './c' }
      expect(lint(dir, entry(fields, './plugins/far'))).toEqual([])
      expect(lint(dir, entry(fields, './plugins/dead'))).toEqual([])
    },
  )

  it.skipIf(noLinks)('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }, false)
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry({ strict: false, commands: './c' }))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent for a manifest that the rule cannot read', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins', 'p'), () => {
      expect(lint(dir, entry({ strict: false, commands: './c' }))).toEqual([])
    })
  })
})
