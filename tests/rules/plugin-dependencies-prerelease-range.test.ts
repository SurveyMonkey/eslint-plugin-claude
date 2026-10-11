// A version range does not match a pre-release version such as `2.0.0-beta.1` unless it opts in
// with a pre-release suffix such as `^2.0.0-0` (dependencies page, "Declare a dependency with a
// version constraint"). The rule reports a range of a `dependencies` object when a `-0` suffix on
// the versions of the range that have the major, minor and patch of the target would make the
// range match the target. The target version is the `version` of the dependency in the
// `plugin.json` of its relative source, or else in its marketplace entry. The trees are on disk.
// The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-dependencies-prerelease-range'
const check = it
const linked = noLinks ? it.skip : check

const BETA = '2.0.0-beta.1'

interface Scene {
  range?: unknown
  /** The `version` of the entry of the dependency. */
  entry?: unknown
  /** The text of the `plugin.json` of the dependency, at `./plugins/dep`. */
  dep?: string
  /** The `source` of the entry of the dependency. */
  source?: unknown
  /** The dependency as written, instead of an object with `range`. */
  dependency?: unknown
  /** The entries of `plugins`, instead of the two of the scene. */
  entries?: unknown[]
  /** The text of the marketplace file, instead of the one of the scene. */
  marketplace?: string
  /** The other files, keyed by their path from the repository root. */
  files?: Record<string, string>
}

/** A marketplace `acme` in a repository with the plugin `p` and its dependency `dep`. */
function build(scene: Scene) {
  const manifest = JSON.stringify({
    name: 'p',
    dependencies: [scene.dependency ?? { name: 'dep', version: scene.range }],
  })
  const entries = scene.entries ?? [
    { name: 'p', source: './plugins/p' },
    {
      name: 'dep',
      source: scene.source ?? './plugins/dep',
      ...(scene.entry === undefined ? {} : { version: scene.entry }),
    },
  ]
  const top = tree({
    '.claude-plugin/marketplace.json': scene.marketplace ?? marketplaceOf(entries),
    'plugins/p/.claude-plugin/plugin.json': manifest,
    ...(scene.dep === undefined ? {} : { 'plugins/dep/.claude-plugin/plugin.json': scene.dep }),
    ...scene.files,
  })
  return { top, dir: path.join(top, 'plugins/p'), code: manifest }
}
const run = (scene: Scene) => {
  const { dir, code } = build(scene)
  return lintPlugin(RULE, dir, code)
}
/** A range and a target in the entry. */
const ranged = (range: unknown, entry: unknown = BETA) => run({ range, entry })

