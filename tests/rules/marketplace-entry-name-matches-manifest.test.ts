// The rule compares the `name` of an entry with the `name` in the
// `plugin.json` of its relative source. The sources are on disk, because the
// rule reads them. The files glob and the decoy files are in
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

const RULE = 'marketplace-entry-name-matches-manifest'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
/** A plugin directory `plugins/p` with a `plugin.json` that sets `fields`. */
const withManifest = (fields: Record<string, unknown>, git = true) =>
  tree({ 'plugins/p/.claude-plugin/plugin.json': manifestOf(fields) }, git)
const entry = (name: unknown, source: unknown = './plugins/p') => marketplaceOf([{ name, source }])

describe(RULE, () => {
  it('reports an entry name that differs from the manifest name', () => {
    const dir = withManifest({ name: 'formatter' })
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "fmt", "source": "./plugins/p" }
  ]
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'mismatch',
      line: 4,
      column: 15,
      endColumn: 20,
    })
    expect(messages[0]?.message).toContain('"fmt"')
    expect(messages[0]?.message).toContain('"formatter"')
  })

  it('compares the names in the exact letter case', () => {
    const dir = withManifest({ name: 'formatter' })
    expect(lint(dir, entry('Formatter'))).toHaveLength(1)
  })

  it('reports each entry that differs, and no entry that matches', () => {
    const dir = tree({
      'plugins/a/.claude-plugin/plugin.json': manifestOf({ name: 'a' }),
      'plugins/b/.claude-plugin/plugin.json': manifestOf({ name: 'b' }),
      'plugins/c/.claude-plugin/plugin.json': manifestOf({ name: 'c' }),
    })
    const code = marketplaceOf([
      { name: 'a', source: './plugins/a' },
      { name: 'x', source: './plugins/b' },
      { name: 'y', source: './plugins/c' },
    ])
    expect(lint(dir, code).map((m) => m.messageId)).toEqual(['mismatch', 'mismatch'])
  })

  it('reports a bare name source under metadata.pluginRoot', () => {
    const dir = withManifest({ name: 'formatter' })
    const code = marketplaceOf([{ name: 'fmt', source: 'p' }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, code)).toHaveLength(1)
  })

  it('reports the manifest at the marketplace root for the source "."', () => {
    const dir = tree({ '.claude-plugin/plugin.json': manifestOf({ name: 'root' }) })
    expect(lint(dir, entry('other', '.'))).toHaveLength(1)
  })

  it('reads the last of two name keys, as JSON.parse does', () => {
    const dir = withManifest({ name: 'formatter' })
    const code = '{"plugins": [{"name": "formatter", "name": "fmt", "source": "./plugins/p"}]}'
    expect(lint(dir, code)).toHaveLength(1)
    const same = '{"plugins": [{"name": "fmt", "name": "formatter", "source": "./plugins/p"}]}'
    expect(lint(dir, same)).toEqual([])
  })

  it.skipIf(noLinks)('reports a source that is a link inside the marketplace root', () => {
    const dir = withManifest({ name: 'formatter' })
    link(dir, 'plugins/alias', 'p')
    expect(lint(dir, entry('fmt', './plugins/alias'))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    const dir = withManifest({ name: 'formatter' }, false)
    expect(lint(dir, entry('fmt'))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it('stays silent when the names are equal', () => {
    const dir = withManifest({ name: 'formatter' })
    expect(lint(dir, entry('formatter'))).toEqual([])
  })

  it.each([
    ['has no name', {}],
    ['has a name that is not a string', { name: 3 }],
    ['has an empty name', { name: '' }],
  ])('stays silent when the manifest %s', (_title, fields) => {
    expect(lint(withManifest(fields), entry('fmt'))).toEqual([])
  })

  it.each([
    ['an empty entry name', ''],
    ['an entry name that is not a string', 3],
    ['an entry name that is null', null],
  ])('stays silent for %s, which marketplace-schema reports', (_title, name) => {
    expect(lint(withManifest({ name: 'formatter' }), entry(name))).toEqual([])
  })

  it('stays silent when both names are empty strings', () => {
    expect(lint(withManifest({ name: '' }), entry(''))).toEqual([])
  })

  it('stays silent for an entry with no name', () => {
    const code = marketplaceOf([{ source: './plugins/p' }])
    expect(lint(withManifest({ name: 'formatter' }), code)).toEqual([])
  })

  it.each([
    ['a source with no manifest', { 'plugins/p/x.txt': 'x' }],
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
    ['a source that is a file', { plugins: 'a file' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry('fmt'))).toEqual([])
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
    expect(lint(withManifest({ name: 'formatter' }), entry('fmt', source))).toEqual([])
  })

  it('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'fmt', source: 'p' }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(withManifest({ name: 'formatter' }), code)).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest that is a dangling link', () => {
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, entry('fmt'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'formatter' }) })
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, entry('fmt'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a source that is a link out of the marketplace root', () => {
    const repo = tree({
      'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'formatter' }),
    })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry('fmt'))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a link out of the repository, and for a dangling link',
    () => {
      const outside = tree({ 'p/.claude-plugin/plugin.json': manifestOf({ name: 'formatter' }) })
      const dir = tree({})
      link(dir, 'plugins/far', path.join(outside, 'p'))
      link(dir, 'plugins/dead', 'gone')
      expect(lint(dir, entry('fmt', './plugins/far'))).toEqual([])
      expect(lint(dir, entry('fmt', './plugins/dead'))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'stays silent for a link out of the marketplace root in a tree with no .git',
    () => {
      const top = tree(
        { 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'formatter' }) },
        false,
      )
      const dir = path.join(top, 'site')
      link(dir, 'plugins/p', '../../shared/p')
      expect(lint(dir, entry('fmt'))).toEqual([])
    },
  )

  it('stays silent for an entry that is not an object, and for a plugins value that is not an array', () => {
    const dir = withManifest({ name: 'formatter' })
    expect(lint(dir, marketplaceOf(['fmt', null, 3]))).toEqual([])
    expect(lint(dir, JSON.stringify({ name: 'acme', plugins: { name: 'fmt' } }))).toEqual([])
  })
})
