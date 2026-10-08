// The rule compares each `enabledPlugins` key `plugin@marketplace` with the
// entries of the `marketplace.json` that the marketplace names in
// `extraKnownMarketplaces`. The marketplaces are on disk, because the rule
// reads them. The files glob and the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintSettings, noLinks, tree } from '../marketplace-tree.test-support.ts'

const RULE = 'settings-enabled-plugins-entry-exists'
const MARKET = '.claude-plugin/marketplace.json'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const lint = (dir: string, code: string, file = PROJECT) => lintSettings(RULE, dir, file, code)
const marketplace = (names: unknown[] = ['fmt'], fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: 'acme',
    owner: { name: 'o' },
    plugins: names.map((name) => ({ name, source: './plugins/p' })),
    ...fields,
  })
/** A tree with a marketplace at `market/` that has the entries `names`. */
const withMarket = (names: unknown[] = ['fmt'], git = true) =>
  tree({ [`market/${MARKET}`]: marketplace(names) }, git)
const directory = (p: unknown) => ({ source: 'directory', path: p })
const file = (p: unknown) => ({ source: 'file', path: p })
const declare = (source: unknown, key = 'team') => ({ [key]: { source } })
/** The text of a settings file with the `enabledPlugins` keys and marketplaces given. */
const settings = (enabled: Record<string, unknown>, marketplaces?: Record<string, unknown>) =>
  JSON.stringify({
    enabledPlugins: enabled,
    ...(marketplaces === undefined ? {} : { extraKnownMarketplaces: marketplaces }),
  })
const OWN = declare(directory('market'))

