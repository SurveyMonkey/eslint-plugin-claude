// Claude Code installs the dependencies of a plugin with `--ignore-scripts`, so the `preinstall`,
// `install` and `postinstall` scripts never run (loading reference, "Limits on the dependency
// install"). The rule reads the `package.json` at a plugin root. The trees are on disk, because
// the rule finds the plugin around the file. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-package-lifecycle-scripts'
const check = it
const linked = noLinks ? it.skip : check
const FILES = ['**/package.json']
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)

const message = (script: string) =>
  `Claude Code runs the dependency install of a plugin with \`--ignore-scripts\`, so the \`${script}\` script never runs. Run the step before you publish the plugin, or from a hook.`
const packageOf = (scripts: unknown) => JSON.stringify({ name: 'p', scripts })
/** The messages for the plugin-root `package.json` with the text `code`. */
const run = (code: string, at = '') => {
  const { dir } = pluginTree({ name: 'p' }, {}, at)
  return lint(dir, 'package.json', code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports on the script name, with the full message', () => {
    const code = '{"scripts": {"postinstall": "node setup.js"}}'
    const { dir } = pluginTree({ name: 'p' })
    const found = lint(dir, 'package.json', code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'ignored',
      message: message('postinstall'),
      line: 1,
      column: 14,
      endLine: 1,
      endColumn: 27,
    })
  })

  check.each(['preinstall', 'install', 'postinstall'])('reports %s', (script) => {
    expect(run(packageOf({ [script]: 'node setup.js' }))).toEqual([message(script)])
  })

  check('reports each script, in file order, and none of the other scripts', () => {
    const scripts = { postinstall: 'a', build: 'b', preinstall: 'c', test: 'd', install: 'e' }
    expect(run(packageOf(scripts))).toEqual([
      message('postinstall'),
      message('preinstall'),
      message('install'),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    expect(run(packageOf({ install: 'x' }), 'plugins/p/')).toEqual([message('install')])
  })

  check('reports the last of two scripts with the same name once', () => {
    expect(run('{"scripts": {"install": "a", "install": "b"}}')).toEqual([message('install')])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['build', { build: 'tsc' }],
    ['the scripts that npm runs after the install', { prepare: 'x', prepublishOnly: 'x' }],
    ['a name that holds a lifecycle name', { 'my-postinstall': 'x', postinstalls: 'x', pre: 'x' }],
    ['an empty scripts object', {}],
    ['a script that is no string', { postinstall: 3, install: null, preinstall: ['x'] }],
  ])('stays silent for %s', (_title, scripts) => {
    expect(run(packageOf(scripts))).toEqual([])
  })

  check.each([
    ['no scripts key', '{"name": "p"}'],
    ['scripts that is no object', '{"scripts": "postinstall"}'],
    ['scripts that is an array', '{"scripts": ["postinstall"]}'],
    ['a lifecycle name outside scripts', '{"postinstall": "x", "config": {"install": "x"}}'],
    ['a package.json that is no object', '[]'],
  ])('stays silent for %s', (_title, code) => {
    expect(run(code)).toEqual([])
  })

  check('stays silent for a package.json below the plugin root', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'sub/package.json': packageOf({ install: 'x' }) })
    expect(lint(dir, 'sub/package.json', packageOf({ install: 'x' }))).toEqual([])
  })

  check('stays silent for a package.json in a folder that holds a plugin deeper', () => {
    const { top } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    expect(lint(top, 'package.json', packageOf({ install: 'x' }))).toEqual([])
  })

  check('stays silent for a package.json that sits in no plugin', () => {
    expect(lint(tree({}), 'package.json', packageOf({ install: 'x' }))).toEqual([])
  })

  check('stays silent for a file with another name', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = packageOf({ install: 'x' })
    expect(lintPluginFile(RULE, ['**/*.json'], path.join(dir, 'package-lock.json'), code)).toEqual(
      [],
    )
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, 'package.json', packageOf({ install: 'x' }))).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text)
    expect(lint(dir, 'package.json', packageOf({ install: 'x' }))).toEqual([])
  })
})
