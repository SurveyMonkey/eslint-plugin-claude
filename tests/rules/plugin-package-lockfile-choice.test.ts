// Claude Code reads one lockfile of a plugin: the first match in the order `bun.lock`,
// `npm-shrinkwrap.json`, `package-lock.json`. It runs the package manager of that lockfile and does
// not fall back to another one when that manager is missing (loading reference, "When the dependency
// install runs"). The trees are on disk, because the rule looks for the lockfiles. The files glob is
// in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { READ } from '../../src/rules/plugin-package-lockfile.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-package-lockfile-choice'
const check = it.fails
const linked = noLinks ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)

const several = (files: string, first: string) =>
  `The plugin has ${files}. Claude Code reads only the first match, \`${first}\`, and ignores the others. Keep one lockfile, and prefer an npm lockfile.`
const BUN_ONLY =
  'The plugin has `bun.lock` and no npm lockfile. Claude Code runs Bun for it, and does not run npm when Bun is missing. Add `package-lock.json` or `npm-shrinkwrap.json` to reach the most users.'
const run = (files: Record<string, string>) => {
  const { dir, code } = pluginTree({ name: 'p' }, files)
  return lint(dir, code).map((m) => m.message)
}
const PACKAGE = { 'package.json': '{}' }

describe(RULE, () => {
  it('reads the lockfiles in the order of the loading page', () => {
    expect(READ).toEqual(['bun.lock', 'npm-shrinkwrap.json', 'package-lock.json'])
  })

  check('reports on the document, with the full message', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { ...PACKAGE, 'bun.lock': '', 'package-lock.json': '' },
    )
    const found = lint(dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'several',
      message: several('`bun.lock` and `package-lock.json`', 'bun.lock'),
      line: 1,
      column: 1,
    })
  })

  check.each([
    [
      'bun.lock beats an npm lockfile',
      { 'bun.lock': '', 'npm-shrinkwrap.json': '' },
      '`bun.lock` and `npm-shrinkwrap.json`',
      'bun.lock',
    ],
    [
      'npm-shrinkwrap.json beats package-lock.json',
      { 'npm-shrinkwrap.json': '', 'package-lock.json': '' },
      '`npm-shrinkwrap.json` and `package-lock.json`',
      'npm-shrinkwrap.json',
    ],
    [
      'the first of all three',
      { 'package-lock.json': '', 'npm-shrinkwrap.json': '', 'bun.lock': '' },
      '`bun.lock`, `npm-shrinkwrap.json` and `package-lock.json`',
      'bun.lock',
    ],
    [
      'only the lockfiles that Claude Code reads',
      {
        'yarn.lock': '',
        'pnpm-lock.yaml': '',
        'bun.lockb': '',
        'bun.lock': '',
        'package-lock.json': '',
      },
      '`bun.lock` and `package-lock.json`',
      'bun.lock',
    ],
  ])('reports %s', (_title, lockfiles, files, first) => {
    expect(run({ ...PACKAGE, ...lockfiles })).toEqual([several(files, first)])
  })

  check.each([
    ['bun.lock alone', { 'bun.lock': '' }],
    ['bun.lock beside a lockfile that Claude Code skips', { 'bun.lock': '', 'yarn.lock': '' }],
    [
      'bun.lock beside a folder named package-lock.json',
      { 'bun.lock': '', 'package-lock.json/x': '' },
    ],
  ])('reports %s as the only choice', (_title, lockfiles) => {
    expect(run({ ...PACKAGE, ...lockfiles })).toEqual([BUN_ONLY])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { ...PACKAGE, 'bun.lock': '', 'package-lock.json': '' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })

  linked('reports a lockfile that is a link to a file in the plugin', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p' },
      { ...PACKAGE, 'bun.lock': '', 'real.lock': '' },
    )
    link(top, 'package-lock.json', 'real.lock')
    expect(lint(dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['package-lock.json', { 'package-lock.json': '' }],
    ['npm-shrinkwrap.json', { 'npm-shrinkwrap.json': '' }],
    [
      'an npm lockfile beside a lockfile that Claude Code skips',
      { 'package-lock.json': '', 'yarn.lock': '' },
    ],
    ['no lockfile', {}],
    [
      'a lockfile that Claude Code skips',
      { 'yarn.lock': '', 'pnpm-lock.yaml': '', 'bun.lockb': '' },
    ],
    [
      'a folder named bun.lock beside an npm lockfile',
      { 'bun.lock/x': '', 'package-lock.json': '' },
    ],
    ['two folders named like lockfiles', { 'bun.lock/x': '', 'package-lock.json/x': '' }],
  ])('stays silent for %s', (_title, lockfiles) => {
    expect(run({ ...PACKAGE, ...lockfiles })).toEqual([])
  })

  check.each([
    ['no package.json', { 'bun.lock': '', 'package-lock.json': '' }],
    [
      'a package.json that is a folder',
      { 'package.json/x': '', 'bun.lock': '', 'package-lock.json': '' },
    ],
    [
      'a package.json in a subfolder',
      { 'sub/package.json': '{}', 'bun.lock': '', 'package-lock.json': '' },
    ],
    ['lockfiles in a subfolder', { ...PACKAGE, 'sub/bun.lock': '', 'sub/package-lock.json': '' }],
    ['a bun.lock in a subfolder only', { ...PACKAGE, 'sub/bun.lock': '' }],
  ])('stays silent for %s', (_title, files) => {
    expect(run(files)).toEqual([])
  })

  // A lockfile that the rule cannot see could be the first match, or could be an npm lockfile.
  linked.each([
    ['bun.lock', 'bun.lock'],
    ['npm-shrinkwrap.json', 'npm-shrinkwrap.json'],
    ['package-lock.json', 'package-lock.json'],
  ])('stays silent when %s is a link with no target', (_title, lockfile) => {
    const others = ['bun.lock', 'npm-shrinkwrap.json', 'package-lock.json'].filter(
      (file) => file !== lockfile,
    )
    const { dir, code, top } = pluginTree(
      { name: 'p' },
      { ...PACKAGE, ...Object.fromEntries(others.map((file) => [file, ''])) },
    )
    link(top, lockfile, 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a bun.lock alone when an npm lockfile is a link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { ...PACKAGE, 'bun.lock': '' })
    link(top, 'package-lock.json', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a lockfile that is a link out of the repository', () => {
    const elsewhere = tree({ 'package-lock.json': '{}' })
    const { dir, code, top } = pluginTree({ name: 'p' }, { ...PACKAGE, 'bun.lock': '' })
    link(top, 'package-lock.json', path.join(elsewhere, 'package-lock.json'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a package.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'package.json': '{}' })
    const { dir, code, top } = pluginTree(
      { name: 'p' },
      { 'bun.lock': '', 'package-lock.json': '' },
    )
    link(top, 'package.json', path.join(elsewhere, 'package.json'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a package.json that is a link with no target', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p' },
      { 'bun.lock': '', 'package-lock.json': '' },
    )
    link(top, 'package.json', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ ...PACKAGE, 'bun.lock': '', 'package-lock.json': '' })
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ ...PACKAGE, 'bun.lock': '', 'package-lock.json': '' })
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, { ...PACKAGE, 'bun.lock': '', 'package-lock.json': '' })
    expect(lint(dir, '{"name": "p"}')).toEqual([])
  })
})
