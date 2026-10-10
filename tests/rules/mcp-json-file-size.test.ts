// The rule counts the UTF-8 bytes of the text of a `.mcp.json`. The files glob is in
// tests/configs.test.ts. The limit is 2 MiB, 2097152 bytes, in the Claude Code docs.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-json-file-size')

const LIMIT = 2 * 1024 * 1024
const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')

/** A JSON object of exactly `bytes` bytes: one ASCII string value pads it. */
function objectOfBytes(bytes: number): string {
  const frame = '{"a":""}'
  return `{"a":"${'x'.repeat(bytes - frame.length)}"}`
}

jsonTester.run('mcp-json-file-size (valid)', rule, {
  valid: [
    { code: '{"mcpServers": {}}', filename: project },
    // The file at the limit is not over it.
    { name: 'at the limit, project file', code: objectOfBytes(LIMIT), filename: project },
    { name: 'at the limit, nested', code: objectOfBytes(LIMIT), filename: 'packages/a/.mcp.json' },
    { name: 'at the limit, plugin file', code: objectOfBytes(LIMIT), filename: pluginMcp },
    // A custom limit: at it, silent.
    { code: objectOfBytes(100), filename: project, options: [{ max: 100 }] },
    { code: '{}', filename: project, options: [{ max: 2 }] },
    // The count is of bytes, not characters. 1,000 two-byte letters are 2,000 bytes.
    { code: `{"a":"${'é'.repeat(1000)}"}`, filename: project, options: [{ max: 2008 }] },
    // The parser removes a byte order mark before the rule runs, so the rule does not count it.
    { code: '﻿{}', filename: project, options: [{ max: 2 }] },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    { name: 'unread path', code: objectOfBytes(LIMIT + 1), filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-json-file-size (invalid)', rule, {
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
      name: 'one byte over, nested',
      code: objectOfBytes(LIMIT + 1),
      filename: 'packages/a/.mcp.json',
      errors: [{ messageId: 'tooLarge' }],
    },
    {
      name: 'one byte over, plugin file',
      code: objectOfBytes(LIMIT + 1),
      filename: pluginMcp,
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
jsonTester.run('mcp-json-file-size (message text)', rule, {
  valid: [],
  invalid: [
    {
      name: 'default message text',
      code: objectOfBytes(LIMIT + 1),
      filename: project,
      errors: [
        {
          message:
            'This .mcp.json has 2097153 bytes. `claude mcp add`, `add-json --scope project` and `remove` refuse a file of more than 2097152 bytes.',
        },
      ],
    },
    {
      code: objectOfBytes(101),
      filename: project,
      options: [{ max: 100 }],
      errors: [{ message: 'This .mcp.json has 101 bytes. The configured limit is 100 bytes.' }],
    },
  ],
})

// The schema of the option `max`: an integer from 1 to 2097152, and no other key.
describe('mcp-json-file-size option schema', () => {
  const lint = (options: object[], code = '{}') =>
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/mcp-json-file-size': ['error', ...options] },
        },
      ],
      { filename: project },
    )

  it('accepts an empty object and each integer from 1 to 2097152', () => {
    expect(lint([{}])).toEqual([])
    expect(lint([{ max: 1 }])).toHaveLength(1)
    expect(lint([{ max: LIMIT }])).toEqual([])
  })
  it('applies the default limit beside an empty object', () => {
    expect(lint([{}], objectOfBytes(LIMIT + 1))).toHaveLength(1)
  })
  it('refuses 0, a fraction, a value above 2097152, and an unknown key', () => {
    expect(() => lint([{ max: 0 }])).toThrow()
    expect(() => lint([{ max: 1.5 }])).toThrow()
    expect(() => lint([{ max: LIMIT + 1 }])).toThrow()
    expect(() => lint([{ min: 1 }])).toThrow()
  })
})
