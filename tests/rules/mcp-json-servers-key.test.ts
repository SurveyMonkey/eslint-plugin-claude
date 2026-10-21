// Claude Code reads the servers of a project `.mcp.json` and a `managed-mcp.json` from the
// top-level `mcpServers` object. A plugin `.mcp.json` may omit the wrapper. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { ids, lintRootListedFile, lintRootPluginFile } from '../mcp-server-rule.test-support.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-json-servers-key')

const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const project = '.mcp.json'
const server = '{"command": "npx", "args": ["-y", "pkg"]}'

jsonTester.run('mcp-json-servers-key (valid)', rule, {
  valid: [
    { code: `{"mcpServers": {"db": ${server}}}`, filename: project },
    { code: '{"mcpServers": {}}', filename: project },
    { code: `{"mcpServers": {"db": ${server}}}`, filename: 'packages/app/.mcp.json' },
    {
      code: '{"mcpServers": {"db": {"type": "http", "url": "https://x.test/mcp"}}}',
      filename: project,
    },
    // The wrapper is there, so a stray `servers` key is not this rule's concern.
    { code: `{"mcpServers": {"db": ${server}}, "servers": {}}`, filename: project },
    // The last `mcpServers` member counts, as `JSON.parse` keeps the last one.
    { code: '{"mcpServers": [], "mcpServers": {}}', filename: project },
    // A plugin file may omit the wrapper, and may keep it. The rule does not read its servers.
    { name: 'plugin, no wrapper', code: `{"db": ${server}}`, filename: pluginMcp },
    { name: 'plugin, wrapper', code: `{"mcpServers": {"db": ${server}}}`, filename: pluginMcp },
    { name: 'plugin, empty', code: '{}', filename: pluginMcp },
    { name: 'plugin, vscode key', code: '{"servers": {}}', filename: pluginMcp },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    { name: 'unread path', code: '{"servers": {}}', filename: '.claude/.mcp.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-json-servers-key (invalid)', rule, {
  valid: [],
  invalid: [
    // VS Code's key. The report is on the key.
    {
      code: `{"servers": {"db": ${server}}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers', line: 1, column: 2, endColumn: 11 }],
    },
    {
      name: 'vscode key with inputs',
      code: `{"inputs": [], "servers": {"db": ${server}}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers' }],
    },
    // The key beats a server entry at the top level.
    {
      code: `{"servers": {}, "db": ${server}}`,
      filename: project,
      errors: [{ messageId: 'vscodeServers' }],
    },
    // A server entry at the top level, found by `command`, `url` or `type`. One report for a file.
    {
      code: `{"db": ${server}}`,
      filename: project,
      errors: [{ messageId: 'unwrapped', line: 1, column: 2, endColumn: 6 }],
    },
    {
      code: '{"remote": {"url": "https://x.test/mcp"}}',
      filename: project,
      errors: [{ messageId: 'unwrapped' }],
    },
    {
      code: '{"remote": {"type": "http"}}',
      filename: project,
      errors: [{ messageId: 'unwrapped' }],
    },
    {
      name: 'two entries, one report, on the first',
      code: `{"note": 1, "a": ${server}, "b": ${server}}`,
      filename: project,
      errors: [{ messageId: 'unwrapped', line: 1, column: 13 }],
    },
    {
      name: 'a server entry that a later member replaces is not an entry',
      code: '{"db": {"command": "x"}, "db": 1}',
      filename: project,
      errors: [{ messageId: 'missing' }],
    },
    // Nothing that looks like a server.
    { code: '{}', filename: project, errors: [{ messageId: 'missing', line: 1, column: 1 }] },
    {
      code: '{"other": 1}',
      filename: project,
      errors: [{ messageId: 'missing', line: 1, column: 1 }],
    },
    { code: '{"a": {"b": 1}}', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '{"a": "command"}', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '[]', filename: project, errors: [{ messageId: 'missing' }] },
    { code: '"x"', filename: project, errors: [{ messageId: 'missing' }] },
    // The wrapper is not an object. The report is on its value.
    {
      code: '{"mcpServers": []}',
      filename: project,
      errors: [{ messageId: 'notObject', line: 1, column: 16, endColumn: 18 }],
    },
    { code: '{"mcpServers": null}', filename: project, errors: [{ messageId: 'notObject' }] },
    { code: '{"mcpServers": "db"}', filename: project, errors: [{ messageId: 'notObject' }] },
    {
      code: '{"mcpServers": {}, "mcpServers": 1}',
      filename: project,
      errors: [{ messageId: 'notObject' }],
    },
  ],
})

// The text of each message.
jsonTester.run('mcp-json-servers-key (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: '{"servers": {}}',
      filename: project,
      errors: [
        {
          message:
            'The key `servers` is the form of VS Code. Claude Code reads the servers from the top-level `mcpServers` object.',
        },
      ],
    },
    {
      code: `{"db": ${server}}`,
      filename: project,
      errors: [
        {
          message:
            'This server entry is at the top level. Claude Code reads the servers from the top-level `mcpServers` object. Move the entry into it.',
        },
      ],
    },
    {
      code: '{}',
      filename: project,
      errors: [
        {
          message:
            'This file has no top-level `mcpServers` object, so Claude Code loads no server from it.',
        },
      ],
    },
    {
      code: '{"mcpServers": []}',
      filename: project,
      errors: [
        { message: 'The `mcpServers` key must be an object that maps server names to configs.' },
      ],
    },
  ],
})

// The root file of a repository that is a plugin is the project file too, so it needs the wrapper.
it('reports a root file of a plugin repository with no wrapper', () => {
  const code = `{"db": ${server}}`
  expect(ids(lintRootPluginFile('mcp-json-servers-key', code))).toEqual(['unwrapped'])
  expect(ids(lintRootListedFile('mcp-json-servers-key', code))).toEqual(['unwrapped'])
})
it('stays silent for a root file of a plugin repository with the wrapper', () => {
  const code = `{"mcpServers": {"db": ${server}}}`
  expect(ids(lintRootPluginFile('mcp-json-servers-key', code))).toEqual([])
})

// A `managed-mcp.json` uses the format of a project `.mcp.json`, so it needs the wrapper too.
const managed = 'managed-mcp.json'
const github = '{"type": "http", "url": "https://api.githubcopilot.com/mcp/"}'

jsonTester.run('mcp-json-servers-key (managed-mcp.json)', rule, {
  valid: [
    { name: 'managed, wrapper', code: `{"mcpServers": {"github": ${github}}}`, filename: managed },
    // The docs turn MCP off with an empty server map.
    { name: 'managed, empty map', code: '{"mcpServers": {}}', filename: managed },
    {
      name: 'managed, in a subdirectory',
      code: `{"mcpServers": {"github": ${github}}}`,
      filename: 'deploy/macos/managed-mcp.json',
    },
  ],
  invalid: [
    {
      name: 'managed, no wrapper',
      code: `{"github": ${github}}`,
      filename: managed,
      errors: [{ messageId: 'unwrapped', line: 1, column: 2, endColumn: 10 }],
    },
    {
      name: 'managed, vscode key',
      code: `{"servers": {"github": ${github}}}`,
      filename: managed,
      errors: [{ messageId: 'vscodeServers' }],
    },
    { name: 'managed, empty', code: '{}', filename: managed, errors: [{ messageId: 'missing' }] },
    {
      name: 'managed, wrapper not an object',
      code: '{"mcpServers": []}',
      filename: managed,
      errors: [{ messageId: 'notObject' }],
    },
  ],
})

it('reports a managed-mcp.json with no wrapper at a plugin root', () => {
  // A plugin has no `managed-mcp.json` component, so the plugin skip does not cover the file.
  const root = repo({ '.claude-plugin/plugin.json': '{}' })
  const code = `{"github": ${github}}`
  expect(ids(lintJson('mcp-json-servers-key', code, path.join(root, managed)))).toEqual([
    'unwrapped',
  ])
  const plugin = repo({ 'p/.claude-plugin/plugin.json': '{}' })
  expect(ids(lintJson('mcp-json-servers-key', code, path.join(plugin, 'p', managed)))).toEqual([
    'unwrapped',
  ])
  // The control: a plugin `.mcp.json` in the same directory may omit the wrapper.
  expect(ids(lintJson('mcp-json-servers-key', code, path.join(plugin, 'p', '.mcp.json')))).toEqual(
    [],
  )
})
