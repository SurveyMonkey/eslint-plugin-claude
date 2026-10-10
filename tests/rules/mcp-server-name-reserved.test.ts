// Claude Code reserves the names of its built-in servers and skips a configured server with
// one of them. The names are case-sensitive, and two of them hold a space. The files glob is
// in tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-server-name-reserved')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const entry = '{"command": "npx"}'
const servers = (names: string[]) =>
  `{"mcpServers": {${names.map((n) => `"${n}": ${entry}`).join(', ')}}}`

jsonTester.run('mcp-server-name-reserved (valid)', rule, {
  valid: [
    { code: servers(['github', 'db', 'my-workspace']), filename: project },
    { code: '{"mcpServers": {}}', filename: project },
    // The match is exact: another case, a hyphen for the space, a prefix.
    { code: servers(['Workspace', 'WORKSPACE', 'Claude-In-Chrome']), filename: project },
    { code: servers(['claude-preview', 'Claude  Preview', 'claude browser']), filename: project },
    { code: servers(['workspace-2', 'computer_use', 'Claude Browser 2']), filename: project },
    // A reserved word as a key inside a server is not a server name.
    {
      code: '{"mcpServers": {"db": {"command": "x", "env": {"workspace": "1"}, "workspace": 1}}}',
      filename: project,
    },
    // A reserved word beside the wrapper is not a server in a project file.
    { code: `{"workspace": ${entry}}`, filename: project },
    // A map that is not an object has no names.
    { code: '{"mcpServers": ["workspace"]}', filename: project },
    { code: '["workspace"]', filename: project },
    { name: 'plugin, wrapper', code: servers(['github']), filename: pluginMcp },
    { name: 'plugin, no wrapper', code: `{"github": ${entry}}`, filename: pluginMcp },
    { name: 'plugin, wrapper is no object', code: '{"mcpServers": 1}', filename: pluginMcp },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    { name: 'unread path', code: servers(['workspace']), filename: '.claude/.mcp.json' },
    // A name of the option, when the option is not set.
    { code: servers(['internal']), filename: project },
    { code: servers(['internal']), filename: project, options: [{ names: ['other'] }] },
  ],
  invalid: [],
})

jsonTester.run('mcp-server-name-reserved (invalid)', rule, {
  valid: [],
  invalid: [
    // The report is on the name.
    {
      code: servers(['workspace']),
      filename: project,
      errors: [
        {
          messageId: 'reserved',
          data: { server: 'workspace' },
          line: 1,
          column: 17,
          endColumn: 28,
        },
      ],
    },
    ...['claude-in-chrome', 'computer-use', 'Claude Preview', 'Claude Browser'].map((server) => ({
      name: server,
      code: servers([server]),
      filename: project,
      errors: [{ messageId: 'reserved' as const, data: { server } }],
    })),
    {
      name: 'reserved names beside a good one',
      code: servers(['db', 'workspace', 'computer-use']),
      filename: project,
      errors: [
        { messageId: 'reserved', data: { server: 'workspace' } },
        { messageId: 'reserved', data: { server: 'computer-use' } },
      ],
    },
    {
      name: 'a name that two members repeat',
      code: servers(['workspace', 'workspace']),
      filename: project,
      errors: [{ messageId: 'reserved' }, { messageId: 'reserved' }],
    },
    {
      name: 'plugin, wrapper',
      code: servers(['workspace']),
      filename: pluginMcp,
      errors: [{ messageId: 'reserved' }],
    },
    {
      name: 'plugin, no wrapper',
      code: `{"workspace": ${entry}}`,
      filename: pluginMcp,
      errors: [{ messageId: 'reserved', data: { server: 'workspace' } }],
    },
    // The option adds names. The built-in names stay in the list.
    {
      code: servers(['internal', 'github']),
      filename: project,
      options: [{ names: ['internal'] }],
      errors: [{ messageId: 'reserved', data: { server: 'internal' } }],
    },
    {
      code: servers(['workspace']),
      filename: project,
      options: [{ names: ['internal'] }],
      errors: [{ messageId: 'reserved' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-server-name-reserved (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: servers(['Claude Preview']),
      filename: project,
      errors: [
        {
          message:
            'The name "Claude Preview" is reserved. Claude Code skips this server at load time. Rename it.',
        },
      ],
    },
  ],
})

// The schema of the option `names`: a list of non-empty strings, and no other key.
describe('mcp-server-name-reserved option schema', () => {
  const lint = (options: object[]) =>
    new Linter().verify(
      servers(['internal']),
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/mcp-server-name-reserved': ['error', ...options] },
        },
      ],
      { filename: project },
    )

  it('accepts an empty object, an empty list and a list of names', () => {
    expect(lint([{}])).toEqual([])
    expect(lint([{ names: [] }])).toEqual([])
    expect(lint([{ names: ['internal'] }])).toHaveLength(1)
  })
  it('refuses an empty name, a name that is not a string, a string, and an unknown key', () => {
    expect(() => lint([{ names: [''] }])).toThrow()
    expect(() => lint([{ names: [1] }])).toThrow()
    expect(() => lint([{ names: 'internal' }])).toThrow()
    expect(() => lint([{ name: ['internal'] }])).toThrow()
  })
})