describe(RULE, () => {
  it('reports a plugin that is no entry of a directory source', () => {
    const dir = withMarket()
    const code = `{
  "enabledPlugins": {
    "nope@team": true
  },
  "extraKnownMarketplaces": {
    "team": { "source": { "source": "directory", "path": "market" } }
  }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      line: 3,
      column: 5,
      endLine: 3,
      endColumn: 16,
    })
    expect(messages[0]?.message).toBe(
      'The "enabledPlugins" key "nope@team" names the plugin "nope", and the marketplace.json of "team" has no entry with that "name". The docs say that the entry "name" is the key that "enabledPlugins" takes.',
    )
  })

  it('reports a plugin that is no entry of a file source', () => {
    const dir = withMarket()
    const code = settings({ 'nope@team': true }, declare(file(`market/${MARKET}`)))
    expect(lint(dir, code).map((m) => m.messageId)).toEqual(['missing'])
  })

  it('reports in .claude/settings.local.json', () => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }, OWN), LOCAL)).toHaveLength(1)
  })

  it.each([
    ['false', false],
    ['a string', 'yes'],
    ['null', null],
    ['an object', {}],
  ])('reports a key whose value is %s', (_title, value) => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': value }, OWN))).toHaveLength(1)
  })

  it('reports an entry list that is empty', () => {
    const dir = withMarket([])
    expect(lint(dir, settings({ 'fmt@team': true }, OWN))).toHaveLength(1)
  })

  it('compares the names in the exact letter case, without a trim', () => {
    const dir = withMarket(['Fmt', 'fmt '])
    expect(lint(dir, settings({ 'fmt@team': true }, OWN))).toHaveLength(1)
    expect(lint(dir, settings({ 'Fmt@team': true }, OWN))).toEqual([])
    expect(lint(dir, settings({ ' Fmt@team': true }, OWN))).toHaveLength(1)
  })

  it('reports the manifest name of a plugin, which is not the entry name', () => {
    const dir = tree({
      [`market/${MARKET}`]: JSON.stringify({
        name: 'acme',
        owner: { name: 'o' },
        plugins: [{ name: 'fmt', source: './plugins/fmt' }],
      }),
      'market/plugins/fmt/.claude-plugin/plugin.json': JSON.stringify({ name: 'formatter' }),
    })
    const messages = lint(dir, settings({ 'formatter@team': true }, OWN))
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).not.toContain('plugin.json')
  })

  it('reports each key that is no entry, and no key that is an entry', () => {
    const dir = withMarket(['a', 'b'])
    const code =
      '{"enabledPlugins": {"a@team": true, "x@team": true, "b@team": false, "y@team": true}, "extraKnownMarketplaces": {"team": {"source": {"source": "directory", "path": "market"}}}}'
    const messages = lint(dir, code)
    expect(messages.map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['missing', 1, 37],
      ['missing', 1, 70],
    ])
    expect(messages.map((m) => m.message.match(/key "([^"]+)"/)?.[1])).toEqual(['x@team', 'y@team'])
  })

  it('finds the marketplace by its key, not by the name in the file', () => {
    // The file says "acme", and the key says "team".
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@acme': true }, OWN))).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }, OWN))).toHaveLength(1)
  })

  it('reads the marketplace from the other project file when the same file lacks it', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: OWN }),
      [PROJECT]: JSON.stringify({ extraKnownMarketplaces: OWN }),
    })
    expect(lint(dir, settings({ 'nope@team': true }), PROJECT)).toHaveLength(1)
    expect(lint(dir, settings({ 'nope@team': true }), LOCAL)).toHaveLength(1)
    expect(lint(dir, settings({ 'fmt@team': true }), PROJECT)).toEqual([])
    expect(lint(dir, settings({ 'fmt@team': true }), LOCAL)).toEqual([])
  })

  it('reads the other file when the same file declares only other marketplaces', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: OWN }),
    })
    const own = declare(directory('market'), 'other')
    expect(lint(dir, settings({ 'nope@team': true }, own))).toHaveLength(1)
  })

  it('lets the marketplace of the same file win over the other file', () => {
    const dir = tree({
      [`good/${MARKET}`]: marketplace(['fmt']),
      [`bad/${MARKET}`]: marketplace(['other']),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: declare(directory('bad')) }),
      [PROJECT]: JSON.stringify({ extraKnownMarketplaces: declare(directory('bad')) }),
    })
    const own = declare(directory('good'))
    expect(lint(dir, settings({ 'fmt@team': true }, own), PROJECT)).toEqual([])
    expect(lint(dir, settings({ 'fmt@team': true }, own), LOCAL)).toEqual([])
    const reverse = declare(directory('bad'))
    const good = tree({
      [`good/${MARKET}`]: marketplace(['fmt']),
      [`bad/${MARKET}`]: marketplace(['other']),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: declare(directory('good')) }),
      [PROJECT]: JSON.stringify({ extraKnownMarketplaces: declare(directory('good')) }),
    })
    expect(lint(good, settings({ 'fmt@team': true }, reverse), PROJECT)).toHaveLength(1)
    expect(lint(good, settings({ 'fmt@team': true }, reverse), LOCAL)).toHaveLength(1)
  })

  it('resolves a relative path from the repository root, for a nested .claude directory', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(['fmt']),
      [`packages/mk/.claude/market/${MARKET}`]: marketplace(['other']),
    })
    const nested = 'packages/mk/.claude/settings.json'
    expect(lint(dir, settings({ 'fmt@team': true }, OWN), nested)).toEqual([])
    expect(lint(dir, settings({ 'other@team': true }, OWN), nested)).toHaveLength(1)
  })

  it('reads the other file of a nested .claude directory', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      'packages/mk/.claude/settings.local.json': JSON.stringify({ extraKnownMarketplaces: OWN }),
    })
    const nested = 'packages/mk/.claude/settings.json'
    expect(lint(dir, settings({ 'nope@team': true }), nested)).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    const dir = withMarket(['fmt'], false)
    expect(lint(dir, settings({ 'nope@team': true }, OWN))).toHaveLength(1)
    expect(lint(dir, settings({ 'fmt@team': true }, OWN))).toEqual([])
  })

  it('reads the last of two members of one key, as JSON.parse does', () => {
    const dir = withMarket()
    const code = `{
  "enabledPlugins": { "nope@team": true, "nope@team": true, "fmt@team": true, "fmt@team": false },
  "extraKnownMarketplaces": { "team": { "source": { "source": "directory", "path": "market" } } }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ line: 2, column: 42 })
  })

  it('reads the last of two enabledPlugins keys and two extraKnownMarketplaces keys', () => {
    const dir = withMarket()
    const code = `{
  "enabledPlugins": { "fmt@team": true },
  "enabledPlugins": { "nope@team": true },
  "extraKnownMarketplaces": { "team": { "source": { "source": "directory", "path": "nothing" } } },
  "extraKnownMarketplaces": { "team": { "source": { "source": "directory", "path": "market" } } }
}`
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ line: 3, column: 23 })
  })

  it('reads the last of two source keys and two path keys', () => {
    const dir = withMarket()
    const code =
      '{"enabledPlugins": {"nope@team": true}, "extraKnownMarketplaces": {"team": {"source": {"source": "github", "source": "directory", "path": "x", "path": "market"}}}}'
    expect(lint(dir, code)).toHaveLength(1)
  })

  it.skipIf(noLinks)('reads a marketplace through a link inside the repository', () => {
    const dir = withMarket()
    link(dir, 'alias', 'market')
    expect(lint(dir, settings({ 'nope@team': true }, declare(directory('alias'))))).toHaveLength(1)
  })

  it('reads a path that goes up and stays in the repository', () => {
    const dir = withMarket()
    const marketplaces = declare(directory('other/../market'))
    expect(lint(dir, settings({ 'nope@team': true }, marketplaces))).toHaveLength(1)
  })

  it('reports a key whose marketplace part is a space', () => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@ ': true }, declare(directory('market'), ' ')))).toHaveLength(
      1,
    )
  })
})

