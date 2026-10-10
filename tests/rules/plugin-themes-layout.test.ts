// A plugin theme is a file `themes/<slug>.json` in the custom theme format (components reference,
// "Themes and output styles"). The format has three optional fields: `name`, `base` and `overrides`
// (terminal configuration, "Create a custom theme"). The rule reads the theme files in `themes/` of
// a plugin. The trees are on disk, because the rule finds the plugin around the file. The files glob
// is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-themes-layout'
const check = it
const linked = noLinks ? it.skip : check
const FILES = ['**/themes/*.json']
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)

const SHAPE =
  'The theme file must hold a JSON object. Its fields are `name`, `base` and `overrides`, and each is optional.'
const NAME = 'The theme field `name` must be a string. `/theme` shows it as the label of the theme.'
const BASE =
  'The theme field `base` must be one of "dark", "light", "dark-daltonized", "light-daltonized", "dark-ansi" or "light-ansi". It names the preset that the theme starts from.'
const OVERRIDES =
  'The theme field `overrides` must be an object that maps a color token to a color value.'

/** The messages for the theme file `file` with the text `code` in a plugin that has the manifest
 *  `manifest`. */
const run = (code: unknown, manifest: unknown = { name: 'p' }, file = 'themes/t.json') => {
  const { dir } = pluginTree(manifest)
  return lint(dir, file, typeof code === 'string' ? code : JSON.stringify(code)).map(
    (m) => m.message,
  )
}

describe(RULE, () => {
  check('reports on the field, with the full message and the position', () => {
    const code = '{"name": 5}'
    const { dir } = pluginTree({ name: 'p' })
    const found = lint(dir, 'themes/t.json', code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'name',
      message: NAME,
      line: 1,
      column: 10,
      endLine: 1,
      endColumn: 11,
    })
  })

  check.each([
    ['an array', '[]'],
    ['a string', '"dark"'],
    ['null', 'null'],
  ])('reports a theme file that is %s', (_title, code) => {
    expect(run(code)).toEqual([SHAPE])
  })

  check.each([
    ['a number', { name: 5 }],
    ['null', { name: null }],
    ['an object', { name: {} }],
  ])('reports a name that is %s', (_title, theme) => {
    expect(run(theme)).toEqual([NAME])
  })

  check.each([
    ['an unknown preset', { base: 'bogus' }],
    ['a preset in the wrong case', { base: 'Dark' }],
    ['a number', { base: 1 }],
    ['an empty string', { base: '' }],
  ])('reports a base that is %s', (_title, theme) => {
    expect(run(theme)).toEqual([BASE])
  })

  check.each([
    ['an array', { overrides: [] }],
    ['a string', { overrides: 'red' }],
    ['null', { overrides: null }],
  ])('reports overrides that is %s', (_title, theme) => {
    expect(run(theme)).toEqual([OVERRIDES])
  })

  check('reports each fault, in file order', () => {
    expect(run({ overrides: 1, base: 'x', name: 2 })).toEqual([OVERRIDES, BASE, NAME])
  })

  check('reports the last of two fields with the same name', () => {
    expect(run('{"base": "dark", "base": "x"}')).toEqual([BASE])
    expect(run('{"base": "x", "base": "dark"}')).toEqual([])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    expect(lint(dir, 'themes/t.json', '{"name": 1}')).toHaveLength(1)
  })

  check('reports a theme when the manifest sets a key that is not a theme key', () => {
    expect(run({ name: 1 }, { name: 'p', experimental: { monitors: [] } })).toEqual([NAME])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['an empty object', {}],
    ['the theme of the docs', { name: 'Dracula', base: 'dark', overrides: { claude: '#bd93f9' } }],
    ['a name only', { name: 'Mine' }],
    ['an unknown field', { name: 'Mine', extra: 1 }],
    ['an override value that is not a color', { overrides: { claude: 5, nope: null, error: [] } }],
    ['an empty overrides object', { overrides: {} }],
  ])('stays silent for %s', (_title, theme) => {
    expect(run(theme)).toEqual([])
  })

  check.each(['dark', 'light', 'dark-daltonized', 'light-daltonized', 'dark-ansi', 'light-ansi'])(
    'stays silent for the base %s',
    (base) => {
      expect(run({ base })).toEqual([])
    },
  )

  check.each([
    ['experimental.themes', { name: 'p', experimental: { themes: './custom/' } }],
    [
      'experimental.themes that names the default folder',
      { name: 'p', experimental: { themes: './themes/' } },
    ],
    ['a top-level themes key', { name: 'p', themes: './custom/' }],
    ['an experimental.themes array', { name: 'p', experimental: { themes: [] } }],
  ])(
    'stays silent when the manifest sets %s, which replaces the folder scan',
    (_title, manifest) => {
      expect(run({ name: 1, base: 'x', overrides: 1 }, manifest)).toEqual([])
    },
  )

  check.each([
    ['themes/sub/t.json', 'themes/sub/t.json'],
    ['other/t.json', 'other/t.json'],
    ['sub/themes/t.json', 'sub/themes/t.json'],
    ['.claude-plugin/themes/t.json', '.claude-plugin/themes/t.json'],
    ['themes.json', 'themes.json'],
  ])('stays silent for a file at %s, when the glob lets it in', (_title, file) => {
    const { dir } = pluginTree({ name: 'p' })
    const found = lintPluginFile(RULE, ['**/*.json'], path.join(dir, file), '{"name": 1}')
    expect(found.map((m) => m.message)).toEqual([])
  })

  check('stays silent for a file that sits in no plugin', () => {
    expect(lint(tree({}), 'themes/t.json', '{"name": 1}')).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, 'themes/t.json', '{"name": 1}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text)
    expect(lint(dir, 'themes/t.json', '{"name": 1}')).toEqual([])
  })
})
