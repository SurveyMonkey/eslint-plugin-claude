// npm leaves `package-lock.json` out of a published package, so a plugin that a marketplace entry
// serves from an `npm` source ships `npm-shrinkwrap.json` (loading page, "When the dependency
// install runs"). The trees are on disk, because the rule reads the marketplace and the files
// around the manifest. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-npm-source-shrinkwrap'
const check = it
const linked = noLinks ? it.skip : check

const message = (name: string) =>
  `The marketplace entry "${name}" has an \`npm\` source, and the plugin has a \`package.json\` but no \`npm-shrinkwrap.json\`. npm leaves \`package-lock.json\` out of a published package, so Claude Code finds no lockfile and skips the dependency install. Add \`npm-shrinkwrap.json\`.`

const NPM = { source: 'npm', package: '@acme/p' }
const entry = (source: unknown, name = 'p') => ({ name, source })
/** The plugin `p` below a marketplace with the entries `plugins`, and the `files` of the plugin. */
function setup(
  plugins: unknown[],
  files: Record<string, string> = {},
  manifest: unknown = { name: 'p' },
) {
  const code = typeof manifest === 'string' ? manifest : JSON.stringify(manifest)
  const top = tree({
    '.claude-plugin/marketplace.json': marketplaceOf(plugins),
    ...Object.fromEntries(Object.entries(files).map(([name, text]) => [`plugins/p/${name}`, text])),
    'plugins/p/.claude-plugin/plugin.json': code,
  })
  return { code, dir: path.join(top, 'plugins', 'p'), top }
}
const run = (plugins: unknown[], files: Record<string, string>, manifest?: unknown) => {
  const { dir, code } = setup(plugins, files, manifest)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}
const PKG = { 'package.json': '{}' }

describe(RULE, () => {
  check('reports the name, with the full message and its place', () => {
    const { dir, code } = setup([entry(NPM)], PKG)
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: message('p'),
      line: 1,
      column: 9,
      endColumn: 12,
    })
  })

  check('reports a plugin that ships only package-lock.json', () => {
    expect(run([entry(NPM)], { ...PKG, 'package-lock.json': '{}' })).toEqual([message('p')])
  })

  check.each([
    ['yarn.lock', { 'yarn.lock': '' }],
    ['an npm-shrinkwrap.json in a subfolder', { 'sub/npm-shrinkwrap.json': '{}' }],
    ['an npm-shrinkwrap.json that is a folder', { 'npm-shrinkwrap.json/x': '' }],
    ['a bun.lock that is a folder', { 'bun.lock/x': '' }],
    ['a bun.lockb and no bun.lock', { 'bun.lockb': '' }],
  ])('reports a plugin with %s and no shrinkwrap', (_title, lockfiles) => {
    expect(run([entry(NPM)], { ...PKG, ...lockfiles })).toEqual([message('p')])
  })

  check('reports an entry whose npm source names a version and a registry', () => {
    const source = { ...NPM, version: '^2.0.0', registry: 'https://npm.example.com' }
    expect(run([entry(source)], PKG)).toEqual([message('p')])
  })

  check('reports when a second entry of the name has the npm source', () => {
    expect(run([entry('./plugins/p'), entry(NPM)], PKG)).toEqual([message('p')])
  })

  check('reports a plugin that sits at the repository root', () => {
    const code = JSON.stringify({ name: 'p' })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([entry(NPM)]),
      '.claude-plugin/plugin.json': code,
      'package.json': '{}',
    })
    expect(lintPlugin(RULE, top, code).map((m) => m.message)).toEqual([message('p')])
  })

  linked('reports a package.json that is a link to a file in the repository', () => {
    const { dir, code, top } = setup([entry(NPM)], { 'real.json': '{}' })
    link(top, 'plugins/p/package.json', 'real.json')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['missing'])
  })
})

