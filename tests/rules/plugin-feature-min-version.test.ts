// A `plugin.json` that uses a feature that a Claude Code before some version cannot load. The
// rule reports only when the option `minVersion` is set and is older than the version that added
// the feature. The trees are on disk, because the rule needs the plugin root. The files glob is
// in tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import claude from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-feature-min-version'
const check = it
const linked = noLinks ? it.skip : check

/** The messages of the rule for the manifest `code` of the plugin `dir`. `options` is the option
 *  object, if any. */
const lint = (dir: string, code: string, options?: unknown) =>
  new Linter({ cwd: path.parse(dir).root }).verify(
    code,
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

const run = (fields: Record<string, unknown>, options?: unknown, at = '') => {
  const { dir, code } = pluginTree({ name: 'p', ...fields }, {}, at)
  return lint(dir, code, options)
}
const ids = (fields: Record<string, unknown>, minVersion: string) =>
  run(fields, { minVersion }).map((m) => m.messageId)

const SKILLS_DOT =
  'The `skills` path "." fails manifest validation on Claude Code before v2.1.221. Use "./" for the plugin root, or set the option `minVersion` to 2.1.221 or later.'
const METADATA =
  'The `metadata` key needs Claude Code v2.1.222 or later. Remove it, or set the option `minVersion` to 2.1.222 or later.'
const OPTIONS =
  'The `options` of a `userConfig` field needs Claude Code v2.1.271 or later. Before that, the plugin fails to load. Remove it, or set the option `minVersion` to 2.1.271 or later.'
const TONE = { tone: { type: 'string', title: 'Tone', description: 'd', options: ['a', 'b'] } }

describe(RULE, () => {
  check('reports "." in skills, with the full message and the position', () => {
    const { dir } = pluginTree('{}')
    const code = '{"name": "p", "skills": "."}'
    const found = lint(dir, code, { minVersion: '2.1.220' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'skillsDot',
      message: SKILLS_DOT,
      line: 1,
      column: 25,
      endLine: 1,
      endColumn: 28,
    })
  })

  check('reports metadata, with the full message and the position', () => {
    const { dir } = pluginTree('{}')
    const code = '{"name": "p", "metadata": {}}'
    const found = lint(dir, code, { minVersion: '2.1.221' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'metadata',
      message: METADATA,
      line: 1,
      column: 15,
      endLine: 1,
      endColumn: 29,
    })
  })

  check('reports options in a userConfig field, with the full message and the position', () => {
    const { dir } = pluginTree('{}')
    const code = '{"name": "p", "userConfig": {"t": {"options": ["a"]}}}'
    const found = lint(dir, code, { minVersion: '2.1.270' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'options',
      message: OPTIONS,
      line: 1,
      column: 36,
      endLine: 1,
      endColumn: 52,
    })
  })

  check.each([
    ['skills "."', { skills: '.' }, '2.1.220', ['skillsDot']],
    ['skills "." in an array', { skills: ['./a', '.'] }, '2.1.0', ['skillsDot']],
    ['two "." in skills', { skills: ['.', '.'] }, '2.1.220', ['skillsDot', 'skillsDot']],
    ['metadata', { metadata: { team: 'x' } }, '2.1.221', ['metadata']],
    ['metadata that is empty', { metadata: {} }, '2.0.0', ['metadata']],
    ['metadata that is a string', { metadata: 'x' }, '1.99.99', ['metadata']],
    ['userConfig options', { userConfig: TONE }, '2.1.270', ['options']],
    [
      'options on two fields',
      { userConfig: { ...TONE, mode: { options: [] } } },
      '2.1.0',
      ['options', 'options'],
    ],
    [
      'options that is not an array',
      { userConfig: { t: { options: 'a' } } },
      '2.1.270',
      ['options'],
    ],
    [
      'all three',
      { skills: '.', metadata: {}, userConfig: TONE },
      '2.1.200',
      ['skillsDot', 'metadata', 'options'],
    ],
  ])('reports %s below its version', (_title, fields, minVersion, expected) => {
    expect(ids(fields, minVersion)).toEqual(expected)
  })

  check('reports only the features newer than minVersion', () => {
    const fields = { skills: '.', metadata: {}, userConfig: TONE }
    expect(ids(fields, '2.1.221')).toEqual(['metadata', 'options'])
    expect(ids(fields, '2.1.222')).toEqual(['options'])
    expect(ids(fields, '2.1.271')).toEqual([])
  })

  check('reports in a plugin below the repository root', () => {
    expect(
      run({ skills: '.' }, { minVersion: '2.1.220' }, 'plugins/p/').map((m) => m.messageId),
    ).toEqual(['skillsDot'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no option', undefined],
    ['an empty option object', {}],
  ])('stays silent for every feature with %s', (_title, options) => {
    expect(run({ skills: '.', metadata: {}, userConfig: TONE }, options)).toEqual([])
  })

  check.each([
    ['skills "."', { skills: '.' }, '2.1.221'],
    ['skills "." above its version', { skills: '.' }, '2.2.0'],
    ['metadata', { metadata: {} }, '2.1.222'],
    ['metadata above its version', { metadata: {} }, '3.0.0'],
    ['userConfig options', { userConfig: TONE }, '2.1.271'],
    ['userConfig options above its version', { userConfig: TONE }, '2.1.1000'],
  ])(
    'stays silent for %s with minVersion at or above the version',
    (_title, fields, minVersion) => {
      expect(ids(fields, minVersion)).toEqual([])
    },
  )

  check.each([
    ['skills "./"', { skills: './' }],
    ['skills with paths', { skills: ['./a', './b'] }],
    ['skills that is a number', { skills: 1 }],
    ['skills that is an array of numbers', { skills: [1, null] }],
    ['skills that is an object', { skills: { path: '.' } }],
    ['skills "." in a nested key', { experimental: { skills: '.' }, x: { skills: '.' } }],
    ['a metadata key in a nested object', { x: { metadata: {} } }],
    ['userConfig with no options', { userConfig: { t: { type: 'string', title: 'T' } } }],
    ['userConfig that is a string', { userConfig: 'options' }],
    ['userConfig that is an array', { userConfig: [{ options: [] }] }],
    ['a userConfig field that is a string', { userConfig: { t: 'options' } }],
    ['an options key beside userConfig', { options: [], userConfig: {} }],
    ['an options key one level too deep', { userConfig: { t: { x: { options: [] } } } }],
  ])('stays silent for %s, at minVersion 2.0.0', (_title, fields) => {
    expect(ids(fields, '2.0.0')).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lint(dir, '{"name": "p", "metadata": {}}', { minVersion: '2.0.0' })).toEqual([])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ '.claude-plugin/plugin.json': '{"name": "p"}' }, false)
    const top = tree({})
    link(top, 'plugins/p', elsewhere)
    expect(
      lint(path.join(top, 'plugins', 'p'), '{"name": "p", "metadata": {}}', {
        minVersion: '2.0.0',
      }),
    ).toEqual([])
  })
})

describe(`${RULE} (option)`, () => {
  const PATTERN = 'should match pattern'
  const EXTRA = 'should NOT have additional properties'
  check.each([
    ['a version with two numbers', { minVersion: '2.1' }, PATTERN],
    ['a version with a leading v', { minVersion: 'v2.1.0' }, PATTERN],
    ['a version with a suffix', { minVersion: '2.1.0-beta' }, PATTERN],
    ['an empty version', { minVersion: '' }, PATTERN],
    ['a number', { minVersion: 2 }, 'should be string'],
    ['a misspelt key', { minversion: '2.1.0' }, EXTRA],
    ['an extra key', { minVersion: '2.1.0', other: 1 }, EXTRA],
  ])('refuses %s', (_title, options, reason) => {
    expect(() => run({ metadata: {} }, options)).toThrow(reason)
  })
})
