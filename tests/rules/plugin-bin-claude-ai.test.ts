// claude.ai and Cowork do not install a plugin that has a top-level `bin/` folder (components
// reference, "Executables"). No file says that a plugin targets claude.ai, so the option `targets`
// names it, as it does for `mcp-plugin-stdio-reach`, and the rule reports nothing without
// `claude-ai` in it. The trees are on disk, because the rule looks for the folder. The files glob is
// in tests/configs.test.ts.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import claude from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-bin-claude-ai'
const check = it.fails
const linked = noLinks ? it.skip : check
const ON = [{ targets: ['claude-ai'] }]

const MESSAGE =
  'The plugin has a top-level `bin/` folder. claude.ai and Cowork do not install a plugin that has one. Move the executables out of `bin/`, or remove `claude-ai` from the option `targets`.'

/** The messages of the rule with the options `options` for the manifest `code` of the plugin `dir`. */
function lint(dir: string, code: string, options: unknown[] = ON) {
  return new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude-plugin/plugin.json'],
        plugins: { json, claude },
        language: 'json/json',
        rules: { [`claude/${RULE}`]: ['error', ...options] },
      },
    ],
    { filename: path.join(dir, '.claude-plugin', 'plugin.json') },
  )
}
const run = (files: Record<string, string>, options: unknown[] = ON) => {
  const { dir, code } = pluginTree({ name: 'p' }, files)
  return lint(dir, code, options).map((m) => m.message)
}
const BIN = { 'bin/tool': '#!/bin/sh\n' }

describe(RULE, () => {
  check('reports on the document, with the full message', () => {
    const { dir, code } = pluginTree({ name: 'p' }, BIN)
    const found = lint(dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'bin',
      message: MESSAGE,
      line: 1,
      column: 1,
    })
  })

  check('reports a bin folder with no file in it', () => {
    const { dir, code, top } = pluginTree({ name: 'p' })
    mkdirSync(path.join(top, 'bin'))
    expect(lint(dir, code)).toHaveLength(1)
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree({ name: 'p' }, BIN, 'plugins/p/')
    expect(lint(dir, code)).toHaveLength(1)
  })

  check('reports when targets holds claude-ai', () => {
    expect(run(BIN, [{ targets: ['claude-ai'] }])).toEqual([MESSAGE])
  })

  linked('reports a bin folder that is a link to a folder in the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'tools/x': '' })
    link(top, 'bin', 'tools')
    expect(lint(dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no options', []],
    ['an empty object', [{}]],
    ['an empty targets list', [{ targets: [] }]],
  ])('stays silent with %s, even with a bin folder', (_title, options) => {
    expect(run(BIN, options)).toEqual([])
  })

  check('refuses a target that is not claude-ai', () => {
    expect(() => run(BIN, [{ targets: ['cowork'] }])).toThrow(/targets/)
  })

  check.each([
    ['no bin folder', {}],
    ['a bin file', { bin: '' }],
    ['a bin folder in a subfolder', { 'sub/bin/tool': '' }],
    ['a bin folder in .claude-plugin', { '.claude-plugin/bin/tool': '' }],
    ['a folder named like bin', { 'bins/tool': '', 'bin2/tool': '' }],
  ])('stays silent for %s', (_title, files) => {
    expect(run(files)).toEqual([])
  })

  linked('stays silent for a bin link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a bin link to a folder out of the repository', () => {
    const elsewhere = tree({ tool: '' })
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin', elsewhere)
    expect(lint(dir, code)).toEqual([])
  })

  linked(
    'stays silent for a bin link to a folder that leaves the plugin and stays in the repository',
    () => {
      const { dir, code, top } = pluginTree({ name: 'p' }, { 'shared/tool': '' }, 'plugins/p/')
      link(top, 'plugins/p/bin', path.join(top, 'shared'))
      expect(lint(dir, code)).toEqual([])
    },
  )

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree(BIN)
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    expect(lint(tree(BIN), '{"name": "p"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, BIN)
    expect(lint(dir, '{"name": "p"}')).toEqual([])
  })
})
