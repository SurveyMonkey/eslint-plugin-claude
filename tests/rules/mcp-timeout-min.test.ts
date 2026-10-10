// The per-server `timeout` of `.mcp.json` is in milliseconds. Claude Code ignores a value below
// 1000, and the server falls back to `MCP_TOOL_TIMEOUT`. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-timeout-min')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const wrap = (entry: string) => `{"mcpServers": {"a": ${entry}}}`

jsonTester.run('mcp-timeout-min (valid)', rule, {
  valid: [
    // 1000 is the least value that Claude Code reads.
    { code: wrap('{"command": "x", "timeout": 1000}'), filename: project },
    { code: wrap('{"command": "x", "timeout": 600000}'), filename: project },
    { code: wrap('{"command": "x", "timeout": 1500.5}'), filename: project },
    { code: wrap('{"command": "x", "timeout": 1e3}'), filename: project },
    {
      code: wrap('{"type": "http", "url": "https://x.test", "timeout": 30000}'),
      filename: project,
    },
    // No `timeout`, or a value that is not a number. The docs say nothing of a string.
    { code: wrap('{"command": "x"}'), filename: project },
    { code: wrap('{"command": "x", "timeout": "60"}'), filename: project },
    { code: wrap('{"command": "x", "timeout": null}'), filename: project },
    // A `timeout` key that is not the key of the server.
    {
      code: wrap('{"command": "x", "env": {"timeout": 5}, "oauth": {"timeout": 5}}'),
      filename: project,
    },
    { code: '{"mcpServers": {}, "timeout": 5}', filename: project },
    // The last member counts, as `JSON.parse` keeps the last one.
    { code: wrap('{"command": "x", "timeout": 5, "timeout": 5000}'), filename: project },
    // A server map with no wrapper is read in a plugin file only.
    { name: 'project, no wrapper', code: '{"a": {"timeout": 60}}', filename: project },
    // Of two servers with one name, the last counts.
    {
      name: 'shadowed server',
      code: '{"mcpServers": {"a": {"timeout": 5}, "a": {"timeout": 5000}}}',
      filename: project,
    },
    // A config that is not an object, and a map that is not an object.
    { code: wrap('5'), filename: project },
    { code: '{"mcpServers": [{"timeout": 5}]}', filename: project },
    // A custom minimum: at it, silent.
    {
      code: wrap('{"command": "x", "timeout": 5000}'),
      filename: project,
      options: [{ min: 5000 }],
    },
    {
      name: 'plugin, wrapper',
      code: wrap('{"command": "x", "timeout": 5000}'),
      filename: pluginMcp,
    },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    {
      name: 'unread path',
      code: wrap('{"command": "x", "timeout": 60}'),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-timeout-min (invalid)', rule, {
  valid: [],
  invalid: [
    // Seconds written as a number. The report is on the number.
    {
      code: wrap('{"command": "x", "timeout": 60}'),
      filename: project,
      errors: [
        {
          messageId: 'tooSmall',
          data: { server: 'a', value: '60', min: '1000' },
          line: 1,
          column: 50,
          endColumn: 52,
        },
      ],
    },
    {
      code: wrap('{"command": "x", "timeout": 999}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      code: wrap('{"command": "x", "timeout": 999.5}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      code: wrap('{"command": "x", "timeout": 0}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      code: wrap('{"command": "x", "timeout": -1}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      name: 'a remote server',
      code: wrap('{"type": "http", "url": "https://x.test", "timeout": 30}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      name: 'a later timeout member sets it low',
      code: wrap('{"command": "x", "timeout": 5000, "timeout": 5}'),
      filename: project,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      name: 'two servers',
      code: '{"mcpServers": {"a": {"timeout": 1}, "b": {"timeout": 2}}}',
      filename: project,
      errors: [
        { messageId: 'tooSmall', data: { server: 'a', value: '1', min: '1000' } },
        { messageId: 'tooSmall', data: { server: 'b', value: '2', min: '1000' } },
      ],
    },
    // An explicit minimum equal to the default gives the same message as the default.
    {
      code: wrap('{"command": "x", "timeout": 60}'),
      filename: project,
      options: [{ min: 1000 }],
      errors: [{ messageId: 'tooSmall' }],
    },
    // A custom minimum: one under it.
    {
      code: wrap('{"command": "x", "timeout": 4999}'),
      filename: project,
      options: [{ min: 5000 }],
      errors: [
        { messageId: 'underConfiguredLimit', data: { server: 'a', value: '4999', min: '5000' } },
      ],
    },
    {
      name: 'plugin, wrapper',
      code: wrap('{"command": "x", "timeout": 60}'),
      filename: pluginMcp,
      errors: [{ messageId: 'tooSmall' }],
    },
    {
      name: 'plugin, no wrapper',
      code: '{"a": {"command": "x", "timeout": 60}}',
      filename: pluginMcp,
      errors: [{ messageId: 'tooSmall' }],
    },
  ],
})

// The text of each message.
jsonTester.run('mcp-timeout-min (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: wrap('{"command": "x", "timeout": 60}'),
      filename: project,
      errors: [
        {
          message:
            'The `timeout` of the server "a" is 60. The unit is milliseconds. Claude Code ignores a value below 1000, and the server falls back to `MCP_TOOL_TIMEOUT`.',
        },
      ],
    },
    {
      code: wrap('{"command": "x", "timeout": 2000}'),
      filename: project,
      options: [{ min: 5000 }],
      errors: [
        {
          message:
            'The `timeout` of the server "a" is 2000. The configured minimum is 5000 milliseconds.',
        },
      ],
    },
  ],
})

// The schema of the option `min`: an integer of 1000 or more, and no other key.
describe('mcp-timeout-min option schema', () => {
  const lint = (options: object[]) =>
    new Linter().verify(
      wrap('{"command": "x", "timeout": 60}'),
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/mcp-timeout-min': ['error', ...options] },
        },
      ],
      { filename: project },
    )

  it('accepts an empty object and each integer from 1000', () => {
    expect(lint([{}])).toHaveLength(1)
    expect(lint([{ min: 1000 }])).toHaveLength(1)
    expect(lint([{ min: 60 * 1000 }])).toHaveLength(1)
  })
  it('refuses a value below 1000, a fraction, and an unknown key', () => {
    expect(() => lint([{ min: 999 }])).toThrow()
    expect(() => lint([{ min: 0 }])).toThrow()
    expect(() => lint([{ min: 1000.5 }])).toThrow()
    expect(() => lint([{ max: 1000 }])).toThrow()
  })
})
