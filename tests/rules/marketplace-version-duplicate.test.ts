// The rule compares the `version` of an entry with the `version` in the
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
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'marketplace-version-duplicate'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
/** A plugin directory `plugins/p` with a `plugin.json` that sets `fields`. */
const withManifest = (fields: Record<string, unknown>, git = true) =>
  tree({ 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', ...fields }) }, git)
const entry = (version: unknown, source: unknown = './plugins/p') =>
  marketplaceOf([{ name: 'p', source, version }])

describe(RULE, () => {
  it('reports versions that differ, and says that plugin.json wins', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p", "version": "2.0.0" }
  ]
}`
    const messages = lint(withManifest({ version: '1.0.0' }), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'differs',
      line: 4,
      column: 56,
      endColumn: 63,
    })
    expect(messages[0]?.message).toContain('"2.0.0"')
    expect(messages[0]?.message).toContain('"1.0.0"')
  })

  it('reports versions that are equal, which claude plugin validate does not report', () => {
    const messages = lint(withManifest({ version: '1.0.0' }), entry('1.0.0'))
    expect(messages.map((m) => m.messageId)).toEqual(['same'])
    expect(messages[0]?.message).toContain('"1.0.0"')
  })

  it('compares the versions as text, with the same letter case and no trimming', () => {
    expect(lint(withManifest({ version: 'v1' }), entry('V1')).map((m) => m.messageId)).toEqual([
      'differs',
    ])
    expect(lint(withManifest({ version: '1.0' }), entry('1.0 ')).map((m) => m.messageId)).toEqual([
      'differs',
    ])
  })

  it('reports each entry that sets a version in both places', () => {
    const dir = tree({
      'plugins/a/.claude-plugin/plugin.json': manifestOf({ name: 'a', version: '1' }),
      'plugins/b/.claude-plugin/plugin.json': manifestOf({ name: 'b' }),
      'plugins/c/.claude-plugin/plugin.json': manifestOf({ name: 'c', version: '3' }),
    })
    const code = marketplaceOf([
      { name: 'a', source: './plugins/a', version: '1' },
      { name: 'b', source: './plugins/b', version: '2' },
      { name: 'c', source: './plugins/c', version: '4' },
    ])
    expect(lint(dir, code).map((m) => m.messageId)).toEqual(['same', 'differs'])
  })

  it('reports a bare name under metadata.pluginRoot, and the source "."', () => {
    const dir = tree({
      '.claude-plugin/plugin.json': manifestOf({ name: 'root', version: '1' }),
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', version: '1' }),
    })
    const bare = marketplaceOf([{ name: 'p', source: 'p', version: '2' }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, bare)).toHaveLength(1)
    expect(lint(dir, entry('2', '.'))).toHaveLength(1)
  })

  it('reads the last of two version keys, as JSON.parse does', () => {
    const dir = withManifest({ version: '1' })
    const first = '{"plugins": [{"source": "./plugins/p", "version": "", "version": "2"}]}'
    const second = '{"plugins": [{"source": "./plugins/p", "version": "2", "version": ""}]}'
    expect(lint(dir, first)).toHaveLength(1)
    expect(lint(dir, second)).toEqual([])
  })

  it.skipIf(noLinks)('reports a source that is a link inside the marketplace root', () => {
    const dir = withManifest({ version: '1' })
    link(dir, 'plugins/alias', 'p')
    expect(lint(dir, entry('1', './plugins/alias'))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    expect(lint(withManifest({ version: '1' }, false), entry('2'))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it('stays silent when only the manifest sets a version', () => {
    const dir = withManifest({ version: '1.0.0' })
    expect(lint(dir, marketplaceOf([{ name: 'p', source: './plugins/p' }]))).toEqual([])
  })

  it('stays silent when only the entry sets a version', () => {
    expect(lint(withManifest({}), entry('1.0.0'))).toEqual([])
  })

  it('stays silent when neither sets a version', () => {
    expect(lint(withManifest({}), marketplaceOf([{ name: 'p', source: './plugins/p' }]))).toEqual(
      [],
    )
  })

  it.each([
    ['an empty entry version', '', { version: '1' }],
    ['an empty manifest version', '1', { version: '' }],
    ['two empty versions', '', { version: '' }],
    ['an entry version that is not a string', 1, { version: '1' }],
    ['an entry version that is null', null, { version: '1' }],
    ['a manifest version that is not a string', '1', { version: 1 }],
    ['a manifest version that is null', '1', { version: null }],
  ])('stays silent for %s', (_title, version, fields) => {
    expect(lint(withManifest(fields), entry(version))).toEqual([])
  })

  it.each([
    ['a source with no manifest', { 'plugins/p/x.txt': 'x' }],
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
    ['a source that is a file', { plugins: 'a file' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry('1'))).toEqual([])
  })

  it.each([
    ['an object source', { source: 'command', command: 'tool' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/plugins/p'],
    ['a source with ..', './plugins/../plugins/p'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(withManifest({ version: '1' }), entry('2', source))).toEqual([])
  })

  it('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'p', source: 'p', version: '2' }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(withManifest({ version: '1' }), code)).toEqual([])
  })

  it('stays silent for an entry that is not an object', () => {
    expect(lint(withManifest({ version: '1' }), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest that is a dangling link', () => {
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, entry('1'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'p', version: '1' }) })
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, entry('1'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a source that is a link out of the marketplace root', () => {
    const repo = tree({
      'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', version: '1' }),
    })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry('1'))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a link out of the repository, and for a dangling link',
    () => {
      const outside = tree({
        'p/.claude-plugin/plugin.json': manifestOf({ name: 'p', version: '1' }),
      })
      const dir = tree({})
      link(dir, 'plugins/far', path.join(outside, 'p'))
      link(dir, 'plugins/dead', 'gone')
      expect(lint(dir, entry('1', './plugins/far'))).toEqual([])
      expect(lint(dir, entry('1', './plugins/dead'))).toEqual([])
    },
  )

  it.skipIf(noLinks)('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree(
      { 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', version: '1' }) },
      false,
    )
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry('1'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent for a manifest that the rule cannot read', () => {
    const dir = withManifest({ version: '1' })
    withoutAccess(path.join(dir, 'plugins', 'p'), () => {
      expect(lint(dir, entry('2'))).toEqual([])
    })
  })
})
