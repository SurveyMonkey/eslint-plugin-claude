// The rule counts the UTF-8 bytes of the text of a settings file. The files glob and the managed
// files are in tests/configs.test.ts. The limit is 2 MiB, 2097152 bytes, in the Claude Code docs.
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-file-size')

const LIMIT = 2 * 1024 * 1024

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'

/** A JSON object of exactly `bytes` bytes: one ASCII string value pads it. */
function objectOfBytes(bytes: number): string {
  const frame = '{"a":""}'
  return `{"a":"${'x'.repeat(bytes - frame.length)}"}`
}

jsonTester.run('settings-file-size (valid)', rule, {
  valid: [
    { code: '{}', filename: project },
    // The file at the limit is not over it.
    { name: 'at the limit, project file', code: objectOfBytes(LIMIT), filename: project },
    { name: 'at the limit, local file', code: objectOfBytes(LIMIT), filename: local },
    { name: 'at the limit, managed file', code: objectOfBytes(LIMIT), filename: managed },
    { name: 'at the limit, drop-in', code: objectOfBytes(LIMIT), filename: dropIn },
    // Claude Code ignores a hidden drop-in, so the rule makes no report on it.
    {
      name: 'hidden drop-in over the limit',
      code: objectOfBytes(LIMIT + 1),
      filename: 'managed-settings.d/.20-big.json',
    },
    {
      name: 'hidden drop-in over the limit, in a path',
      code: objectOfBytes(LIMIT + 1),
      filename: 'etc/managed-settings.d/.20-big.json',
    },
    // A custom limit: at it, silent.
    { code: objectOfBytes(100), filename: project, options: [{ max: 100 }] },
    { code: '{}', filename: project, options: [{ max: 2 }] },
    // The count is of bytes, not characters. 1,000 two-byte letters are 2,000 bytes.
    {
      code: `{"a":"${'é'.repeat(1000)}"}`,
      filename: project,
      options: [{ max: 2008 }],
    },
    // The parser removes a byte order mark before the rule runs, so the rule does not count it.
    { code: '﻿{}', filename: project, options: [{ max: 2 }] },
  ],
  invalid: [],
})

jsonTester.run('settings-file-size (invalid)', rule, {
  valid: [],
  invalid: [
    // One byte over the limit. The report is at the start of the file.
    {
      name: 'one byte over the limit, project file',
      code: objectOfBytes(LIMIT + 1),
      filename: project,
      errors: [{ messageId: 'tooLarge', line: 1, column: 1 }],
    },
    {
      name: 'one byte over, local file',
      code: objectOfBytes(LIMIT + 1),
      filename: local,
      errors: [{ messageId: 'tooLarge' }],
    },
    {
      name: 'one byte over, managed file',
      code: objectOfBytes(LIMIT + 1),
      filename: managed,
      errors: [{ messageId: 'tooLarge' }],
    },
    {
      name: 'one byte over, drop-in',
      code: objectOfBytes(LIMIT + 1),
      filename: dropIn,
      errors: [{ messageId: 'tooLarge' }],
    },
    // A hidden name outside the directory is no drop-in.
    {
      name: 'hidden settings file outside managed-settings.d',
      code: objectOfBytes(LIMIT + 1),
      filename: '.claude/.settings.local.json',
      errors: [{ messageId: 'tooLarge' }],
    },
    // An explicit limit equal to the default gives the same message as the default.
    {
      name: 'limit set to the default',
      code: objectOfBytes(LIMIT + 1),
      filename: project,
      options: [{ max: LIMIT }],
      errors: [{ messageId: 'tooLarge' }],
    },
    // A custom limit: one byte over.
    {
      code: objectOfBytes(101),
      filename: project,
      options: [{ max: 100 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
    // Two-byte letters: 1,005 characters, 2,002 bytes, over a limit of 2,000 bytes.
    {
      code: `{"a":"${'é'.repeat(997)}"}`,
      filename: project,
      options: [{ max: 2000 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
    // A byte order mark is not counted, so one byte more than the limit is still needed.
    {
      code: `﻿${objectOfBytes(101)}`,
      filename: project,
      options: [{ max: 100 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
  ],
})

// The text of each message.
jsonTester.run('settings-file-size (message text)', rule, {
  valid: [],
  invalid: [
    {
      name: 'default message text',
      code: objectOfBytes(LIMIT + 1),
      filename: project,
      errors: [
        {
          message:
            'This settings file has 2097153 bytes. Claude Code refuses a --settings file of more than 2097152 bytes.',
        },
      ],
    },
    {
      code: objectOfBytes(101),
      filename: project,
      options: [{ max: 100 }],
      errors: [{ message: 'This settings file has 101 bytes. The configured limit is 100 bytes.' }],
    },
  ],
})

// The schema of the option `max`: an integer from 1 to 2097152, and no other key.
describe('settings-file-size option schema', () => {
  const lint = (options: object[]) =>
    new Linter().verify(
      '{}',
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/settings-file-size': ['error', ...options] },
        },
      ],
      { filename: '.claude/settings.json' },
    )

  it('accepts an empty object and each integer from 1 to 2097152', () => {
    expect(lint([{}])).toEqual([])
    expect(lint([{ max: 1 }])).toHaveLength(1)
    expect(lint([{ max: LIMIT }])).toEqual([])
  })
  it('applies the default limit beside an empty object', () => {
    const over = 'x'.repeat(LIMIT)
    const messages = new Linter().verify(
      `{"a": "${over}"}`,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/settings-file-size': ['error', {}] },
        },
      ],
      { filename: '.claude/settings.json' },
    )
    expect(messages).toHaveLength(1)
  })
  it('refuses 0, a fraction, a value above 2097152, and an unknown key', () => {
    expect(() => lint([{ max: 0 }])).toThrow()
    expect(() => lint([{ max: 1.5 }])).toThrow()
    expect(() => lint([{ max: LIMIT + 1 }])).toThrow()
    expect(() => lint([{ min: 1 }])).toThrow()
  })
})
