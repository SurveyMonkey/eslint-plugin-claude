// The rule reads the project settings files beside the marketplace root, to learn how the
// marketplace is registered. The tree is on disk, because the rule reads it. The files glob and
// the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  link,
  lintMarketplace,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'

const RULE = 'marketplace-relative-source-url-hosted'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)

const URL_SOURCE = { source: 'url', url: 'https://plugins.example.com/marketplace.json' }
/** The text of a settings file that registers the marketplace `acme` with `source`. */
const registers = (source: unknown, key = 'acme') =>
  JSON.stringify({ extraKnownMarketplaces: { [key]: { source } } })
const entry = (source: unknown = './plugins/p') => marketplaceOf([{ name: 'p', source }])

describe(RULE, () => {
  it('reports a relative source when settings.json registers the marketplace by url', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p" }
  ]
}`
    const messages = lint(tree({ '.claude/settings.json': registers(URL_SOURCE) }), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'relativeInUrl',
      line: 4,
      column: 30,
      endColumn: 43,
    })
    expect(messages[0]?.message).toContain('"./plugins/p"')
  })

  it('reports when only settings.local.json registers the marketplace', () => {
    const dir = tree({ '.claude/settings.local.json': registers(URL_SOURCE) })
    expect(lint(dir, entry())).toHaveLength(1)
  })

  it('reports each string source, and no object source', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    const code = marketplaceOf([
      { name: 'a', source: './plugins/a' },
      { name: 'b', source: { source: 'github', repo: 'acme/b' } },
      { name: 'c', source: '.' },
      { name: 'd', source: 'd' },
    ])
    expect(lint(dir, code).map((m) => m.message.match(/"source" "([^"]*)"/)?.[1])).toEqual([
      './plugins/a',
      '.',
      'd',
    ])
  })

  it('reports in a tree with no .git', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) }, false)
    expect(lint(dir, entry())).toHaveLength(1)
  })

  it('follows the file of higher precedence whole: settings.local.json over settings.json', () => {
    const dir = tree({
      '.claude/settings.json': registers({ source: 'github', repo: 'acme/m' }),
      '.claude/settings.local.json': registers(URL_SOURCE),
    })
    expect(lint(dir, entry())).toHaveLength(1)
  })

  it('reports from settings.json when settings.local.json does not declare the marketplace', () => {
    const dir = tree({
      '.claude/settings.json': registers(URL_SOURCE),
      '.claude/settings.local.json': registers({ source: 'github', repo: 'a/b' }, 'other'),
    })
    expect(lint(dir, entry())).toHaveLength(1)
    const bare = tree({
      '.claude/settings.json': registers(URL_SOURCE),
      '.claude/settings.local.json': '{}',
    })
    expect(lint(bare, entry())).toHaveLength(1)
  })

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
  ])('reports from settings.local.json when settings.json %s', (_title, text) => {
    const dir = tree({
      '.claude/settings.json': text,
      '.claude/settings.local.json': registers(URL_SOURCE),
    })
    expect(lint(dir, entry())).toHaveLength(1)
  })

  it.skipIf(noLinks)(
    'reports from settings.local.json when settings.json is a dangling link',
    () => {
      const dir = tree({ '.claude/settings.local.json': registers(URL_SOURCE) })
      link(dir, '.claude/settings.json', 'gone.json')
      expect(lint(dir, entry())).toHaveLength(1)
    },
  )

  it.skipIf(noLinks)(
    'reports from settings.local.json when settings.json is out of the repository',
    () => {
      const outside = tree({ 'settings.json': registers({ source: 'github', repo: 'a/b' }) })
      const dir = tree({ '.claude/settings.local.json': registers(URL_SOURCE) })
      link(dir, '.claude/settings.json', path.join(outside, 'settings.json'))
      expect(lint(dir, entry())).toHaveLength(1)
    },
  )

  it('reads the last of two name keys, as JSON.parse does', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    const code = '{"name": "other", "name": "acme", "plugins": [{"name": "p", "source": "./p"}]}'
    expect(lint(dir, code)).toHaveLength(1)
    const first = '{"name": "acme", "name": "other", "plugins": [{"name": "p", "source": "./p"}]}'
    expect(lint(dir, first)).toEqual([])
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['a github source', { source: 'github', repo: 'acme/m' }],
    ['a git source', { source: 'git', url: 'https://git.example.com/m.git' }],
    ['a file source', { source: 'file', path: '.claude-plugin/marketplace.json' }],
    ['a directory source', { source: 'directory', path: '.' }],
    ['a settings source', { source: 'settings', name: 'acme', plugins: [] }],
    ['a source with no type', { url: 'https://plugins.example.com/marketplace.json' }],
    ['a source type that is not a string', { source: 3 }],
    ['a source that is not an object', 'url'],
    ['a source that is null', null],
  ])('stays silent when the marketplace has %s', (_title, source) => {
    expect(lint(tree({ '.claude/settings.json': registers(source) }), entry())).toEqual([])
  })

  it('stays silent when settings.local.json replaces a url source with another type', () => {
    const dir = tree({
      '.claude/settings.json': registers(URL_SOURCE),
      '.claude/settings.local.json': registers({ source: 'github', repo: 'a/b' }),
    })
    expect(lint(dir, entry())).toEqual([])
  })

  it('stays silent when no settings file registers the marketplace', () => {
    expect(lint(tree({}), entry())).toEqual([])
    const other = tree({ '.claude/settings.json': registers(URL_SOURCE, 'other') })
    expect(lint(other, entry())).toEqual([])
    const none = tree({ '.claude/settings.json': '{}' })
    expect(lint(none, entry())).toEqual([])
    const odd = tree({ '.claude/settings.json': '{"extraKnownMarketplaces": []}' })
    expect(lint(odd, entry())).toEqual([])
  })

  it('stays silent for a key of the prototype', () => {
    const code = marketplaceOf([{ name: 'p', source: './p' }], { name: 'constructor' })
    const dir = tree({
      '.claude/settings.json': registers(URL_SOURCE, 'constructor'),
      '.claude/settings.local.json': '{"extraKnownMarketplaces": {}}',
    })
    expect(lint(dir, code)).toHaveLength(1)
    const none = tree({ '.claude/settings.json': registers(URL_SOURCE, 'other') })
    expect(lint(none, code)).toEqual([])
  })

  it('stays silent when the entries have no string source', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    const code = marketplaceOf([{ name: 'p', source: { source: 'github', repo: 'a/b' } }, 'x', {}])
    expect(lint(dir, code)).toEqual([])
    expect(lint(dir, '{"name": "acme"}')).toEqual([])
  })

  it('stays silent when the marketplace has no string name', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    expect(lint(dir, '{"plugins": [{"name": "p", "source": "./p"}]}')).toEqual([])
    expect(lint(dir, '{"name": 3, "plugins": [{"name": "p", "source": "./p"}]}')).toEqual([])
    const numeric = tree({ '.claude/settings.json': registers(URL_SOURCE, '3') })
    expect(lint(numeric, '{"name": 3, "plugins": [{"name": "p", "source": "./p"}]}')).toEqual([])
  })

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
    ['is null', 'null'],
  ])('stays silent when settings.json %s', (_title, text) => {
    expect(lint(tree({ '.claude/settings.json': text }), entry())).toEqual([])
  })

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
  ])('stays silent when settings.local.json %s, because it can hold the entry', (_title, text) => {
    const dir = tree({
      '.claude/settings.json': registers(URL_SOURCE),
      '.claude/settings.local.json': text,
    })
    expect(lint(dir, entry())).toEqual([])
  })

  it('stays silent when the registration is not in the .claude/ of the marketplace root', () => {
    const repo = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    expect(lint(path.join(repo, 'site'), entry())).toEqual([])
  })

  it.skipIf(noLinks)(
    'lets settings.local.json decide when settings.json is a dangling link',
    () => {
      const dir = tree({ '.claude/settings.local.json': registers(URL_SOURCE) })
      link(dir, '.claude/settings.json', 'gone.json')
      expect(lint(dir, entry())).toHaveLength(1)
      const github = tree({
        '.claude/settings.local.json': registers({ source: 'github', repo: 'a/b' }),
      })
      link(github, '.claude/settings.json', 'gone.json')
      expect(lint(github, entry())).toEqual([])
    },
  )

  it.skipIf(noLinks)('bounds a settings.json link at .claude when there is no .git', () => {
    const dir = tree({ 'shared/s.json': registers(URL_SOURCE) }, false)
    link(dir, '.claude/settings.json', '../shared/s.json')
    expect(lint(dir, entry())).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a settings.local.json that is a dangling link', () => {
    const dir = tree({ '.claude/settings.json': registers(URL_SOURCE) })
    link(dir, '.claude/settings.local.json', 'gone.json')
    expect(lint(dir, entry())).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a settings.json link out of the repository', () => {
    const outside = tree({ 'settings.json': registers(URL_SOURCE) })
    const dir = tree({})
    link(dir, '.claude/settings.json', path.join(outside, 'settings.json'))
    expect(lint(dir, entry())).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a .claude directory out of the repository', () => {
    const outside = tree({ 'settings.json': registers(URL_SOURCE) })
    const dir = tree({})
    link(dir, '.claude', outside)
    expect(lint(dir, entry())).toEqual([])
  })
})
