// The reader of the source of a relative entry. A probe rule gives the reader
// the document and the entries of a marketplace file on disk, as ESLint does.
// The trees hold links, so a case builds a real directory and does not mock
// the file system.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import json, { type JSONRuleDefinition } from '@eslint/json'
import { Linter, type Rule } from 'eslint'
import { describe, expect, it } from 'vitest'
import { pluginEntries } from '../src/marketplace-json.ts'
import { type SourceRead, sourceReader } from '../src/marketplace-source.ts'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceFile,
  marketplaceOf,
  noLinks,
  tree,
} from './marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

/** What the reader gives for each entry of the marketplace `code` in `dir`. */
function readAll(dir: string, code: string): SourceRead[] {
  const results: SourceRead[] = []
  const probe: JSONRuleDefinition = {
    create(context) {
      return {
        Document(node) {
          const read = sourceReader(context.filename, node)
          for (const entry of pluginEntries(node)) {
            results.push(read(entry))
          }
        },
      }
    },
  }
  const messages = new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude-plugin/marketplace.json'],
        plugins: { json, probe: { rules: { read: probe as unknown as Rule.RuleModule } } },
        language: 'json/json',
        rules: { 'probe/read': 'error' },
      },
    ],
    { filename: marketplaceFile(dir) },
  )
  expect(messages).toEqual([])
  return results
}

/** What the reader gives for an entry with the `source` value `source`. */
const readOne = (dir: string, source: unknown, extra: Record<string, unknown> = {}) =>
  readAll(dir, marketplaceOf([{ name: 'p', source }], extra))[0]

const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }

describe('sourceReader: a source that is not a relative path', () => {
  const dir = tree(PLUGIN)

  it.each([
    ['an empty string', ''],
    ['a path with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute path', '/plugins/p'],
    ['a path with a drive letter', 'C:/plugins/p'],
    ['a network path', '//host/plugins/p'],
    ['a path with ..', './plugins/../plugins/p'],
    ['a path that climbs', '../plugins/p'],
    ['a path with a backslash', './plugins\\p'],
    ['an object', { source: 'github', repo: 'a/b' }],
    ['a number', 3],
    ['null', null],
  ])('gives not-relative for %s', (_name, source) => {
    expect(readOne(dir, source)).toEqual({ kind: 'not-relative' })
  })

  it('gives not-relative for an entry with no source', () => {
    expect(readAll(dir, marketplaceOf([{ name: 'p' }]))).toEqual([{ kind: 'not-relative' }])
  })

  it.each([
    ['an empty pluginRoot', ''],
    ['a pluginRoot that is not a string', 3],
    ['a pluginRoot with ..', '../plugins'],
    ['an absolute pluginRoot', '/plugins'],
    ['a network pluginRoot', '//plugins'],
    ['a pluginRoot with a backslash', '.\\plugins'],
  ])('gives not-relative for a bare name with %s', (_name, pluginRoot) => {
    expect(readOne(dir, 'p', { metadata: { pluginRoot } })).toEqual({ kind: 'not-relative' })
  })

  it('gives not-relative for a source with a slash, even with a pluginRoot', () => {
    expect(readOne(dir, 'plugins/p', { metadata: { pluginRoot: '.' } })).toEqual({
      kind: 'not-relative',
    })
  })
})

describe('sourceReader: a source that has a manifest', () => {
  const dir = tree({
    ...PLUGIN,
    '.claude-plugin/plugin.json': manifestOf({ name: 'root' }),
    'other/q/.claude-plugin/plugin.json': manifestOf({ name: 'q', version: '1.0.0' }),
  })

  it.each([
    ['a ./ path', './plugins/p', {}],
    ['a path with a trailing slash', './plugins/p/', {}],
    ['a bare name under a pluginRoot with ./', 'p', { metadata: { pluginRoot: './plugins' } }],
    ['a bare name under a pluginRoot with no ./', 'p', { metadata: { pluginRoot: 'plugins' } }],
    [
      'a bare name under a pluginRoot with a trailing slash',
      'p',
      { metadata: { pluginRoot: './plugins/' } },
    ],
    [
      'a ./ path, which a pluginRoot does not change',
      './plugins/p',
      { metadata: { pluginRoot: './other' } },
    ],
  ])('reads the manifest for %s', (_name, source, extra) => {
    expect(readOne(dir, source, extra)).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
  })

  it('reads the manifest of the marketplace root for the source "."', () => {
    expect(readOne(dir, '.')).toEqual({ kind: 'manifest', manifest: { name: 'root' } })
  })

  it('reads a bare name under a pluginRoot of "." from the marketplace root', () => {
    expect(readOne(dir, 'other', { metadata: { pluginRoot: '.' } })).toEqual({
      kind: 'no-manifest',
    })
  })

  it('reads each entry on its own, in file order', () => {
    const results = readAll(
      dir,
      marketplaceOf([
        { name: 'a', source: './plugins/p' },
        { name: 'b', source: './nope' },
        { name: 'c', source: './other/q' },
      ]),
    )
    expect(results).toEqual([
      { kind: 'manifest', manifest: { name: 'p' } },
      { kind: 'missing' },
      { kind: 'manifest', manifest: { name: 'q', version: '1.0.0' } },
    ])
  })

  it('reads the last of two source keys, as JSON.parse does', () => {
    const code = '{"plugins": [{"name": "p", "source": "./nope", "source": "./plugins/p"}]}'
    expect(readAll(dir, code)).toEqual([{ kind: 'manifest', manifest: { name: 'p' } }])
  })

  it('reads the last of two pluginRoot keys, as JSON.parse does', () => {
    const code =
      '{"metadata": {"pluginRoot": "./nope", "pluginRoot": "./plugins"}, "plugins": [{"name": "p", "source": "p"}]}'
    expect(readAll(dir, code)).toEqual([{ kind: 'manifest', manifest: { name: 'p' } }])
  })

  it('resolves a source from the directory that holds .claude-plugin, not from the repository', () => {
    const repo = tree({
      'packages/m/plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'm' }),
    })
    expect(readOne(path.join(repo, 'packages', 'm'), './plugins/p')).toEqual({
      kind: 'manifest',
      manifest: { name: 'm' },
    })
    expect(readOne(repo, './plugins/p')).toEqual({ kind: 'missing' })
  })
})