describe(RULE, () => {
  check('reports the range, with the full message', () => {
    const { dir, code } = build({ range: '^2.0.0', entry: BETA })
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'prerelease',
      message:
        'The range "^2.0.0" of the dependency "dep" does not match its pre-release version "2.0.0-beta.1". A range matches a pre-release only with a pre-release suffix, such as `^2.0.0-0`.',
      line: 1,
      column: code.indexOf('"^2.0.0"') + 1,
    })
  })

  check.each([
    ['^2.0.0', BETA],
    ['>= 2.0.0', BETA],
    ['^ 2.0.0', BETA],
    ['~  2.0.0', BETA],
    ['^1.2.3 >=1.5.0', '1.5.0-beta.1'],
    ['>2.0.0', '2.0.0-0.3'],
    ['^2.0', BETA],
    ['^2', BETA],
    ['~2.0.0', '2.0.0-rc.1'],
    ['~2.0', BETA],
    ['~2', BETA],
    ['>=2.0.0', BETA],
    ['>=2', BETA],
    ['>2.0.0', BETA],
    ['>2.0', '2.1.0-beta.1'],
    ['>2', '3.0.0-beta.1'],
    ['2.0', BETA],
    ['2', BETA],
    ['=2.0', BETA],
    ['^0.0.3', '0.0.3-beta.1'],
    ['^0.2.0', '0.2.0-beta.1'],
    ['^0.2', '0.2.0-beta.1'],
    ['^0.0', '0.0.0-beta.1'],
    ['^0', '0.0.0-beta.1'],
    ['^1.0.0 || ^2.0.0', BETA],
    ['>=2.0.0 <3.0.0', BETA],
    ['  >=2.0.0   <3 ', BETA],
    ['^2.0.0', '2.0.0-beta.1+build.5'],
    ['^2.0.0', '2.0.0-0.3'],
    ['~2.0.0', '2.0.0-alpha'],
    ['^2.0.0', '2.0.0-0'],
  ])('reports the range %s for the target %s', (range, target) => {
    expect(ranged(range, target)).toHaveLength(1)
  })

  check('reports a range with a name@marketplace dependency in the own marketplace', () => {
    expect(
      run({ dependency: { name: 'dep', marketplace: 'acme', version: '^2.0.0' }, entry: BETA }),
    ).toHaveLength(1)
  })

  check('takes the target from the plugin.json of the relative source', () => {
    expect(
      run({ range: '^2.0.0', dep: JSON.stringify({ name: 'dep', version: BETA }) }),
    ).toHaveLength(1)
  })

  check('lets the version of the manifest replace the version of the entry', () => {
    const dep = JSON.stringify({ name: 'dep', version: BETA })
    expect(run({ range: '^2.0.0', entry: '2.0.0', dep })).toHaveLength(1)
  })

  check('takes the version of the entry when the manifest sets none', () => {
    const dep = JSON.stringify({ name: 'dep' })
    expect(run({ range: '^2.0.0', entry: BETA, dep })).toHaveLength(1)
  })

  check('takes the version of the entry when the source has no manifest', () => {
    expect(
      run({ range: '^2.0.0', entry: BETA, files: { 'plugins/dep/README.md': '' } }),
    ).toHaveLength(1)
  })

  check('takes the version of the entry of an object source', () => {
    expect(
      run({ range: '^2.0.0', entry: BETA, source: { source: 'github', repo: 'o/dep' } }),
    ).toHaveLength(1)
  })

  check('reports each range of the dependencies', () => {
    const dependencies = [
      { name: 'dep', version: '^2.0.0' },
      { name: 'dep', version: '~2.0.0' },
    ]
    const manifest = JSON.stringify({ name: 'p', dependencies })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([
        { name: 'p', source: './plugins/p' },
        { name: 'dep', source: { source: 'github', repo: 'o/d' }, version: BETA },
      ]),
      'plugins/p/.claude-plugin/plugin.json': manifest,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins/p'), manifest)).toHaveLength(2)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a range with the suffix', '^2.0.0-0', BETA],
    ['a range with another pre-release', '^2.0.0-beta.0', BETA],
    ['one alternative with the suffix', '^1.0.0 || ^2.0.0-0', BETA],
    ['a target that is not a pre-release', '^2.0.0', '2.0.0'],
    ['a target that is another version', '^2.0.0', '2.1.0-beta.1'],
    ['a target above the range', '^2.0.0', '3.0.0-beta.1'],
    ['a target below the range', '^3.0.0', BETA],
    ['an exact version', '=2.0.0', BETA],
    ['a bare exact version', '2.0.0', BETA],
    ['a range that ends below the target', '<2.0.0', BETA],
    ['a range that ends below the target, with a partial', '<2.0', BETA],
    ['a range up to the target', '<=2.0.0', BETA],
    ['a range from below', '>=1.0.0', BETA],
    ['a range from below, with a bound', '>=1.0.0 <2.0.0', BETA],
    ['a range up to the minor', '<=2.0', BETA],
    ['a range up to the major', '<=2', BETA],
    ['a bound above the lowest pre-release', '>2.0.0', '2.0.0-0'],
    ['a minor caret bound below the target', '^0.2.0 >=0.3.0', '0.3.0-beta.1'],
    ['a patch caret bound below the target', '^0.0.3 >=0.0.4', '0.0.4-beta.1'],
    ['a major caret bound below the target', '^1.2.3 >=2.0.0', BETA],
    ['a tilde bound below the target', '~2.0.0 >=2.1.0', '2.1.0-beta.1'],
    ['a range below a minor', '<2', BETA],
    ['a caret range below', '^1', BETA],
  ])('stays silent for %s', (_title, range, target) => {
    expect(ranged(range, target)).toEqual([])
  })

  check.each([
    ['any version', '*'],
    ['an x range', '2.x'],
    ['an x range with a patch', '2.0.x'],
    ['the empty range', ''],
    ['a blank range', '  '],
    ['a v prefix', 'v2.0.0'],
    ['a tag', 'latest'],
    ['a hyphen range', '1.0.0 - 2.0.0'],
    ['an operator that does not exist', '!2.0.0'],
    ['four parts', '^2.0.0.0'],
    ['a build in the range', '^2.0.0+b'],
    ['an empty alternative', '^2.0.0 ||'],
  ])('stays silent for %s', (_title, range) => {
    expect(ranged(range)).toEqual([])
  })

  check.each([
    ['a target that is not semver', 'latest'],
    ['a target with a v prefix', 'v2.0.0-beta.1'],
    ['a target with an empty identifier', '2.0.0-beta..1'],
    ['a target with a leading zero', '02.0.0-beta.1'],
    ['a target that is not a string', 5],
    ['a null version', null],
  ])('stays silent for %s', (_title, entry) => {
    expect(ranged('^2.0.0', entry)).toEqual([])
  })

  check('stays silent when the version of the dependency is not a string', () => {
    expect(ranged(5)).toEqual([])
    expect(run({ dependency: { name: 'dep' }, entry: BETA })).toEqual([])
  })

  check.each([
    ['a name only', 'dep'],
    ['a name with a marketplace', 'dep@acme'],
    ['a dependency with no name', { version: '^2.0.0' }],
    ['a number', 5],
  ])('stays silent for %s as a dependency', (_title, dependency) => {
    expect(run({ dependency, entry: BETA })).toEqual([])
  })

  check('stays silent for a dependency in another marketplace', () => {
    const dependency = { name: 'dep', marketplace: 'other', version: '^2.0.0' }
    expect(run({ dependency, entry: BETA })).toEqual([])
  })

  check('stays silent when the manifest version is not a pre-release', () => {
    const dep = JSON.stringify({ name: 'dep', version: '2.0.0' })
    expect(run({ range: '^2.0.0', entry: BETA, dep })).toEqual([])
  })

  check('stays silent when the manifest of the source does not parse', () => {
    expect(run({ range: '^2.0.0', entry: BETA, dep: '{' })).toEqual([])
  })

  check('stays silent when the entry sets no version and the source has no manifest', () => {
    expect(run({ range: '^2.0.0' })).toEqual([])
    expect(run({ range: '^2.0.0', source: './plugins/gone' })).toEqual([])
  })

  check('takes the version of the entry when the source folder is not there', () => {
    expect(run({ range: '^2.0.0', entry: BETA, source: './plugins/gone' })).toHaveLength(1)
  })

  // The manifest of a bare name has the pre-release and the entry does not: a rule that read it
  // would report.
  check.each([['plugins/dep'], ['.dep']])('stays silent when the source is %s', (source) => {
    expect(
      run({
        range: '^2.0.0',
        entry: '2.0.0',
        source,
        files: {
          [`${source}/.claude-plugin/plugin.json`]: JSON.stringify({ version: BETA }),
        },
      }),
    ).toEqual([])
  })

  check('reads the plugin.json at the marketplace root for the source "."', () => {
    expect(
      run({
        range: '^2.0.0',
        entry: '2.0.0',
        source: '.',
        files: { '.claude-plugin/plugin.json': JSON.stringify({ version: BETA }) },
      }),
    ).toHaveLength(1)
  })

  check('stays silent for a command source, whose entry version Claude Code ignores', () => {
    expect(
      run({ range: '^2.0.0', entry: BETA, source: { source: 'command', command: 'tool' } }),
    ).toEqual([])
  })

  check('uses the entry version when the manifest version is not a string', () => {
    expect(
      run({ range: '^2.0.0', entry: BETA, dep: JSON.stringify({ name: 'dep', version: 5 }) }),
    ).toHaveLength(1)
  })

  check.each([
    ['<=2.0.0', '2.0.0-0', 1],
    ['<2.0.0', '2.0.0-0', 0],
    ['>=2.0.0', '2.0.0-0', 1],
    ['^2.0.0', '3.0.0-0', 0],
    ['^0.0 >=0.1.0', '0.1.0-beta.1', 0],
    ['^0 >=1.0.0', '1.0.0-beta.1', 0],
    ['~>2.0.0', BETA, 1],
    ['^2.0.0 || 2.x', BETA, 0],
    ['<=2.0.0', '2.0.0-0.3', 0],
    ['^2.0.0', '2.0.0+build-1', 0],
    ['>2.0.0', '2.0.0-0+b', 0],
    ['<=2.0', '2.0.0-0', 0],
    ['<=2', '2.0.0-0', 0],
  ])('range %s against %s gives %i reports', (range, target, count) => {
    expect(ranged(range, target)).toHaveLength(count)
  })

  check('stays silent when the source leaves the repository', () => {
    const elsewhere = tree(
      { '.claude-plugin/plugin.json': JSON.stringify({ version: BETA }) },
      false,
    )
    const { dir, code } = build({ range: '^2.0.0', source: `./../${path.basename(elsewhere)}` })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for two entries of the name', () => {
    const entries = [
      { name: 'p', source: './plugins/p' },
      { name: 'dep', source: './plugins/dep', version: BETA },
      { name: 'dep', source: './plugins/dep', version: BETA },
    ]
    expect(run({ range: '^2.0.0', entries })).toEqual([])
  })

  check('stays silent for no entry of the name', () => {
    const entries = [{ name: 'p', source: './plugins/p' }]
    expect(run({ range: '^2.0.0', entries })).toEqual([])
  })

  check('stays silent when no entry lists the plugin', () => {
    const entries = [{ name: 'dep', source: './plugins/dep', version: BETA }]
    expect(run({ range: '^2.0.0', entries })).toEqual([])
  })

  check.each([
    ['a marketplace with no plugins array', JSON.stringify({ name: 'acme', owner: { name: 'o' } })],
    ['a marketplace that does not parse', '{'],
    ['a marketplace that is an array', '[]'],
  ])('stays silent for %s', (_title, marketplace) => {
    expect(run({ range: '^2.0.0', entry: BETA, marketplace })).toEqual([])
  })

  check('stays silent when the manifest has no dependencies array', () => {
    const manifest = JSON.stringify({ name: 'p', dependencies: 'dep' })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './plugins/p' }]),
      'plugins/p/.claude-plugin/plugin.json': manifest,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins/p'), manifest)).toEqual([])
  })

  linked('stays silent when the source folder is a link with no target', () => {
    const { dir, code, top } = build({ range: '^2.0.0', entry: BETA })
    link(top, 'plugins/dep', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent when the source folder is a link out of the repository', () => {
    const elsewhere = tree(
      { '.claude-plugin/plugin.json': JSON.stringify({ version: BETA }) },
      false,
    )
    const { dir, code, top } = build({ range: '^2.0.0', entry: BETA })
    link(top, 'plugins/dep', elsewhere)
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  // The `.claude-plugin` of the folder links back in, so only the folder itself tells the source.
  linked('stays silent when the source folder links out and its manifest links back in', () => {
    const elsewhere = tree({}, false)
    const { dir, code, top } = build({
      range: '^2.0.0',
      files: { 'meta/plugin.json': JSON.stringify({ version: BETA }) },
    })
    link(top, 'plugins/dep', elsewhere)
    link(elsewhere, '.claude-plugin', path.join(top, 'meta'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent when the marketplace file is a link with no target', () => {
    const top = tree({
      'plugins/p/.claude-plugin/plugin.json': '{"name": "p", "dependencies": []}',
    })
    link(top, '.claude-plugin/marketplace.json', 'ghost.json')
    const code = JSON.stringify({ name: 'p', dependencies: [{ name: 'dep', version: '^2.0.0' }] })
    expect(lintPlugin(RULE, path.join(top, 'plugins/p'), code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse on disk', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './plugins/p' }]),
      'plugins/p/.claude-plugin/plugin.json': '{',
    })
    const code = JSON.stringify({ name: 'p', dependencies: [{ name: 'dep', version: '^2.0.0' }] })
    expect(lintPlugin(RULE, path.join(top, 'plugins/p'), code)).toEqual([])
  })
})
