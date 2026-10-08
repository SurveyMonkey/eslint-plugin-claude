// The reader of a `marketplace.json` that a settings file points at. Each case
// builds a real directory tree, because the reader walks the file system and
// the cases include links. The expected values are written by hand.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  declaredSource,
  marketplacesOf,
  readMarketplaceFile,
  sourceOf,
} from '../src/marketplace-file.ts'
import { link, noLinks, tree } from './marketplace-tree.test-support.ts'

const MARKET = '.claude-plugin/marketplace.json'
const market = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'acme', owner: { name: 'o' }, plugins: [{ name: 'fmt' }], ...fields })
const SETTINGS = '.claude/settings.json'
const settingsOf = (dir: string, file = SETTINGS) => path.join(dir, file)
const directory = (p: unknown) => ({ source: 'directory', path: p })
const file = (p: unknown) => ({ source: 'file', path: p })
const ACME = { kind: 'marketplace', name: 'acme', entries: ['fmt'] }

describe('readMarketplaceFile', () => {
  it('reads the marketplace root of a directory source', () => {
    const dir = tree({ [`market/${MARKET}`]: market() })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual(ACME)
  })

  it('reads the marketplace file of a file source', () => {
    const dir = tree({ [`market/${MARKET}`]: market() })
    expect(readMarketplaceFile(settingsOf(dir), file(`market/${MARKET}`))).toEqual(ACME)
  })

  it('reads a file source whose file is not in a .claude-plugin directory', () => {
    const dir = tree({ 'market/m.json': market() })
    expect(readMarketplaceFile(settingsOf(dir), file('market/m.json'))).toEqual(ACME)
  })

  it('reads the target of a path that starts with ./', () => {
    const dir = tree({ [`market/${MARKET}`]: market() })
    expect(readMarketplaceFile(settingsOf(dir), directory('./market'))).toEqual(ACME)
    expect(readMarketplaceFile(settingsOf(dir), directory('./market/'))).toEqual(ACME)
  })

  it('reads the repository root for the path "."', () => {
    const dir = tree({ [MARKET]: market() })
    expect(readMarketplaceFile(settingsOf(dir), directory('.'))).toEqual(ACME)
  })

  it('resolves a relative path from the repository root, not from the .claude directory', () => {
    const dir = tree({
      [`market/${MARKET}`]: market(),
      'packages/mk/.claude/market/.claude-plugin/marketplace.json': market({ name: 'near' }),
    })
    const settings = settingsOf(dir, 'packages/mk/.claude/settings.json')
    expect(readMarketplaceFile(settings, directory('market'))).toEqual(ACME)
  })

  it('resolves from the directory that holds .claude when the tree has no .git', () => {
    const dir = tree(
      { [`.claude/market/${MARKET}`]: market(), [`market/${MARKET}`]: market() },
      false,
    )
    expect(readMarketplaceFile(settingsOf(dir), directory('.claude/market'))).toEqual(ACME)
    // The bound is `.claude/`, so a marketplace beside it is out of the bound.
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'unreadable',
    })
  })

  it('reads a path that goes up and stays in the repository', () => {
    const dir = tree({ [`market/${MARKET}`]: market(), 'a/keep': '' })
    expect(readMarketplaceFile(settingsOf(dir), directory('a/../market'))).toEqual(ACME)
  })

  it('reads the file for the .claude/settings.local.json target', () => {
    const dir = tree({ [`market/${MARKET}`]: market() })
    const local = settingsOf(dir, '.claude/settings.local.json')
    expect(readMarketplaceFile(local, directory('market'))).toEqual(ACME)
  })

  it('reads the last of two name keys and two plugins keys, as JSON.parse does', () => {
    const dir = tree({
      [`market/${MARKET}`]:
        '{"name": "first", "name": "acme", "plugins": [{"name": "a"}], "plugins": [{"name": "fmt"}]}',
    })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual(ACME)
  })

  it('lists the string names of the entries in file order', () => {
    const dir = tree({
      [`market/${MARKET}`]: market({
        plugins: [{ name: 'b' }, { name: 3 }, 'c', null, { name: '' }, {}, { name: 'a' }],
      }),
    })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'marketplace',
      name: 'acme',
      entries: ['b', '', 'a'],
    })
  })

  it('gives no name when the name is not a string', () => {
    const dir = tree({ [`market/${MARKET}`]: market({ name: 3 }) })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'marketplace',
      name: undefined,
      entries: ['fmt'],
    })
  })

  it('gives an empty name as it is', () => {
    const dir = tree({ [`market/${MARKET}`]: market({ name: '' }) })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toMatchObject({ name: '' })
  })

  it.each([
    ['is missing', undefined],
    ['is not an array', {}],
    ['is a string', 'fmt'],
  ])('gives no entries when plugins %s', (_title, plugins) => {
    const dir = tree({ [`market/${MARKET}`]: JSON.stringify({ name: 'acme', plugins }) })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'marketplace',
      name: 'acme',
      entries: undefined,
    })
  })

  it('gives an empty list for an empty plugins array', () => {
    const dir = tree({ [`market/${MARKET}`]: market({ plugins: [] }) })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toMatchObject({ entries: [] })
  })

  it.skipIf(noLinks)('follows a link inside the repository', () => {
    const dir = tree({ [`real/${MARKET}`]: market() })
    link(dir, 'alias', 'real')
    expect(readMarketplaceFile(settingsOf(dir), directory('alias'))).toEqual(ACME)
    link(dir, 'file-alias.json', `real/${MARKET}`)
    expect(readMarketplaceFile(settingsOf(dir), file('file-alias.json'))).toEqual(ACME)
  })
})