describe('sourceReader: a source with nothing to read', () => {
  const dir = tree({
    'plugins/none/x.txt': 'x',
    'plugins/hollow/.claude-plugin/other.json': '{}',
    'plugins/file.txt': 'a file',
  })

  it('gives missing for a path that does not exist', () => {
    expect(readOne(dir, './nope')).toEqual({ kind: 'missing' })
    expect(readOne(dir, './plugins/nope/deeper')).toEqual({ kind: 'missing' })
  })

  it('gives missing for a path below a file', () => {
    expect(readOne(dir, './plugins/file.txt/sub')).toEqual({ kind: 'missing' })
  })

  it('gives no-manifest for a directory with no .claude-plugin', () => {
    expect(readOne(dir, './plugins/none')).toEqual({ kind: 'no-manifest' })
  })

  it('gives no-manifest for a .claude-plugin directory with no plugin.json', () => {
    expect(readOne(dir, './plugins/hollow')).toEqual({ kind: 'no-manifest' })
  })

  it('gives no-manifest for a source that is a file', () => {
    expect(readOne(dir, './plugins/file.txt')).toEqual({ kind: 'no-manifest' })
  })
})

describe('sourceReader: a manifest that the rule cannot see', () => {
  it.each([
    ['a syntax error', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a scalar', '3'],
  ])('gives unreadable for a plugin.json with %s', (_name, text) => {
    const dir = tree({ 'plugins/p/.claude-plugin/plugin.json': text })
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(chmodCannotBlock)('gives unreadable for a plugin directory without access', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins', 'p'), () => {
      expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
    })
  })

  it.skipIf(chmodCannotBlock)(
    'gives unreadable for a path below a directory without access',
    () => {
      const dir = tree(PLUGIN)
      withoutAccess(path.join(dir, 'plugins'), () => {
        expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
      })
    },
  )

  it.skipIf(noLinks)('gives unreadable for a plugin.json that is a dangling link', () => {
    const dir = tree({})
    mkdirSync(path.join(dir, 'plugins/p/.claude-plugin'), { recursive: true })
    symlinkSync('gone.json', path.join(dir, 'plugins/p/.claude-plugin/plugin.json'))
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(noLinks)(
    'gives unreadable for a plugin.json that is a link out of the repository',
    () => {
      const outside = tree({ 'plugin.json': manifestOf({ name: 'far' }) })
      const dir = tree({})
      link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
      expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
    },
  )
})

describe('sourceReader: a source that is a link', () => {
  it.skipIf(noLinks)('reads the manifest through a link that stays in the marketplace root', () => {
    const dir = tree({
      ...PLUGIN,
      'shared/s/.claude-plugin/plugin.json': manifestOf({ name: 's' }),
    })
    link(dir, 'plugins/alias', 'p')
    link(dir, 'plugins/shared', '../shared')
    expect(readOne(dir, './plugins/alias')).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
    expect(readOne(dir, './plugins/shared/s')).toEqual({
      kind: 'manifest',
      manifest: { name: 's' },
    })
  })

  it.skipIf(noLinks)(
    'gives escapes for a link out of the marketplace root, inside the repository',
    () => {
      const repo = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
      const dir = path.join(repo, 'site')
      mkdirSync(path.join(dir, 'plugins'), { recursive: true })
      link(dir, 'plugins/p', '../../shared/p')
      link(dir, 'plugins/dir', '../../shared')
      expect(readOne(dir, './plugins/p')).toEqual({ kind: 'escapes' })
      expect(readOne(dir, './plugins/dir/p')).toEqual({ kind: 'escapes' })
    },
  )

  it.skipIf(noLinks)('gives escapes for a link to the repository root', () => {
    const repo = tree({})
    const dir = path.join(repo, 'site')
    link(dir, 'up', '..')
    expect(readOne(dir, './up')).toEqual({ kind: 'escapes' })
  })

  it.skipIf(noLinks)('gives unreadable for a link out of the repository', () => {
    const outside = tree({ 'p/.claude-plugin/plugin.json': manifestOf({ name: 'far' }) })
    const dir = tree({})
    link(dir, 'plugins/p', path.join(outside, 'p'))
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(noLinks)(
    'gives unreadable for a dangling link, at the end or in the middle of the path',
    () => {
      const dir = tree({})
      link(dir, 'plugins/dead', 'gone')
      link(dir, 'dead-dir', 'gone')
      expect(readOne(dir, './plugins/dead')).toEqual({ kind: 'unreadable' })
      expect(readOne(dir, './dead-dir/p')).toEqual({ kind: 'unreadable' })
    },
  )

  it.skipIf(noLinks)('gives unreadable for a link to itself', () => {
    const dir = tree({})
    link(dir, 'plugins/loop', 'loop')
    expect(readOne(dir, './plugins/loop')).toEqual({ kind: 'unreadable' })
  })
})

describe('sourceReader: a tree with no .git', () => {
  it('reads a manifest below the marketplace root', () => {
    const dir = tree(PLUGIN, false)
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
  })

  it.skipIf(noLinks)(
    'takes the marketplace root as the bound: a link out of it is unreadable',
    () => {
      const top = tree({ 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }, false)
      const dir = path.join(top, 'site')
      mkdirSync(path.join(dir, 'plugins'), { recursive: true })
      link(dir, 'plugins/p', '../../shared/p')
      expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
    },
  )

  it.skipIf(noLinks)('reads a link that stays inside the marketplace root', () => {
    const dir = tree(PLUGIN, false)
    link(dir, 'plugins/alias', 'p')
    expect(readOne(dir, './plugins/alias')).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
  })
})

// The reader takes its test of a relative path from the format rule. A source or
// a pluginRoot that the rule reports is never read.
describe('sourceReader and marketplace-relative-source-format', () => {
  const dir = tree(PLUGIN)
  const cases: [string, Record<string, unknown>][] = [
    ['', {}],
    ['plugins/p', {}],
    ['p', {}],
    ['/plugins/p', {}],
    ['\\\\host/plugins/p', {}],
    ['C:/plugins/p', {}],
    ['./plugins/../plugins/p', {}],
    ['..', {}],
    ['p', { metadata: { pluginRoot: '' } }],
    ['p', { metadata: { pluginRoot: '../plugins' } }],
    ['p', { metadata: { pluginRoot: '/plugins' } }],
    ['p', { metadata: { pluginRoot: '//plugins' } }],
    ['plugins/p', { metadata: { pluginRoot: './plugins' } }],
  ]

  it.each(cases)('reads no source that the format rule reports: %j with %j', (source, extra) => {
    const code = marketplaceOf([{ name: 'p', source }], extra)
    expect(lintMarketplace('marketplace-relative-source-format', dir, code).length).toBeGreaterThan(
      0,
    )
    expect(readOne(dir, source, extra)).toEqual({ kind: 'not-relative' })
  })
})

describe('sourceReader: the walk and the root', () => {
  it.skipIf(noLinks)(
    'gives unreadable for a missing part below a link out of the repository',
    () => {
      const outside = tree({})
      const dir = tree({})
      link(dir, 'plugins/out', outside)
      expect(readOne(dir, './plugins/out/nope')).toEqual({ kind: 'unreadable' })
    },
  )

  it('gives unreadable for every source when the marketplace root is not on disk', () => {
    const dir = path.join(tree({}), 'not', 'there')
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'unreadable' })
  })

  it('reads a bare name that starts with a dot under the pluginRoot', () => {
    const dir = tree({ 'plugins/.x/.claude-plugin/plugin.json': manifestOf({ name: 'x' }) })
    expect(readOne(dir, '.x', { metadata: { pluginRoot: './plugins' } })).toEqual({
      kind: 'manifest',
      manifest: { name: 'x' },
    })
  })

  it.skipIf(noLinks)('reads a marketplace that sits behind a link to its directory', () => {
    const dir = tree(PLUGIN)
    const alias = path.join(tree({}), 'alias')
    symlinkSync(dir, alias)
    expect(readOne(alias, './plugins/p')).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
  })

  it.skipIf(noLinks)(
    'gives unreadable for the source "." when the root links out of the repository',
    () => {
      const outside = tree({}, false)
      const repo = tree({})
      const alias = path.join(repo, 'site')
      symlinkSync(outside, alias)
      expect(readOne(alias, '.')).toEqual({ kind: 'unreadable' })
    },
  )

  it.skipIf(noLinks)('reads a .claude-plugin link that stays inside the repository', () => {
    const repo = tree({ 'shared/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p/.claude-plugin', '../../../shared/.claude-plugin')
    expect(readOne(dir, './plugins/p')).toEqual({ kind: 'manifest', manifest: { name: 'p' } })
  })
})
