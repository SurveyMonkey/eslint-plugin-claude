// A plugin with a `package.json` and only a lockfile that Claude Code does not
// read gets no dependency install (loading page, "When the dependency install
// runs"). The trees are on disk, because the rule looks for the lockfiles. The
// files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-package-lockfile'
const check = it.fails
const linked = noLinks ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const message = (files: string) =>
  `The plugin has a \`package.json\` and ${files}, and none of \`bun.lock\`, \`npm-shrinkwrap.json\` or \`package-lock.json\`. Claude Code skips the dependency install. Add an npm lockfile.`
const run = (files: Record<string, string>) => {
  const { dir, code } = pluginTree({ name: 'p' }, files)
  return lint(dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports on the document, with the full message', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { 'package.json': '{}', 'yarn.lock': '' })
    const found = lint(dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unsupported',
      message: message('`yarn.lock`'),
      line: 1,
      column: 1,
    })
  })

  check.each([
    ['yarn.lock', { 'yarn.lock': '' }, '`yarn.lock`'],
    ['pnpm-lock.yaml', { 'pnpm-lock.yaml': '' }, '`pnpm-lock.yaml`'],
    ['bun.lockb', { 'bun.lockb': '' }, '`bun.lockb`'],
    [
      'each of the three, in name order',
      { 'yarn.lock': '', 'pnpm-lock.yaml': '', 'bun.lockb': '' },
      '`bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`',
    ],
  ])('reports %s', (_title, lockfiles, files) => {
    expect(run({ 'package.json': '{}', ...lockfiles })).toEqual([message(files)])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { 'package.json': '{}', 'yarn.lock': '' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })

  linked('reports a lockfile that is a link to a file in the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'package.json': '{}', 'real.lock': '' })
    link(top, 'yarn.lock', 'real.lock')
    expect(lint(dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['bun.lock', { 'bun.lock': '' }],
    ['npm-shrinkwrap.json', { 'npm-shrinkwrap.json': '' }],
    ['package-lock.json', { 'package-lock.json': '' }],
    ['a supported lockfile beside yarn.lock', { 'package-lock.json': '', 'yarn.lock': '' }],
    ['a supported lockfile beside bun.lockb', { 'bun.lock': '', 'bun.lockb': '' }],
    [
      'a supported lockfile beside pnpm-lock.yaml',
      { 'npm-shrinkwrap.json': '', 'pnpm-lock.yaml': '' },
    ],
  ])('stays silent for %s', (_title, lockfiles) => {
    expect(run({ 'package.json': '{}', ...lockfiles })).toEqual([])
  })

  check.each([
    ['a package.json and no lockfile', { 'package.json': '{}' }],
    ['a skipped lockfile and no package.json', { 'yarn.lock': '' }],
    ['no file', {}],
    ['a package.json in a subfolder', { 'sub/package.json': '{}', 'yarn.lock': '' }],
    ['a yarn.lock in a subfolder', { 'package.json': '{}', 'sub/yarn.lock': '' }],
    ['a package.json that is a folder', { 'package.json/x': '', 'yarn.lock': '' }],
    ['a yarn.lock that is a folder', { 'package.json': '{}', 'yarn.lock/x': '' }],
    [
      'a bunfig.toml beside a bun.lockb',
      { 'package.json': '{}', 'bunfig.toml': '', 'bun.lock': '' },
    ],
  ])('stays silent for %s', (_title, files) => {
    expect(run(files)).toEqual([])
  })

  linked('stays silent for a supported lockfile that is a link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'package.json': '{}', 'yarn.lock': '' })
    link(top, 'package-lock.json', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a supported lockfile that is a link out of the repository', () => {
    const elsewhere = tree({ 'package-lock.json': '{}' })
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'package.json': '{}', 'yarn.lock': '' })
    link(top, 'package-lock.json', path.join(elsewhere, 'package-lock.json'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a package.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'package.json': '{}' })
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'yarn.lock': '' })
    link(top, 'package.json', path.join(elsewhere, 'package.json'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a skipped lockfile that is a link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'package.json': '{}' })
    link(top, 'yarn.lock', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ 'package.json': '{}', 'yarn.lock': '' })
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ 'package.json': '{}', 'yarn.lock': '' })
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, { 'package.json': '{}', 'yarn.lock': '' })
    expect(lint(dir, '{"name": "p"}')).toEqual([])
  })
})
