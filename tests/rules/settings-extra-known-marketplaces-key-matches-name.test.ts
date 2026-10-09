// The rule compares each `extraKnownMarketplaces` key with the `name` in the
// `marketplace.json` that a `file` or `directory` source points at. The
// marketplaces are on disk, because the rule reads them. The files glob and
// the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintSettings, noLinks, tree } from '../marketplace-tree.test-support.ts'

const RULE = 'settings-extra-known-marketplaces-key-matches-name'
const MARKET = '.claude-plugin/marketplace.json'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const lint = (dir: string, code: string, file = PROJECT) => lintSettings(RULE, dir, file, code)
const marketplace = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'acme', owner: { name: 'o' }, plugins: [], ...fields })
/** A tree with the marketplace `name` at `market/`. */
const withMarket = (name: unknown = 'acme', git = true) =>
  tree({ [`market/${MARKET}`]: marketplace({ name }) }, git)
const settings = (key: string, source: unknown) =>
  JSON.stringify({ extraKnownMarketplaces: { [key]: { source } } })
const directory = (path: unknown) => ({ source: 'directory', path })
const file = (path: unknown) => ({ source: 'file', path })

describe(RULE, () => {
  it('reports a key that differs from the name of a directory source', () => {
    const dir = withMarket()
    const code = `{
  "extraKnownMarketplaces": {
    "team": { "source": { "source": "directory", "path": "market" } }
  }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'mismatch',
      line: 3,
      column: 5,
      endLine: 3,
      endColumn: 11,
    })
    expect(messages[0]?.message).toBe(
      'The "extraKnownMarketplaces" key "team" differs from the "name" in the marketplace.json that it points at. That "name" is "acme". The docs say to key a marketplace by its own "name".',
    )
  })

  it('reports a key that differs from the name of a file source', () => {
    const dir = withMarket()
    const code = `{
  "extraKnownMarketplaces": {
    "team": { "source": { "source": "file", "path": "market/.claude-plugin/marketplace.json" } }
  }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'mismatch', line: 3, column: 5, endColumn: 11 })
  })

  it('reports in .claude/settings.local.json', () => {
    const dir = withMarket()
    const messages = lint(dir, settings('team', directory('market')), LOCAL)
    expect(messages.map((m) => m.messageId)).toEqual(['mismatch'])
  })

  it('reports a path that starts with ./', () => {
    const dir = withMarket()
    expect(lint(dir, settings('team', directory('./market')))).toHaveLength(1)
  })

  it('resolves a relative path from the repository root, for a nested .claude directory', () => {
    const dir = withMarket()
    const messages = lint(
      dir,
      settings('team', directory('market')),
      'packages/mk/.claude/settings.json',
    )
    expect(messages).toHaveLength(1)
    // The marketplace near the settings file is not the target of the path.
    const near = tree({
      [`market/${MARKET}`]: marketplace({ name: 'team' }),
      [`packages/mk/.claude/market/${MARKET}`]: marketplace({ name: 'acme' }),
    })
    expect(
      lint(near, settings('team', directory('market')), 'packages/mk/.claude/settings.json'),
    ).toEqual([])
  })

  it('reports in a tree with no .git', () => {
    // With no `.git`, the bound is `.claude/`, so the marketplace sits in it.
    const dir = tree({ [`.claude/market/${MARKET}`]: marketplace() }, false)
    expect(lint(dir, settings('team', directory('.claude/market')))).toHaveLength(1)
    // A marketplace beside `.claude/` is out of the bound.
    expect(lint(withMarket('acme', false), settings('team', directory('market')))).toEqual([])
  })

  it('compares the names in the exact letter case', () => {
    const dir = withMarket('Acme')
    expect(lint(dir, settings('acme', directory('market')))).toHaveLength(1)
  })

  it('compares the names without a trim', () => {
    expect(lint(withMarket('acme '), settings('acme', directory('market')))).toHaveLength(1)
    expect(lint(withMarket('acme'), settings(' acme', directory('market')))).toHaveLength(1)
  })

  it('reports an empty key', () => {
    const dir = withMarket()
    const messages = lint(dir, settings('', directory('market')))
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('key ""')
  })

  it('reports each key that differs, and no key that matches', () => {
    const dir = tree({
      [`a/${MARKET}`]: marketplace({ name: 'a' }),
      [`b/${MARKET}`]: marketplace({ name: 'b' }),
      [`c/${MARKET}`]: marketplace({ name: 'c' }),
    })
    const code = JSON.stringify({
      extraKnownMarketplaces: {
        a: { source: directory('a') },
        x: { source: directory('b') },
        y: { source: file(`c/${MARKET}`) },
      },
    })
    const messages = lint(dir, code)
    expect(messages.map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['mismatch', 1, 77],
      ['mismatch', 1, 126],
    ])
    expect(messages.map((m) => m.message.match(/key "(\w+)"/)?.[1])).toEqual(['x', 'y'])
  })

  it('reads the last of two members of one key, as JSON.parse does', () => {
    const dir = withMarket()
    const code = `{
  "extraKnownMarketplaces": {
    "acme": { "source": { "source": "directory", "path": "market" } },
    "acme": { "source": { "source": "directory", "path": "nothing" } }
  }
}`
    expect(lint(dir, code)).toEqual([])
    const last = `{
  "extraKnownMarketplaces": {
    "team": { "source": { "source": "directory", "path": "nothing" } },
    "team": { "source": { "source": "directory", "path": "market" } }
  }
}`
    const messages = lint(dir, last)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ line: 4, column: 5 })
  })

  it('reads the last of two extraKnownMarketplaces keys', () => {
    const dir = withMarket()
    const code = `{
  "extraKnownMarketplaces": { "acme": { "source": { "source": "directory", "path": "market" } } },
  "extraKnownMarketplaces": { "team": { "source": { "source": "directory", "path": "market" } } }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ line: 3, column: 31 })
  })

  it('reads the last of two source keys and two path keys', () => {
    const dir = withMarket()
    const code =
      '{"extraKnownMarketplaces": {"team": {"source": {"source": "github", "source": "directory", "path": "x", "path": "market"}}}}'
    expect(lint(dir, code)).toHaveLength(1)
  })

  it.skipIf(noLinks)('reports a directory that is a link inside the repository', () => {
    const dir = withMarket()
    link(dir, 'alias', 'market')
    expect(lint(dir, settings('team', directory('alias')))).toHaveLength(1)
  })

  it('reports a path that goes up and stays in the repository', () => {
    const dir = withMarket()
    expect(lint(dir, settings('team', directory('other/../market')))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it('stays silent when the key equals the name', () => {
    const dir = withMarket()
    expect(lint(dir, settings('acme', directory('market')))).toEqual([])
    expect(lint(dir, settings('acme', file(`market/${MARKET}`)))).toEqual([])
    expect(lint(dir, settings('acme', directory('market')), LOCAL)).toEqual([])
  })

  it.each([
    ['is missing', {}],
    ['is not a string', { name: 3 }],
    ['is empty', { name: '' }],
  ])('stays silent when the name %s', (_title, fields) => {
    const text = JSON.stringify({ owner: { name: 'o' }, plugins: [], ...fields })
    const dir = tree({ [`market/${MARKET}`]: text })
    expect(lint(dir, settings('team', directory('market')))).toEqual([])
  })

  it('stays silent when there is no marketplace.json', () => {
    expect(lint(tree({}), settings('team', directory('market')))).toEqual([])
    expect(lint(tree({}), settings('team', file('market/m.json')))).toEqual([])
  })

  it.each([
    ['does not parse', '{"name": '],
    ['is empty', ''],
    ['is an array', '["acme"]'],
    ['is a string', '"acme"'],
  ])('stays silent when the marketplace.json %s', (_title, text) => {
    const dir = tree({ [`market/${MARKET}`]: text })
    expect(lint(dir, settings('team', directory('market')))).toEqual([])
    expect(lint(dir, settings('team', file(`market/${MARKET}`)))).toEqual([])
  })

  it('stays silent when the file source names a directory', () => {
    const dir = withMarket()
    expect(lint(dir, settings('team', file('market')))).toEqual([])
  })

  it('stays silent for a path out of the repository', () => {
    const outside = withMarket()
    const dir = tree({})
    const up = path.relative(dir, outside)
    expect(lint(dir, settings('team', directory(`${up}/market`)))).toEqual([])
    expect(lint(dir, settings('team', file(`${up}/market/${MARKET}`)))).toEqual([])
  })

  it('stays silent for a path above the directory that holds .claude when there is no .git', () => {
    const dir = tree({ [MARKET]: marketplace(), 'sub/.claude/keep': '' }, false)
    expect(lint(dir, settings('team', directory('..')), 'sub/.claude/settings.json')).toEqual([])
    expect(lint(dir, settings('team', directory('market')), 'sub/.claude/settings.json')).toEqual(
      [],
    )
  })

  it.skipIf(noLinks)('stays silent for a link that leads out of the repository', () => {
    const outside = withMarket()
    const dir = tree({})
    link(dir, 'alias', outside)
    link(dir, 'm.json', `${outside}/market/${MARKET}`)
    expect(lint(dir, settings('team', directory('alias/market')))).toEqual([])
    expect(lint(dir, settings('team', file('m.json')))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a link on the path that leads out', () => {
    const outside = withMarket()
    const dir = tree({})
    link(dir, 'alias', outside)
    expect(lint(dir, settings('team', file(`alias/market/${MARKET}`)))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a dangling link', () => {
    const dir = tree({})
    link(dir, 'alias', 'nothing')
    link(dir, 'm.json', 'nothing.json')
    expect(lint(dir, settings('team', directory('alias')))).toEqual([])
    expect(lint(dir, settings('team', file('m.json')))).toEqual([])
  })

  it('stays silent for an absolute path', () => {
    const dir = withMarket()
    expect(lint(dir, settings('team', directory(`${dir}/market`)))).toEqual([])
    expect(lint(dir, settings('team', file(`${dir}/market/${MARKET}`)))).toEqual([])
    expect(lint(dir, settings('team', directory('/market')))).toEqual([])
    expect(lint(dir, settings('team', directory('C:\\market')))).toEqual([])
  })

  it.each([
    ['an empty path', ''],
    ['a path that is not a string', 3],
    ['a missing path', undefined],
  ])('stays silent for %s', (_title, given) => {
    const dir = withMarket()
    expect(lint(dir, settings('team', directory(given)))).toEqual([])
    expect(lint(dir, settings('team', file(given)))).toEqual([])
  })

  it.each([
    ['github', { source: 'github', repo: 'o/market', path: 'market' }],
    ['git', { source: 'git', url: 'https://x.test/r.git', path: 'market' }],
    ['url', { source: 'url', url: 'https://x.test/m.json', path: 'market' }],
    ['settings', { source: 'settings', name: 'acme', plugins: [], path: 'market' }],
    ['npm', { source: 'npm', package: 'acme', path: 'market' }],
    ['an unknown type', { source: 'ftp', path: 'market' }],
    ['no type', { path: 'market' }],
  ])('stays silent for a %s source', (_title, source) => {
    const dir = withMarket()
    expect(lint(dir, settings('team', source))).toEqual([])
  })

  it.each([
    ['a string', 'market'],
    ['null', null],
    ['an array', [directory('market')]],
  ])('stays silent when the source is %s', (_title, source) => {
    const dir = withMarket()
    expect(lint(dir, settings('team', source))).toEqual([])
  })

  it.each([
    ['not an object', '{"extraKnownMarketplaces": []}'],
    ['a string', '{"extraKnownMarketplaces": "market"}'],
    ['null', '{"extraKnownMarketplaces": null}'],
    ['an entry that is a string', '{"extraKnownMarketplaces": {"team": "market"}}'],
    ['an entry with no source', '{"extraKnownMarketplaces": {"team": {}}}'],
    ['no extraKnownMarketplaces', '{"enabledPlugins": {}}'],
    ['a key inside a value', '{"env": {"extraKnownMarketplaces": {"team": 1}}}'],
    [
      'the alias additionalMarketplaces',
      JSON.stringify({ additionalMarketplaces: { team: { source: directory('market') } } }),
    ],
    ['an empty object', '{}'],
    ['an array', '[]'],
  ])('stays silent for %s', (_title, code) => {
    const dir = withMarket()
    expect(lint(dir, code)).toEqual([])
  })
})
