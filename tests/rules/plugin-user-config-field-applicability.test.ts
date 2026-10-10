// In a `userConfig` option, `min` and `max` are bounds for a `number`, and `multiple` is for a
// `string` (manifest reference, "User configuration"). `claude plugin validate` passes the other
// combinations. The rule reads the top-level `userConfig` and the `userConfig` of each channel. The
// files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-user-config-field-applicability'
const check = it.fails

const bound = (field: string, option: string, type: string) =>
  `\`${field}\` sets a bound for a \`number\` option. The option "${option}" has \`type: ${type}\`.`
const multiple = (option: string, type: string) =>
  `\`multiple\` is a field of a \`string\` option. The option "${option}" has \`type: ${type}\`.`
const option = (type: unknown, more: Record<string, unknown> = {}) => ({
  type,
  title: 'T',
  description: 'D',
  ...more,
})
const run = (fields: Record<string, unknown>) => {
  const { dir, code } = pluginTree({ name: 'p', ...fields })
  return lintPlugin(RULE, dir, code)
}
const config = (options: Record<string, unknown>) => run({ userConfig: options })

describe(RULE, () => {
  check('reports min on a string option, with the full message and the position of the key', () => {
    const found = config({ name: option('string', { min: 1 }) })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'bound',
      message: bound('min', 'name', 'string'),
      line: 1,
      column: 81,
      endLine: 1,
      endColumn: 86,
    })
  })

  check('reports multiple on a number option, with the full message', () => {
    const found = config({ count: option('number', { multiple: true }) })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      messageId: 'multiple',
      message: multiple('count', 'number'),
      line: 1,
    })
  })

  check.each([
    ['min on a boolean', { type: 'boolean', min: 0 }, [bound('min', 'o', 'boolean')]],
    ['max on a directory', { type: 'directory', max: 3 }, [bound('max', 'o', 'directory')]],
    ['max on a file', { type: 'file', max: 3 }, [bound('max', 'o', 'file')]],
    ['multiple on a boolean', { type: 'boolean', multiple: true }, [multiple('o', 'boolean')]],
    ['multiple on a file', { type: 'file', multiple: false }, [multiple('o', 'file')]],
    [
      'min and max on a string',
      { type: 'string', min: 1, max: 2 },
      [bound('min', 'o', 'string'), bound('max', 'o', 'string')],
    ],
    [
      'min and multiple on a boolean',
      { type: 'boolean', min: 1, multiple: true },
      [bound('min', 'o', 'boolean'), multiple('o', 'boolean')],
    ],
    ['a type that is not in the docs', { type: 'text', min: 1 }, [bound('min', 'o', 'text')]],
  ])('reports %s', (_title, fields, messages) => {
    expect(
      config({ o: { title: 'T', description: 'D', ...fields } }).map((m) => m.message),
    ).toEqual(messages)
  })

  check('reports an option with a mismatch and leaves the others alone', () => {
    const found = config({
      a: option('number', { min: 1, max: 5 }),
      b: option('string', { max: 5 }),
      c: option('string', { multiple: true }),
    })
    expect(found.map((m) => m.message)).toEqual([bound('max', 'b', 'string')])
  })

  check('reports the option of a channel', () => {
    const found = run({
      channels: [
        { server: 's', userConfig: { token: option('number', { multiple: true }) } },
        { server: 't', userConfig: { ok: option('number', { min: 1 }) } },
      ],
    })
    expect(found.map((m) => m.message)).toEqual([multiple('token', 'number')])
  })

  check('reports the last of two keys, as JSON.parse reads them', () => {
    const { dir, code } = pluginTree(
      '{"name": "p", "userConfig": {"a": {"type": "string", "type": "number", "min": 1}}}',
    )
    expect(lintPlugin(RULE, dir, code)).toEqual([])
    const second = pluginTree(
      '{"name": "p", "userConfig": {"a": {"type": "number", "type": "string", "min": 1}}}',
    )
    expect(lintPlugin(RULE, second.dir, second.code).map((m) => m.message)).toEqual([
      bound('min', 'a', 'string'),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p', userConfig: { a: option('string', { min: 1 }) } },
      {},
      'plugins/p/',
    )
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['bound'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['min and max on a number', option('number', { min: 1, max: 9 })],
    ['multiple on a string', option('string', { multiple: true })],
    ['multiple set to false on a string', option('string', { multiple: false })],
    ['no min, max or multiple', option('boolean', { default: true })],
    ['a missing type', { title: 'T', description: 'D', min: 1 }],
    ['a type that is not a string', option(3, { min: 1, multiple: true })],
    ['a type that is null', option(null, { max: 1 })],
    ['a type that is an array', option(['string'], { min: 1 })],
    ['a field of the table on a string', option('string', { options: ['a'], default: 'a' })],
    ['an unknown field', option('boolean', { minimum: 1 })],
  ])('stays silent for %s', (_title, value) => {
    expect(config({ o: value })).toEqual([])
  })

  check.each([
    ['an option that is a string', 'min'],
    ['an option that is null', null],
    ['an option that is an array', [{ type: 'string', min: 1 }]],
  ])('stays silent for %s', (_title, value) => {
    expect(config({ o: value })).toEqual([])
  })

  check.each([
    ['userConfig as an array', [{ type: 'string', min: 1 }]],
    ['userConfig as a string', 'min'],
    ['userConfig as null', null],
    ['no userConfig', undefined],
  ])('stays silent for %s', (_title, userConfig) => {
    expect(run({ userConfig })).toEqual([])
  })

  check.each([
    ['channels as an object', { server: 's', userConfig: { a: option('string', { min: 1 }) } }],
    ['a channel that is a string', ['s']],
    ['a channel with no userConfig', [{ server: 's' }]],
    ['a channel userConfig that is an array', [{ userConfig: [option('string', { min: 1 })] }]],
  ])('stays silent for %s', (_title, channels) => {
    expect(run({ channels })).toEqual([])
  })

  check('stays silent for min in a userConfig that another key holds', () => {
    expect(run({ metadata: { userConfig: { a: option('string', { min: 1 }) } } })).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    const code = JSON.stringify({ name: 'p', userConfig: { a: option('string', { min: 1 }) } })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })
})
