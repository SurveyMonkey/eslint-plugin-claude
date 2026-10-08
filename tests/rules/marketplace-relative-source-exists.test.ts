// The rule checks that the directory of a relative `source` exists, from the
// marketplace root. The directories are on disk, because the rule reads them.
// The files glob and the decoy files are in tests/configs.test.ts.
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

const RULE = 'marketplace-relative-source-exists'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }
const entry = (source: unknown, extra: Record<string, unknown> = {}) =>
  marketplaceOf([{ name: 'p', source }], extra)

describe(RULE, () => {
  it('reports a source whose directory does not exist', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/gone" }
  ]
}`
    const messages = lint(tree(PLUGIN), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      line: 4,
      column: 30,
      endColumn: 46,
    })
    expect(messages[0]?.message).toContain('"./plugins/gone"')
  })

  it('resolves the source from the marketplace root, not from .claude-plugin', () => {
    const dir = tree({ '.claude-plugin/plugins/p/x.txt': 'x' })
    expect(lint(dir, entry('./plugins/p'))).toHaveLength(1)
  })

  it('reports a path below a file, where nothing is', () => {
    const dir = tree({ 'plugins/file.txt': 'a file' })
    expect(lint(dir, entry('./plugins/file.txt/sub'))).toHaveLength(1)
  })

  it('reports a bare name under metadata.pluginRoot', () => {
    const dir = tree(PLUGIN)
    expect(lint(dir, entry('gone', { metadata: { pluginRoot: './plugins' } }))).toHaveLength(1)
    // The name is a directory of the marketplace root, and not of pluginRoot.
    expect(lint(dir, entry('plugins', { metadata: { pluginRoot: './plugins' } }))).toHaveLength(1)
  })

  it('reports each entry on its own', () => {
    const code = marketplaceOf([
      { name: 'a', source: './plugins/p' },
      { name: 'b', source: './b' },
      { name: 'c', source: './c' },
    ])
    expect(lint(tree(PLUGIN), code).map((m) => m.messageId)).toEqual(['missing', 'missing'])
  })

  it('reads the last of two source keys, as JSON.parse does', () => {
    const dir = tree(PLUGIN)
    expect(lint(dir, '{"plugins": [{"source": "./plugins/p", "source": "./gone"}]}')).toHaveLength(
      1,
    )
    expect(lint(dir, '{"plugins": [{"source": "./gone", "source": "./plugins/p"}]}')).toEqual([])
  })

  it('reports in a tree with no .git', () => {
    expect(lint(tree(PLUGIN, false), entry('./gone'))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it('stays silent for a directory that exists, with or without a manifest', () => {
    const dir = tree({ ...PLUGIN, 'plugins/bare/x.txt': 'x' })
    expect(lint(dir, entry('./plugins/p'))).toEqual([])
    expect(lint(dir, entry('./plugins/bare'))).toEqual([])
    expect(lint(dir, entry('./plugins/bare/'))).toEqual([])
  })

  it('stays silent for the source "." and for a bare name that exists under pluginRoot', () => {
    const dir = tree(PLUGIN)
    expect(lint(dir, entry('.'))).toEqual([])
    expect(lint(dir, entry('p', { metadata: { pluginRoot: 'plugins' } }))).toEqual([])
  })

  it('stays silent for a source that is a file, which the docs give no message for', () => {
    expect(lint(tree({ 'plugins/file.txt': 'a file' }), entry('./plugins/file.txt'))).toEqual([])
  })

  it.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'gone'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/gone'],
    ['a network source', '//host/gone'],
    ['a source with ..', './plugins/../gone'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
    ['a source that is null', null],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(tree(PLUGIN), entry(source))).toEqual([])
  })

  it.each([
    ['an empty pluginRoot', ''],
    ['a pluginRoot with ..', '../plugins'],
    ['an absolute pluginRoot', '/plugins'],
    ['a pluginRoot that is not a string', 3],
  ])('stays silent for a bare name under %s', (_title, pluginRoot) => {
    expect(lint(tree(PLUGIN), entry('gone', { metadata: { pluginRoot } }))).toEqual([])
  })

  it('stays silent for an entry with no source, and for an entry that is not an object', () => {
    const dir = tree(PLUGIN)
    expect(lint(dir, marketplaceOf([{ name: 'p' }, 'x', null]))).toEqual([])
    expect(lint(dir, JSON.stringify({ name: 'acme', plugins: 3 }))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a dangling link, at the end or in the middle of the path',
    () => {
      const dir = tree({})
      link(dir, 'plugins/dead', 'gone')
      link(dir, 'dead-dir', 'gone')
      expect(lint(dir, entry('./plugins/dead'))).toEqual([])
      expect(lint(dir, entry('./dead-dir/p'))).toEqual([])
    },
  )

  it.skipIf(noLinks)('stays silent for a link out of the repository', () => {
    const outside = tree({ 'p/x.txt': 'x' })
    const dir = tree({})
    link(dir, 'plugins/far', path.join(outside, 'p'))
    link(dir, 'plugins/gone', path.join(outside, 'gone'))
    expect(lint(dir, entry('./plugins/far'))).toEqual([])
    expect(lint(dir, entry('./plugins/gone'))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a link out of the marketplace root, which is for the escape rule',
    () => {
      const repo = tree({ 'shared/p/x.txt': 'x' })
      const dir = path.join(repo, 'site')
      link(dir, 'plugins/p', '../../shared/p')
      expect(lint(dir, entry('./plugins/p'))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'stays silent for a link out of the marketplace root in a tree with no .git',
    () => {
      const top = tree({ 'shared/p/x.txt': 'x' }, false)
      const dir = path.join(top, 'site')
      link(dir, 'plugins/p', '../../shared/p')
      link(dir, 'plugins/gone', '../../shared/gone')
      expect(lint(dir, entry('./plugins/p'))).toEqual([])
      expect(lint(dir, entry('./plugins/gone'))).toEqual([])
    },
  )

  it.skipIf(chmodCannotBlock)('stays silent for a directory that the rule cannot read', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins'), () => {
      expect(lint(dir, entry('./plugins/p'))).toEqual([])
    })
  })

  it.skipIf(noLinks)('stays silent for a link to itself', () => {
    const dir = tree({})
    link(dir, 'plugins/loop', 'loop')
    expect(lint(dir, entry('./plugins/loop'))).toEqual([])
  })
})