describe(`${RULE} (silent)`, () => {
  it('stays silent when the plugin is an entry', () => {
    const dir = withMarket(['fmt', 'lint'])
    expect(lint(dir, settings({ 'fmt@team': true, 'lint@team': false }, OWN))).toEqual([])
    expect(lint(dir, settings({ 'fmt@team': true }, declare(file(`market/${MARKET}`))))).toEqual([])
    expect(lint(dir, settings({ 'fmt@team': true }, OWN), LOCAL)).toEqual([])
  })

  it('stays silent when the marketplace is declared in neither file', () => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }))).toEqual([])
    expect(
      lint(dir, settings({ 'nope@team': true }, declare(directory('market'), 'other'))),
    ).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }), LOCAL)).toEqual([])
  })

  it('stays silent when the other file declares the marketplace with another key', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: declare(directory('market'), 'other') }),
    })
    expect(lint(dir, settings({ 'nope@team': true }))).toEqual([])
  })

  it('stays silent for the names of the prototype of an object', () => {
    const dir = withMarket()
    const text = settings(
      { 'nope@constructor': true, 'nope@toString': true, 'nope@__proto__': true },
      OWN,
    )
    expect(lint(dir, text)).toEqual([])
    const other = tree({ [LOCAL]: JSON.stringify({ extraKnownMarketplaces: OWN }) })
    expect(lint(other, text)).toEqual([])
  })

  it('stays silent when the same file declares the marketplace with another source', () => {
    // The same file decides, and the other file does not make the answer.
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      [LOCAL]: JSON.stringify({ extraKnownMarketplaces: OWN }),
    })
    const own = declare({ source: 'github', repo: 'o/market' })
    expect(lint(dir, settings({ 'nope@team': true }, own))).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }, { team: 'market' }))).toEqual([])
  })

  it.each([
    ['github', { source: 'github', repo: 'o/market', path: 'market' }],
    ['git', { source: 'git', url: 'https://x.test/r.git', path: 'market' }],
    ['url', { source: 'url', url: 'https://x.test/m.json', path: 'market' }],
    ['settings', { source: 'settings', name: 'team', plugins: [], path: 'market' }],
    ['npm', { source: 'npm', package: 'acme', path: 'market' }],
    ['an unknown type', { source: 'ftp', path: 'market' }],
    ['no type', { path: 'market' }],
  ])('stays silent for a %s source', (_title, source) => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }, declare(source)))).toEqual([])
  })

  it.each([
    ['a string', 'market'],
    ['null', null],
    ['an array', [directory('market')]],
  ])('stays silent when the source is %s', (_title, source) => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }, declare(source)))).toEqual([])
  })

  it('stays silent when there is no marketplace.json', () => {
    expect(lint(tree({}), settings({ 'nope@team': true }, OWN))).toEqual([])
    expect(lint(tree({}), settings({ 'nope@team': true }, declare(file('market/m.json'))))).toEqual(
      [],
    )
  })

  it.each([
    ['does not parse', '{"plugins": '],
    ['is empty', ''],
    ['is an array', '["nope"]'],
    ['is a string', '"nope"'],
  ])('stays silent when the marketplace.json %s', (_title, text) => {
    const dir = tree({ [`market/${MARKET}`]: text })
    expect(lint(dir, settings({ 'nope@team': true }, OWN))).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }, declare(file(`market/${MARKET}`))))).toEqual(
      [],
    )
  })

  it.each([
    ['is missing', undefined],
    ['is not an array', {}],
    ['is a string', 'nope'],
  ])('stays silent when plugins %s', (_title, plugins) => {
    const dir = tree({ [`market/${MARKET}`]: JSON.stringify({ name: 'acme', plugins }) })
    expect(lint(dir, settings({ 'nope@team': true }, OWN))).toEqual([])
  })

  it('stays silent when the file source names a directory', () => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }, declare(file('market'))))).toEqual([])
  })

  it('stays silent for a path out of the repository', () => {
    const outside = withMarket()
    const dir = tree({})
    const up = path.relative(dir, outside)
    expect(lint(dir, settings({ 'nope@team': true }, declare(directory(`${up}/market`))))).toEqual(
      [],
    )
    expect(
      lint(dir, settings({ 'nope@team': true }, declare(file(`${up}/market/${MARKET}`)))),
    ).toEqual([])
  })

  it('stays silent for a path above the directory that holds .claude when there is no .git', () => {
    const dir = tree({ [MARKET]: marketplace(), 'sub/.claude/keep': '' }, false)
    const code = settings({ 'nope@team': true }, declare(directory('..')))
    expect(lint(dir, code, 'sub/.claude/settings.json')).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a link that leads out of the repository', () => {
    const outside = withMarket()
    const dir = tree({})
    link(dir, 'alias', outside)
    link(dir, 'm.json', `${outside}/market/${MARKET}`)
    expect(lint(dir, settings({ 'nope@team': true }, declare(directory('alias/market'))))).toEqual(
      [],
    )
    expect(lint(dir, settings({ 'nope@team': true }, declare(file('m.json'))))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a dangling link', () => {
    const dir = tree({})
    link(dir, 'alias', 'nothing')
    link(dir, 'm.json', 'nothing.json')
    expect(lint(dir, settings({ 'nope@team': true }, declare(directory('alias'))))).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }, declare(file('m.json'))))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent when the other settings file is a link that leads out', () => {
    const outside = tree({ 's.json': JSON.stringify({ extraKnownMarketplaces: OWN }) })
    const dir = withMarket()
    link(dir, LOCAL, path.join(outside, 's.json'))
    expect(lint(dir, settings({ 'nope@team': true }))).toEqual([])
  })

  it('stays silent when the other settings file does not parse', () => {
    const dir = tree({
      [`market/${MARKET}`]: marketplace(),
      [LOCAL]: '{"extraKnownMarketplaces": ',
    })
    expect(lint(dir, settings({ 'nope@team': true }))).toEqual([])
  })

  it('stays silent for an absolute path', () => {
    const dir = withMarket()
    const absolute = (source: unknown) => settings({ 'nope@team': true }, declare(source))
    expect(lint(dir, absolute(directory(`${dir}/market`)))).toEqual([])
    expect(lint(dir, absolute(file(`${dir}/market/${MARKET}`)))).toEqual([])
    expect(lint(dir, absolute(directory('/market')))).toEqual([])
    expect(lint(dir, absolute(directory('C:\\market')))).toEqual([])
  })

  it.each([
    ['an empty path', ''],
    ['a path that is not a string', 3],
    ['a missing path', undefined],
  ])('stays silent for %s', (_title, given) => {
    const dir = withMarket()
    expect(lint(dir, settings({ 'nope@team': true }, declare(directory(given))))).toEqual([])
    expect(lint(dir, settings({ 'nope@team': true }, declare(file(given))))).toEqual([])
  })

  it.each([
    ['no @', 'nope'],
    ['two @', 'nope@team@x'],
    ['no plugin part', '@team'],
    ['no marketplace part', 'nope@'],
    ['an empty key', ''],
    ['only @', '@'],
  ])('stays silent for a key with %s, which the schema rule reports', (_title, key) => {
    const dir = withMarket()
    expect(lint(dir, settings({ [key]: true }, declare(directory('market'), key)))).toEqual([])
    expect(lint(dir, settings({ [key]: true }, OWN))).toEqual([])
  })

  it.each([
    ['not an object', '{"enabledPlugins": []}'],
    ['a string', '{"enabledPlugins": "nope@team"}'],
    ['null', '{"enabledPlugins": null}'],
    ['no enabledPlugins', '{"extraKnownMarketplaces": {}}'],
    ['a key inside a value', '{"env": {"enabledPlugins": {"nope@team": true}}}'],
    ['an empty object', '{}'],
    ['an array', '[]'],
  ])('stays silent for %s', (_title, code) => {
    const dir = withMarket()
    expect(lint(dir, code)).toEqual([])
  })

  it('stays silent for the alias additionalMarketplaces', () => {
    const dir = withMarket()
    const code = JSON.stringify({
      enabledPlugins: { 'nope@team': true },
      additionalMarketplaces: OWN,
    })
    expect(lint(dir, code)).toEqual([])
  })
})