describe(`${RULE} (silent)`, () => {
  check('stays silent for a plugin with bun.lock', () => {
    expect(run([entry(NPM)], { ...PKG, 'bun.lock': '' })).toEqual([])
  })

  check('stays silent for a plugin with npm-shrinkwrap.json', () => {
    expect(run([entry(NPM)], { ...PKG, 'npm-shrinkwrap.json': '{}' })).toEqual([])
  })

  check.each([
    ['a relative path source', './plugins/p'],
    ['a github source', { source: 'github', repo: 'acme/p' }],
    ['a url source', { source: 'url', url: 'https://example.com/p.git' }],
    ['an archive source', { source: 'archive', url: 'https://example.com/p.tgz' }],
    ['a command source', { source: 'command', command: 'fetch-p' }],
    ['a source with no source type', { package: '@acme/p' }],
    ['a source that is null', null],
    ['a source that is a number', 5],
  ])('stays silent for %s', (_title, source) => {
    expect(run([entry(source)], PKG)).toEqual([])
  })

  check.each([
    ['an entry of another name', [entry(NPM, 'other')]],
    ['an entry with no source', [{ name: 'p' }]],
    ['entries that are not objects', [5, null, 'p']],
    ['an entry with a name that is not a string', [{ name: 5, source: NPM }]],
    ['no entries', []],
  ])('stays silent with %s', (_title, plugins) => {
    expect(run(plugins, PKG)).toEqual([])
  })

  check('stays silent for a plugin with no package.json', () => {
    expect(run([entry(NPM)], {})).toEqual([])
  })

  check('stays silent for a package.json in a subfolder', () => {
    expect(run([entry(NPM)], { 'sub/package.json': '{}' })).toEqual([])
  })

  check('stays silent for a package.json that is a folder', () => {
    expect(run([entry(NPM)], { 'package.json/x': '' })).toEqual([])
  })

  check.each([
    ['no name', {}],
    ['a name that is not a string', { name: 5 }],
  ])('stays silent for a manifest with %s', (_title, manifest) => {
    expect(run([entry(NPM)], PKG, manifest)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = setup([entry(NPM)], PKG, '{')
    expect(lintPlugin(RULE, dir, JSON.stringify({ name: 'p' }))).toEqual([])
  })

  check('stays silent for a marketplace plugins value that is not an array', () => {
    const code = JSON.stringify({ name: 'p' })
    for (const plugins of ['x', { p: NPM }, null]) {
      const top = tree({
        '.claude-plugin/marketplace.json': JSON.stringify({ name: 'acme', plugins }),
        'plugins/p/package.json': '{}',
        'plugins/p/.claude-plugin/plugin.json': code,
      })
      expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
    }
  })

  check('stays silent for a plugin in no marketplace', () => {
    const code = JSON.stringify({ name: 'p' })
    const top = tree({
      'plugins/p/package.json': '{}',
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check.each([
    ['a marketplace that does not parse', '{'],
    ['a marketplace that is an array', '[]'],
  ])('stays silent for %s', (_title, text) => {
    const code = JSON.stringify({ name: 'p' })
    const top = tree({
      '.claude-plugin/marketplace.json': text,
      'plugins/p/package.json': '{}',
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  linked('stays silent for an npm-shrinkwrap.json that is a link with no target', () => {
    const { dir, code, top } = setup([entry(NPM)], PKG)
    link(top, 'plugins/p/npm-shrinkwrap.json', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for an npm-shrinkwrap.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'npm-shrinkwrap.json': '{}' }, false)
    const { dir, code, top } = setup([entry(NPM)], PKG)
    link(top, 'plugins/p/npm-shrinkwrap.json', path.join(elsewhere, 'npm-shrinkwrap.json'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bun.lock that is a link with no target', () => {
    const { dir, code, top } = setup([entry(NPM)], PKG)
    link(top, 'plugins/p/bun.lock', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bun.lock that is a link out of the repository', () => {
    const elsewhere = tree({ 'bun.lock': '' }, false)
    const { dir, code, top } = setup([entry(NPM)], PKG)
    link(top, 'plugins/p/bun.lock', path.join(elsewhere, 'bun.lock'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a package.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'package.json': '{}' }, false)
    const { dir, code, top } = setup([entry(NPM)])
    link(top, 'plugins/p/package.json', path.join(elsewhere, 'package.json'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent when the marketplace.json is a link with no target', () => {
    const code = JSON.stringify({ name: 'p' })
    const top = tree({
      'plugins/p/package.json': '{}',
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    link(top, '.claude-plugin/marketplace.json', 'ghost')
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })
})
