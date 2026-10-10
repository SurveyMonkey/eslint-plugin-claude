// `disableClaudeAiConnectors: false` is the same as unset. The settings reference says so. The MCP
// page says that a project `false` cannot re-enable the connectors. The rule reads the managed
// files. `settings-project-value-ignored` reports the value in the two project files. The files
// glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-disable-connectors-false')

const main = 'managed-settings.json'
const dropIn = 'etc/claude-code/managed-settings.d/10-a.json'
const value = (v: unknown) => JSON.stringify({ disableClaudeAiConnectors: v })

jsonTester.run('mcp-disable-connectors-false (valid)', rule, {
  valid: [
    { name: 'true', code: value(true), filename: main },
    { name: 'no key', code: JSON.stringify({ model: 'x' }), filename: dropIn },
    { name: 'array body', code: '[]', filename: main },
    // A value that is not the Boolean false.
    { name: 'the string false', code: value('false'), filename: main },
    { name: 'zero', code: value(0), filename: main },
    { name: 'null', code: value(null), filename: main },
    { name: 'an empty array', code: value([]), filename: main },
    // A key inside a value is not the key.
    {
      name: 'a nested key',
      code: JSON.stringify({ env: { disableClaudeAiConnectors: false } }),
      filename: main,
    },
    // Two keys of one name. The rule reads the last.
    {
      name: 'duplicate key, the last is true',
      code: '{"disableClaudeAiConnectors": false, "disableClaudeAiConnectors": true}',
      filename: main,
    },
    // Claude Code ignores a hidden drop-in.
    { name: 'hidden drop-in', code: value(false), filename: 'managed-settings.d/.10-a.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-disable-connectors-false (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'the main file, with the position of the value',
      code: value(false),
      filename: main,
      errors: [{ messageId: 'unset', line: 1, column: 30, endColumn: 35 }],
    },
    {
      name: 'a drop-in',
      code: value(false),
      filename: dropIn,
      errors: [{ messageId: 'unset' }],
    },
    {
      name: 'a drop-in named like a local file',
      code: value(false),
      filename: 'managed-settings.d/settings.local.json',
      errors: [{ messageId: 'unset' }],
    },
    {
      name: 'duplicate key, the last is false',
      code: '{"disableClaudeAiConnectors": true, "disableClaudeAiConnectors": false}',
      filename: main,
      errors: [{ messageId: 'unset', column: 66 }],
    },
  ],
})

describe('mcp-disable-connectors-false on a hidden drop-in', () => {
  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('mcp-disable-connectors-false', value(false), 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })
  it('is silent in a hidden drop-in', () => {
    expect(
      lintJson('mcp-disable-connectors-false', value(false), 'managed-settings.d/.10-a.json'),
    ).toEqual([])
  })
})

// The text of the message.
jsonTester.run('mcp-disable-connectors-false (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: value(false),
      filename: main,
      errors: [
        {
          message:
            'The value false for "disableClaudeAiConnectors" is the same as unset. It cannot turn the connectors back on after a true in another file. Remove the key.',
        },
      ],
    },
  ],
})