describe('readMarketplaceFile (not local)', () => {
  const dir = tree({ [`market/${MARKET}`]: market() })
  it.each([
    ['github', { source: 'github', repo: 'o/r', path: 'market' }],
    ['git', { source: 'git', url: 'https://x.test/r.git', path: 'market' }],
    ['url', { source: 'url', url: 'https://x.test/m.json', path: 'market' }],
    ['settings', { source: 'settings', name: 'acme', plugins: [], path: 'market' }],
    ['npm', { source: 'npm', package: 'acme', path: 'market' }],
    ['a type that is not a string', { source: 3, path: 'market' }],
    ['a type with another letter case', { source: 'Directory', path: 'market' }],
    ['no type', { path: 'market' }],
  ])('gives not-local for %s', (_title, source) => {
    expect(readMarketplaceFile(settingsOf(dir), source)).toEqual({ kind: 'not-local' })
  })

  it.each([
    ['a string', 'market'],
    ['null', null],
    ['an array', [directory('market')]],
    ['undefined', undefined],
    ['a number', 3],
  ])('gives not-local for a source that is %s', (_title, source) => {
    expect(readMarketplaceFile(settingsOf(dir), source)).toEqual({ kind: 'not-local' })
  })

  it.each([
    ['an absolute path', path.join(dir, 'market')],
    ['a POSIX absolute path', '/market'],
    ['a Windows drive path', 'C:\\market'],
    ['a Windows rooted path', '\\market'],
    ['a UNC path', '\\\\host\\share\\market'],
    ['a path that is not a string', 3],
    ['a missing path', undefined],
    ['an empty path', ''],
  ])('gives not-local for %s', (_title, given) => {
    expect(readMarketplaceFile(settingsOf(dir), directory(given))).toEqual({ kind: 'not-local' })
    expect(readMarketplaceFile(settingsOf(dir), file(given))).toEqual({ kind: 'not-local' })
  })
})

describe('readMarketplaceFile (no file to compare)', () => {
  it.each([
    ['directory', directory('nothing')],
    ['file', file('nothing/m.json')],
  ])('gives missing for a %s source with nothing at the path', (_title, source) => {
    const dir = tree({})
    expect(readMarketplaceFile(settingsOf(dir), source)).toEqual({ kind: 'missing' })
  })

  it('gives missing for a directory with no .claude-plugin directory', () => {
    const dir = tree({ 'market/readme.md': '' })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({ kind: 'missing' })
  })

  it('gives missing for a directory source whose path is a file', () => {
    const dir = tree({ market: '' })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({ kind: 'missing' })
  })

  it('gives missing for a directory with a manifest of another name', () => {
    const dir = tree({ 'market/.claude-plugin/other.json': market() })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({ kind: 'missing' })
  })

  it('gives unreadable for a file source that names a directory', () => {
    const dir = tree({ [`market/${MARKET}`]: market() })
    expect(readMarketplaceFile(settingsOf(dir), file('market'))).toEqual({ kind: 'unreadable' })
  })

  it.each([
    ['text that does not parse', '{"name": '],
    ['an empty file', ''],
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"acme"'],
    ['a number', '3'],
  ])('gives unreadable for %s', (_title, text) => {
    const dir = tree({ [`market/${MARKET}`]: text })
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'unreadable',
    })
  })
})

