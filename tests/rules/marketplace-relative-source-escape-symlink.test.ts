// The rule reports a relative `source` whose real path is out of the
// marketplace root, through a link. The links are on disk, because the rule
// reads them. The files glob and the decoy files are in tests/configs.test.ts.
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

const RULE = 'marketplace-relative-source-escape-symlink'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const entry = (source: unknown, extra: Record<string, unknown> = {}) =>
  marketplaceOf([{ name: 'p', source }], extra)
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }

/** A repository with a shared directory next to `site/`, which is the marketplace root. */
function site(files: Record<string, string> = {}) {
  const repo = tree({
    'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }),
    'shared/file.txt': 'a file',
    ...files,
  })
  return path.join(repo, 'site')
}

describe(RULE, () => {
  it.skipIf(noLinks).fails('reports a source that is a link out of the marketplace root', () => {
    const dir = site()
    link(dir, 'plugins/p', '../../shared/p')
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p" }
  ]
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'escapes',
      line: 4,
      column: 30,
      endColumn: 42,
    })
    expect(messages[0]?.message).toContain('"./plugins/p"')
  })

  it.skipIf(noLinks).fails('reports a link in the middle of the path', () => {
    const dir = site()
    link(dir, 'plugins/shared', '../../shared')
    expect(lint(dir, entry('./plugins/shared/p'))).toHaveLength(1)
  })

  it.skipIf(noLinks).fails(
    'reports a link to the repository root, and to a file out of the root',
    () => {
      const dir = site()
      link(dir, 'up', '..')
      link(dir, 'plugins/f', '../../shared/file.txt')
      expect(lint(dir, entry('./up'))).toHaveLength(1)
      expect(lint(dir, entry('./plugins/f'))).toHaveLength(1)
    },
  )

  it.skipIf(noLinks).fails('reports a link with an absolute target', () => {
    const dir = site()
    link(dir, 'plugins/p', path.join(path.dirname(dir), 'shared', 'p'))
    expect(lint(dir, entry('./plugins/p'))).toHaveLength(1)
  })

  it.skipIf(noLinks).fails('reports whatever the manifest holds', () => {
    const dir = site({ 'shared/bad/.claude-plugin/plugin.json': '{' })
    link(dir, 'plugins/bad', '../../shared/bad')
    expect(lint(dir, entry('./plugins/bad'))).toHaveLength(1)
  })

  it.skipIf(noLinks).fails('reports a bare name under metadata.pluginRoot', () => {
    const dir = site()
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry('p', { metadata: { pluginRoot: './plugins' } }))).toHaveLength(1)
  })

  it.skipIf(noLinks).fails('reports each entry that leaves the root, and no other', () => {
    const dir = site()
    link(dir, 'plugins/out', '../../shared/p')
    link(dir, 'plugins/out2', '../../shared')
    const code = marketplaceOf([
      { name: 'a', source: './plugins/out' },
      { name: 'b', source: './plugins' },
      { name: 'c', source: './plugins/out2' },
    ])
    expect(lint(dir, code).map((m) => m.line)).toEqual([1, 1])
    expect(lint(dir, code)).toHaveLength(2)
  })

  it.skipIf(noLinks).fails('reads the last of two source keys, as JSON.parse does', () => {
    const dir = site()
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, '{"plugins": [{"source": "./plugins/p", "source": "./nope"}]}')).toEqual([])
    expect(lint(dir, '{"plugins": [{"source": "./nope", "source": "./plugins/p"}]}')).toHaveLength(
      1,
    )
  })
})

describe(`${RULE} (silent)`, () => {
  it.fails('stays silent for a real directory in the marketplace root', () => {
    expect(lint(tree(PLUGIN), entry('./plugins/p'))).toEqual([])
    expect(lint(tree(PLUGIN), entry('.'))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a link that stays in the marketplace root', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/alias', 'p')
    link(dir, 'plugins/up', '..')
    expect(lint(dir, entry('./plugins/alias'))).toEqual([])
    expect(lint(dir, entry('./plugins/up'))).toEqual([])
  })

  it.fails('stays silent for a path that does not exist', () => {
    expect(lint(tree(PLUGIN), entry('./gone'))).toEqual([])
  })

  it.fails.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/shared/p'],
    ['a source with ..', './../shared/p'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    const dir = site()
    if (!noLinks) {
      link(dir, 'plugins/p', '../../shared/p')
    }
    expect(lint(dir, entry(source))).toEqual([])
  })

  it.fails.each([
    ['an empty pluginRoot', ''],
    ['a pluginRoot with ..', '../plugins'],
    ['an absolute pluginRoot', '/plugins'],
    ['a pluginRoot that is not a string', 3],
  ])('stays silent for a bare name under %s', (_title, pluginRoot) => {
    const dir = site()
    if (!noLinks) {
      link(dir, 'plugins/p', '../../shared/p')
    }
    expect(lint(dir, entry('p', { metadata: { pluginRoot } }))).toEqual([])
  })

  it.fails('stays silent for an entry with no source, and for an entry that is not an object', () => {
    expect(lint(tree(PLUGIN), marketplaceOf([{ name: 'p' }, 'x', null]))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a dangling link', () => {
    const dir = site()
    link(dir, 'plugins/dead', '../../shared/gone')
    link(dir, 'dead-dir', '../../shared/gone')
    expect(lint(dir, entry('./plugins/dead'))).toEqual([])
    expect(lint(dir, entry('./dead-dir/p'))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a link out of the repository', () => {
    const outside = tree({ 'p/x.txt': 'x' })
    const dir = tree({})
    link(dir, 'plugins/far', path.join(outside, 'p'))
    expect(lint(dir, entry('./plugins/far'))).toEqual([])
  })

  it.skipIf(noLinks).fails('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree({ 'shared/p/x.txt': 'x' }, false)
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry('./plugins/p'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock).fails(
    'stays silent for a directory that the rule cannot read',
    () => {
      const dir = tree(PLUGIN)
      withoutAccess(path.join(dir, 'plugins'), () => {
        expect(lint(dir, entry('./plugins/p'))).toEqual([])
      })
    },
  )

  it.skipIf(noLinks).fails('stays silent for a link to itself', () => {
    const dir = tree({})
    link(dir, 'plugins/loop', 'loop')
    expect(lint(dir, entry('./plugins/loop'))).toEqual([])
  })
})
