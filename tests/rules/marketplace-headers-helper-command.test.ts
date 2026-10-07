// The rule reads the `headersHelper` of each entry in
// `.claude-plugin/marketplace.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import helper from '../../src/rules/marketplace-headers-helper-command.ts'
import { jsonTester } from '../rule-tester.test-support.ts'

const { rule } = helper
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const withHelper = (headersHelper: unknown) =>
  manifest({
    name: 'p',
    strict: false,
    source: { source: 'archive', url: 'https://x.test/p.zip' },
    headersHelper,
  })
const text = (length: number) => 'a'.repeat(length)

jsonTester.run('marketplace-headers-helper-command (valid)', rule, {
  valid: [
    { code: withHelper('/usr/local/bin/mint-token --scope read'), filename },
    { code: withHelper('mint-token'), filename },
    { code: withHelper('sh -c "get-token | jq ."'), filename },
    // 500 characters is the limit, and the limit is inclusive.
    { code: withHelper(text(500)), filename },
    // Three spaces are not a run of four.
    { code: withHelper('mint-token   --scope'), filename },
    // A path with a slash that does not start with `./` or `../`.
    { code: withHelper('/opt/bin/mint'), filename },
    { code: withHelper('~/bin/mint'), filename },
    { code: withHelper('bin/mint'), filename },
    // A relative path after the first word is not the command.
    { code: withHelper('mint-token ./config.json'), filename },
    { code: withHelper('.hidden-tool'), filename },
    { code: withHelper('..tool'), filename },
    { code: withHelper(''), filename },
    // A value of the wrong type is for the schema rule.
    { code: withHelper(5), filename },
    { code: withHelper(null), filename },
    { code: withHelper(['./mint']), filename },
    { code: manifest({ name: 'p', source: './p' }), filename },
    { code: manifest('p', null, 3), filename },
    { code: JSON.stringify({ name: 'acme', plugins: 'p' }), filename },
    { code: '[]', filename },
    // A helper in a source object is not read: a plugin source has no such field.
    {
      code: manifest({
        name: 'p',
        source: { source: 'url', url: 'https://x.test/r.git', headersHelper: './x' },
      }),
      filename,
    },
    // `max` moves the limit down, and 500 stays valid at `max: 500`.
    { code: withHelper(text(100)), filename, options: [{ max: 100 }] },
    { code: withHelper(text(500)), filename, options: [{ max: 500 }] },
    // Two `headersHelper` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"plugins": [{"headersHelper": "./bad", "headersHelper": "good"}]}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-headers-helper-command (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: withHelper('mint-token é'),
      filename,
      errors: [{ messageId: 'notPrintable', line: 1, column: 129 }],
    },
    { code: withHelper('mint\ttoken'), filename, errors: [{ messageId: 'notPrintable' }] },
    { code: withHelper('mint\u007ftoken'), filename, errors: [{ messageId: 'notPrintable' }] },
    {
      code: withHelper(text(501)),
      filename,
      errors: [{ messageId: 'tooLong', data: { length: '501', max: '500' } }],
    },
    // At another value, the message names the configured limit.
    {
      code: withHelper(text(101)),
      filename,
      options: [{ max: 100 }],
      errors: [{ messageId: 'overConfiguredLimit', data: { length: '101', max: '100' } }],
    },
    {
      code: withHelper(text(501)),
      filename,
      options: [{ max: 500 }],
      errors: [{ messageId: 'tooLong', data: { length: '501', max: '500' } }],
    },
    {
      code: withHelper('mint    token'),
      filename,
      errors: [{ messageId: 'spaceRun' }],
    },
    {
      code: withHelper('mint-token      '),
      filename,
      errors: [{ messageId: 'spaceRun' }],
    },
    {
      code: withHelper('./mint-token --scope read'),
      filename,
      errors: [{ messageId: 'relativePath', data: { word: './mint-token' } }],
    },
    {
      code: withHelper('../bin/mint'),
      filename,
      errors: [{ messageId: 'relativePath', data: { word: '../bin/mint' } }],
    },
    // The first word, after leading spaces.
    {
      code: withHelper('  ./mint'),
      filename,
      errors: [{ messageId: 'relativePath', data: { word: './mint' } }],
    },
    // Each fault is its own report, in the order of the messages.
    {
      code: withHelper(`./mint    ${text(500)}`),
      filename,
      errors: [
        { messageId: 'tooLong', data: { length: '510', max: '500' } },
        { messageId: 'spaceRun' },
        { messageId: 'relativePath' },
      ],
    },
    // Each entry reports on its own value.
    {
      code: manifest(
        { name: 'a', headersHelper: './a' },
        { name: 'b', headersHelper: 'ok' },
        { name: 'c', headersHelper: '../c' },
      ),
      filename,
      errors: [
        { messageId: 'relativePath', data: { word: './a' } },
        { messageId: 'relativePath', data: { word: '../c' } },
      ],
    },
    // Two `headersHelper` keys. `JSON.parse` keeps the last.
    {
      code: '{"plugins": [{"headersHelper": "good", "headersHelper": "./bad"}]}',
      filename,
      errors: [{ messageId: 'relativePath' }],
    },
  ],
})

describe('marketplace-headers-helper-command options', () => {
  const lint = (length: number, options: unknown[]) =>
    new Linter({ cwd: '/' }).verify(
      withHelper(text(length)),
      [
        {
          files: ['**/*.json'],
          plugins: { json, markdown, claude: { rules: { [helper.name]: rule } } },
          language: 'json/json',
          rules: { [`claude/${helper.name}`]: ['error', ...options] as never },
        },
      ],
      { filename: '/repo/.claude-plugin/marketplace.json' },
    )

  it('names a team value as the configured limit and not as the docs limit', () => {
    const [report] = lint(150, [{ max: 100 }])
    expect(report?.message).toBe(
      'The "headersHelper" command has 150 characters. The configured limit is 100.',
    )
  })

  it('keeps the default when the option object is empty', () => {
    const [report] = lint(501, [{}])
    expect(report?.message).toBe(
      'The "headersHelper" command has 501 characters. The docs allow at most 500.',
    )
  })

  it.each([
    ['zero', { max: 0 }],
    ['a fraction', { max: 1.5 }],
    ['a string', { max: '100' }],
    ['a value above 500', { max: 501 }],
    ['an unknown key', { max: 100, extra: 1 }],
  ])('refuses %s as the option', (_, option) => {
    expect(() => lint(10, [option])).toThrow(/Key "claude\/marketplace-headers-helper-command"/)
  })
})
