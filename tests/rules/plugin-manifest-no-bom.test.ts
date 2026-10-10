// A `plugin.json` that starts with a UTF-8 byte order mark. Claude Code before v2.1.246 fails to
// install such a plugin. ESLint removes the mark before a rule sees the text, so the rule reads the
// first bytes of the file on disk. Each case builds a tree on disk. The text that a case gives to
// ESLint has no mark, as ESLint gives it to the rule. The files glob is in tests/configs.test.ts.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import claude from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-manifest-no-bom'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check

const BOM = '\u{feff}'
const NAME = '{"name": "p"}'
const MESSAGE =
  'This `plugin.json` starts with a UTF-8 byte order mark. Claude Code before v2.1.246 fails to install the plugin. Save the file with no mark, or set the option `minVersion` to 2.1.246 or later.'
const BEFORE_FIX = { minVersion: '2.1.245' }

/** The messages of the rule for the plugin at `dir`. `options` is the option object, if any. */
const lint = (dir: string, options?: object) =>
  new Linter({ cwd: path.parse(dir).root }).verify(
    NAME,
    [
      {
        files: ['**/.claude-plugin/plugin.json'],
        plugins: { json, claude },
        language: 'json/json',
        rules: { [`claude/${RULE}`]: options === undefined ? 'error' : ['error', options] },
      },
    ],
    { filename: path.join(dir, '.claude-plugin', 'plugin.json') },
  )

const ids = (dir: string, options?: object) => lint(dir, options).map((m) => m.messageId)
/** The root of a plugin whose manifest file holds `text`. */
const plugin = (text: string, at = '') => pluginTree(text, {}, at).dir

describe(RULE, () => {
  check('reports a mark, with the full message and the position', () => {
    const found = lint(plugin(BOM + NAME), BEFORE_FIX)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'bom',
      message: MESSAGE,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    })
  })

  check.each(['2.1.245', '2.1.9', '2.0.999', '1.99.99', '0.0.0'])(
    'reports a mark when minVersion is %s, below 2.1.246',
    (minVersion) => {
      expect(ids(plugin(BOM + NAME), { minVersion })).toEqual(['bom'])
    },
  )

  check('reports a mark in a plugin below the repository root', () => {
    expect(ids(plugin(BOM + NAME, 'plugins/p/'), BEFORE_FIX)).toEqual(['bom'])
  })

  check('reports a manifest that holds only the mark', () => {
    expect(ids(plugin(BOM), BEFORE_FIX)).toEqual(['bom'])
  })

  linked('reports a manifest that is a link to a file in the repository', () => {
    const top = tree({ 'real.json': BOM + NAME })
    link(top, '.claude-plugin/plugin.json', '../real.json')
    expect(ids(top, BEFORE_FIX)).toEqual(['bom'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no option', undefined],
    ['an empty option object', {}],
    ['minVersion 2.1.246', { minVersion: '2.1.246' }],
    ['minVersion 2.1.247', { minVersion: '2.1.247' }],
    ['minVersion 2.2.0', { minVersion: '2.2.0' }],
    ['minVersion 3.0.0', { minVersion: '3.0.0' }],
    ['minVersion 2.1.1000', { minVersion: '2.1.1000' }],
  ])('stays silent for a mark with %s', (_title, options) => {
    expect(ids(plugin(BOM + NAME), options)).toEqual([])
  })

  check.each([
    ['a manifest with no mark', NAME],
    ['an empty manifest', ''],
    ['a one-byte manifest', '{'],
    ['a mark that is not the first character', `\n${BOM}${NAME}`],
  ])('stays silent for %s, below 2.1.246', (_title, text) => {
    expect(ids(plugin(text), BEFORE_FIX)).toEqual([])
  })

  // Strings cannot hold these bytes, so the cases write them after the tree is built.
  check.each([
    ['the first two bytes of the mark', [0xef, 0xbb]],
    ['a wrong third byte', [0xef, 0xbb, 0xbe, 0x0a]],
    ['a wrong first byte', [0x00, 0xbb, 0xbf, 0x0a]],
  ])('stays silent for %s', (_title, bytes) => {
    const dir = plugin(NAME)
    writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), Buffer.from(bytes))
    expect(ids(dir, BEFORE_FIX)).toEqual([])
  })

  check('stays silent for a manifest that is not on disk', () => {
    const top = tree({})
    expect(ids(top, BEFORE_FIX)).toEqual([])
  })

  linked('stays silent for a manifest that is a link with no target', () => {
    const top = tree({})
    link(top, '.claude-plugin/plugin.json', 'ghost.json')
    expect(ids(top, BEFORE_FIX)).toEqual([])
  })

  linked('stays silent for a manifest that is a link out of the repository', () => {
    const elsewhere = tree({ 'plugin.json': BOM + NAME }, false)
    const top = tree({})
    link(top, '.claude-plugin/plugin.json', path.join(elsewhere, 'plugin.json'))
    expect(ids(top, BEFORE_FIX)).toEqual([])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ '.claude-plugin/plugin.json': BOM + NAME }, false)
    const top = tree({})
    link(top, 'plugins/p', elsewhere)
    expect(ids(path.join(top, 'plugins', 'p'), BEFORE_FIX)).toEqual([])
  })

  // The root is out of the repository, and its `.claude-plugin` is a link back into it.
  linked('stays silent for a root out of the repository with a link back in', () => {
    const top = tree({ 'shared/plugin.json': BOM + NAME })
    const elsewhere = tree({}, false)
    link(elsewhere, '.claude-plugin', path.join(top, 'shared'))
    link(top, 'plugins/p', elsewhere)
    expect(ids(path.join(top, 'plugins', 'p'), BEFORE_FIX)).toEqual([])
  })

  locked('stays silent for a manifest with no read access', () => {
    const dir = plugin(BOM + NAME)
    const file = path.join(dir, '.claude-plugin', 'plugin.json')
    withoutAccess(file, () => expect(ids(dir, BEFORE_FIX)).toEqual([]))
  })
})

describe(`${RULE} (option)`, () => {
  const PATTERN = 'should match pattern'
  check.each([
    ['a version with two numbers', { minVersion: '2.1' }, PATTERN],
    ['a version with a leading v', { minVersion: 'v2.1.0' }, PATTERN],
    ['a number', { minVersion: 2 }, 'should be string'],
    ['an extra key', { minVersion: '2.1.0', other: 1 }, 'should NOT have additional properties'],
  ])('refuses %s', (_title, options, reason) => {
    expect(() => lint(plugin(NAME), options)).toThrow(reason)
  })
})