describe('readMarketplaceFile (the bound)', () => {
  it('gives unreadable for a path out of the repository', () => {
    // `outside` is a sibling tree, with a marketplace that exists.
    const outside = tree({ [`market/${MARKET}`]: market() })
    const dir = tree({})
    const up = path.relative(dir, path.join(outside, 'market'))
    expect(readMarketplaceFile(settingsOf(dir), directory(up))).toEqual({ kind: 'unreadable' })
    const toFile = path.relative(dir, path.join(outside, 'market', MARKET))
    expect(readMarketplaceFile(settingsOf(dir), file(toFile))).toEqual({ kind: 'unreadable' })
  })

  it('gives unreadable for a path out of .claude when there is no .git', () => {
    // The bound is `sub/.claude`, so the marketplaces in `sub` and above are out of it.
    const dir = tree(
      {
        [`sub/.claude/market/${MARKET}`]: market(),
        [`sub/market/${MARKET}`]: market(),
        [MARKET]: market(),
      },
      false,
    )
    const settings = settingsOf(dir, 'sub/.claude/settings.json')
    expect(readMarketplaceFile(settings, directory('.claude/market'))).toEqual(ACME)
    expect(readMarketplaceFile(settings, directory('market'))).toEqual({ kind: 'unreadable' })
    expect(readMarketplaceFile(settings, directory('..'))).toEqual({ kind: 'unreadable' })
  })

  it('resolves from the top directory when it has a .git file, as a git worktree has', () => {
    const dir = tree({ [`sub/market/${MARKET}`]: market(), '.git': 'gitdir: elsewhere\n' }, false)
    const settings = settingsOf(dir, 'sub/.claude/settings.json')
    expect(readMarketplaceFile(settings, directory('sub/market'))).toEqual(ACME)
    expect(readMarketplaceFile(settings, directory('market'))).toEqual({ kind: 'missing' })
  })

  it.skipIf(noLinks)('gives unreadable for a directory link that leads out', () => {
    const outside = tree({ [MARKET]: market() })
    const dir = tree({})
    link(dir, 'alias', outside)
    expect(readMarketplaceFile(settingsOf(dir), directory('alias'))).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(noLinks)('gives unreadable for a link on the path that leads out', () => {
    const outside = tree({ [`market/${MARKET}`]: market() })
    const dir = tree({})
    link(dir, 'alias', outside)
    expect(readMarketplaceFile(settingsOf(dir), directory('alias/market'))).toEqual({
      kind: 'unreadable',
    })
    expect(readMarketplaceFile(settingsOf(dir), file(`alias/market/${MARKET}`))).toEqual({
      kind: 'unreadable',
    })
  })

  it.skipIf(noLinks)('gives unreadable for a file link that leads out', () => {
    const outside = tree({ 'm.json': market() })
    const dir = tree({})
    link(dir, 'm.json', path.join(outside, 'm.json'))
    expect(readMarketplaceFile(settingsOf(dir), file('m.json'))).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(noLinks)('gives unreadable for a .claude-plugin link that leads out', () => {
    const outside = tree({ 'marketplace.json': market() })
    const dir = tree({})
    link(dir, 'market/.claude-plugin', outside)
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({
      kind: 'unreadable',
    })
  })

  it.skipIf(noLinks)('gives no marketplace for a dangling link on the path', () => {
    const dir = tree({})
    link(dir, 'alias', 'nothing')
    link(dir, 'm.json', 'nothing.json')
    link(dir, 'market/.claude-plugin', 'nothing')
    expect(readMarketplaceFile(settingsOf(dir), directory('alias'))).toEqual({ kind: 'missing' })
    expect(readMarketplaceFile(settingsOf(dir), file('m.json'))).toEqual({ kind: 'unreadable' })
    // `readJson` gives null for a file below a dangling directory link. Both results are silent.
    expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual({ kind: 'missing' })
  })

  it.skipIf(noLinks)('gives unreadable for a link loop', () => {
    const dir = tree({})
    link(dir, 'a', 'b')
    link(dir, 'b', 'a')
    expect(readMarketplaceFile(settingsOf(dir), file('a'))).toEqual({ kind: 'unreadable' })
  })

  it.skipIf(noLinks)(
    'keeps the bound at the repository when .claude is a link that leads out',
    () => {
      const outside = tree({ 'settings.json': '{}' })
      const dir = tree({ [`market/${MARKET}`]: market() })
      link(dir, '.claude', outside)
      expect(readMarketplaceFile(settingsOf(dir), directory('market'))).toEqual(ACME)
    },
  )
})

describe('marketplacesOf and sourceOf', () => {
  it('gives the extraKnownMarketplaces object of the text', () => {
    expect(
      marketplacesOf('{"extraKnownMarketplaces": {"a": {"source": {"source": "x"}}}}'),
    ).toEqual({
      a: { source: { source: 'x' } },
    })
  })

  it('reads the last of two extraKnownMarketplaces keys and two keys of one name', () => {
    const text = '{"extraKnownMarketplaces": {"a": 1}, "extraKnownMarketplaces": {"a": 1, "a": 2}}'
    expect(marketplacesOf(text)).toEqual({ a: 2 })
  })

  it.each([
    ['text that does not parse', '{'],
    ['an empty text', ''],
    ['an array', '[]'],
    ['null', 'null'],
    ['no key', '{}'],
    ['an array value', '{"extraKnownMarketplaces": []}'],
    ['a string value', '{"extraKnownMarketplaces": "a"}'],
    ['a null value', '{"extraKnownMarketplaces": null}'],
  ])('gives undefined for %s', (_title, text) => {
    expect(marketplacesOf(text)).toBeUndefined()
  })

  it('gives the source of an entry, and undefined for an entry that is not an object', () => {
    expect(sourceOf({ source: { source: 'file' } })).toEqual({ source: 'file' })
    expect(sourceOf({})).toBeUndefined()
    expect(sourceOf('a')).toBeUndefined()
    expect(sourceOf(null)).toBeUndefined()
    expect(sourceOf([{ source: 1 }])).toBeUndefined()
  })
})

describe('declaredSource', () => {
  const entry = (p: string) => ({ source: { source: 'directory', path: p } })
  const settings = (marketplaces: unknown) =>
    JSON.stringify({ extraKnownMarketplaces: marketplaces })

  it('reads the local file first for the project file (highest precedence, whole)', () => {
    const own = settings({ acme: entry('own') })
    const dir = tree({ '.claude/settings.local.json': settings({ acme: entry('other') }) })
    expect(declaredSource(settingsOf(dir), own, 'acme')).toEqual({
      source: 'directory',
      path: 'other',
    })
  })

  it('reads the project file when the local file lacks the key', () => {
    const own = settings({ acme: entry('own') })
    const dir = tree({ '.claude/settings.local.json': settings({ b: entry('other') }) })
    expect(declaredSource(settingsOf(dir), own, 'acme')).toEqual({
      source: 'directory',
      path: 'own',
    })
  })

  it('reads the project file when the local file is missing or has no marketplaces', () => {
    const own = settings({ acme: entry('own') })
    const variants: Record<string, string>[] = [{}, { '.claude/settings.local.json': '{}' }]
    for (const files of variants) {
      const dir = tree(files)
      expect(declaredSource(settingsOf(dir), own, 'acme')).toEqual({
        source: 'directory',
        path: 'own',
      })
    }
  })

  it.skipIf(noLinks)(
    'gives undefined for the project file when the local file is unreadable',
    () => {
      const outside = tree({ 'x.json': settings({ acme: entry('other') }) })
      const dir = tree({})
      link(dir, '.claude/settings.local.json', path.join(outside, 'x.json'))
      const own = settings({ acme: entry('own') })
      expect(declaredSource(settingsOf(dir), own, 'acme')).toBeUndefined()
    },
  )

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
    ['is null', 'null'],
  ])('gives undefined for the project file when the local file %s', (_title, text) => {
    const dir = tree({ '.claude/settings.local.json': text })
    const own = settings({ acme: entry('own') })
    expect(declaredSource(settingsOf(dir), own, 'acme')).toBeUndefined()
  })

  it.skipIf(noLinks)('bounds the other file at .claude when there is no .git', () => {
    const dir = tree({ 'shared/s.json': settings({ acme: entry('other') }) }, false)
    link(dir, '.claude/settings.local.json', '../shared/s.json')
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it('reads a real key that is also a name in the prototype, from the project file', () => {
    const dir = tree({ '.claude/settings.json': settings({ constructor: entry('other') }) })
    const local = settingsOf(dir, '.claude/settings.local.json')
    expect(declaredSource(local, settings({}), 'constructor')).toEqual({
      source: 'directory',
      path: 'other',
    })
    const dir2 = tree({ '.claude/settings.local.json': settings({}) })
    expect(
      declaredSource(settingsOf(dir2), settings({ constructor: entry('own') }), 'constructor'),
    ).toEqual({ source: 'directory', path: 'own' })
  })

  it('reads the same file first for the local file', () => {
    const own = settings({ acme: entry('own') })
    const dir = tree({ '.claude/settings.json': settings({ acme: entry('other') }) })
    const local = settingsOf(dir, '.claude/settings.local.json')
    expect(declaredSource(local, own, 'acme')).toEqual({ source: 'directory', path: 'own' })
  })

  it('reads the other project file when the same file lacks the key', () => {
    const dir = tree({ '.claude/settings.local.json': settings({ acme: entry('other') }) })
    expect(declaredSource(settingsOf(dir), settings({ b: entry('x') }), 'acme')).toEqual({
      source: 'directory',
      path: 'other',
    })
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toEqual({
      source: 'directory',
      path: 'other',
    })
  })

  it('reads the project file from the local file', () => {
    const dir = tree({ '.claude/settings.json': settings({ acme: entry('other') }) })
    const local = settingsOf(dir, '.claude/settings.local.json')
    expect(declaredSource(local, '{}', 'acme')).toEqual({ source: 'directory', path: 'other' })
  })

  it('lets the file of the highest precedence decide, even with a source that is not local', () => {
    const github = settings({ acme: { source: { source: 'github', repo: 'o/r' } } })
    const dir = tree({ '.claude/settings.json': settings({ acme: entry('other') }) })
    const local = settingsOf(dir, '.claude/settings.local.json')
    expect(declaredSource(local, github, 'acme')).toEqual({ source: 'github', repo: 'o/r' })
    expect(declaredSource(local, settings({ acme: 'x' }), 'acme')).toBeUndefined()
    const dir2 = tree({ '.claude/settings.local.json': github })
    expect(declaredSource(settingsOf(dir2), settings({ acme: entry('own') }), 'acme')).toEqual({
      source: 'github',
      repo: 'o/r',
    })
  })

  it('gives undefined when neither file has the key', () => {
    const dir = tree({ '.claude/settings.local.json': settings({ other: entry('x') }) })
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it('gives undefined when the other file is missing', () => {
    const dir = tree({})
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
    ['has no extraKnownMarketplaces', '{}'],
    ['has an extraKnownMarketplaces that is not an object', '{"extraKnownMarketplaces": []}'],
  ])('gives undefined when the other file %s', (_title, text) => {
    const dir = tree({ '.claude/settings.local.json': text })
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it('finds no key in the prototype of the object', () => {
    const dir = tree({ '.claude/settings.local.json': settings({}) })
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '']) {
      expect(declaredSource(settingsOf(dir), settings({}), key)).toBeUndefined()
    }
  })

  it('reads a key of the other file that is also a name in the prototype', () => {
    const dir = tree({
      '.claude/settings.local.json': settings({ constructor: entry('other') }),
    })
    expect(declaredSource(settingsOf(dir), settings({}), 'constructor')).toEqual({
      source: 'directory',
      path: 'other',
    })
    const dir2 = tree({ '.claude/settings.json': settings({}) })
    const local = settingsOf(dir2, '.claude/settings.local.json')
    expect(declaredSource(local, settings({ constructor: entry('own') }), 'constructor')).toEqual({
      source: 'directory',
      path: 'own',
    })
    expect(declaredSource(local, settings({}), 'constructor')).toBeUndefined()
  })

  it('finds the key "__proto__" and the empty key when the file sets them', () => {
    const own = '{"extraKnownMarketplaces": {"__proto__": {"source": 1}, "": {"source": 2}}}'
    const dir = tree({})
    expect(declaredSource(settingsOf(dir), own, '__proto__')).toBe(1)
    expect(declaredSource(settingsOf(dir), own, '')).toBe(2)
  })

  it('reads the last of two keys of one name in the other file', () => {
    const dir = tree({
      '.claude/settings.local.json':
        '{"extraKnownMarketplaces": {"acme": {"source": 1}, "acme": {"source": 2}}}',
    })
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBe(2)
  })

  it.skipIf(noLinks)('gives undefined when the other file is a link that leads out', () => {
    const outside = tree({ 'x.json': settings({ acme: entry('other') }) })
    const dir = tree({})
    link(dir, '.claude/settings.local.json', path.join(outside, 'x.json'))
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it.skipIf(noLinks)('gives undefined when the other file is a dangling link', () => {
    const dir = tree({})
    link(dir, '.claude/settings.local.json', 'nothing.json')
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toBeUndefined()
  })

  it.skipIf(noLinks)('reads the other file when it is a link inside the repository', () => {
    const dir = tree({ 'shared/s.json': settings({ acme: entry('other') }) })
    link(dir, '.claude/settings.local.json', '../shared/s.json')
    expect(declaredSource(settingsOf(dir), '{}', 'acme')).toEqual({
      source: 'directory',
      path: 'other',
    })
  })
})
