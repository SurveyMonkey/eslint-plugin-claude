// Claude Code shows a remote server with an empty `url` as `not configured`, and never
// connects it. A plugin may ship such an entry as a placeholder. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { ids, lintRootListedFile, lintRootPluginFile } from '../mcp-server-rule.test-support.ts'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-remote-url-empty')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const wrap = (entry: string) => `{"mcpServers": {"a": ${entry}}}`

jsonTester.run('mcp-remote-url-empty (valid)', rule, {
  valid: [
    { code: wrap('{"type": "http", "url": "https://x.test/mcp"}'), filename: project },
    { code: wrap('{"type": "sse", "url": "https://x.test/sse"}'), filename: project },
    { code: wrap('{"type": "ws", "url": "wss://x.test/ws"}'), filename: project },
    { code: '{"mcpServers": {}}', filename: project },
    { name: 'project, no wrapper', code: '{"a": {"type": "http", "url": ""}}', filename: project },
    // A stdio server does not use `url`, and an entry with no `type` is not a remote one.
    { code: wrap('{"type": "stdio", "command": "x", "url": ""}'), filename: project },
    { code: wrap('{"command": "x", "url": ""}'), filename: project },
    { code: wrap('{"url": ""}'), filename: project },
    // The type is not a string, or is not a remote type.
    { code: wrap('{"type": 1, "url": ""}'), filename: project },
    { code: wrap('{"type": "sdk", "url": ""}'), filename: project },
    { code: wrap('{"type": "HTTP", "url": ""}'), filename: project },
    // The `url` is absent, is not a string, or is not empty. Whitespace is for
    // `mcp-hidden-whitespace`.
    { code: wrap('{"type": "http"}'), filename: project },
    { code: wrap('{"type": "http", "url": null}'), filename: project },
    { code: wrap('{"type": "http", "url": 0}'), filename: project },
    { code: wrap('{"type": "http", "url": " "}'), filename: project },
    // The last member counts, as `JSON.parse` keeps the last one.
    { code: wrap('{"type": "http", "url": "", "url": "https://x.test"}'), filename: project },
    { code: wrap('{"type": "stdio", "type": "http", "url": "https://x.test"}'), filename: project },
    // A config that is not an object, and a map that is not an object.
    { code: wrap('"http"'), filename: project },
    { code: '{"mcpServers": []}', filename: project },
    // A placeholder in a plugin file is allowed, with the wrapper and without it.
    { name: 'plugin, wrapper', code: wrap('{"type": "http", "url": ""}'), filename: pluginMcp },
    { name: 'plugin, no wrapper', code: '{"a": {"type": "http", "url": ""}}', filename: pluginMcp },
    // Claude Code reads no file under `.claude/`. `mcp-json-location` reports it.
    {
      name: 'unread path',
      code: wrap('{"type": "http", "url": ""}'),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-remote-url-empty (invalid)', rule, {
  valid: [],
  invalid: [
    // The report is on the empty string.
    {
      code: wrap('{"type": "http", "url": ""}'),
      filename: project,
      errors: [{ messageId: 'empty', data: { server: 'a' }, line: 1, column: 46, endColumn: 48 }],
    },
    ...['sse', 'ws', 'streamable-http'].map((type) => ({
      name: type,
      code: wrap(`{"type": "${type}", "url": ""}`),
      filename: project,
      errors: [{ messageId: 'empty' as const }],
    })),
    {
      name: 'the url comes before the type',
      code: wrap('{"url": "", "type": "http"}'),
      filename: project,
      errors: [{ messageId: 'empty' }],
    },
    {
      name: 'a later url member sets it empty',
      code: wrap('{"type": "http", "url": "https://x.test", "url": ""}'),
      filename: project,
      errors: [{ messageId: 'empty' }],
    },
    {
      name: 'two servers',
      code: '{"mcpServers": {"a": {"type": "http", "url": ""}, "b": {"type": "sse", "url": ""}}}',
      filename: project,
      errors: [
        { messageId: 'empty', data: { server: 'a' } },
        { messageId: 'empty', data: { server: 'b' } },
      ],
    },
    {
      name: 'nested project file',
      code: wrap('{"type": "http", "url": ""}'),
      filename: 'packages/app/.mcp.json',
      errors: [{ messageId: 'empty' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-remote-url-empty (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: wrap('{"type": "http", "url": ""}'),
      filename: project,
      errors: [
        {
          message:
            'The remote server "a" has an empty `url`. Claude Code shows it as `not configured` and never connects it.',
        },
      ],
    },
  ],
})

// The root file of a repository that is a plugin is a plugin file too, so it can hold a placeholder.
it('stays silent in the root file of a plugin repository', () => {
  const code = wrap('{"type": "http", "url": ""}')
  expect(ids(lintRootPluginFile('mcp-remote-url-empty', code))).toEqual([])
  expect(ids(lintRootListedFile('mcp-remote-url-empty', code))).toEqual([])
})

// A `managed-mcp.json` uses the format of a project `.mcp.json`. A plugin has no such component,
// so no placeholder is there.
const managed = 'managed-mcp.json'

jsonTester.run('mcp-remote-url-empty (managed-mcp.json)', rule, {
  valid: [
    {
      name: 'managed, a url',
      code: wrap('{"type": "http", "url": "https://mcp.example.com/mcp"}'),
      filename: managed,
    },
    // `mcp-json-servers-key` reports a managed file with no wrapper.
    { name: 'managed, no wrapper', code: '{"a": {"type": "http", "url": ""}}', filename: managed },
  ],
  invalid: [
    {
      name: 'managed, an empty url',
      code: wrap('{"type": "http", "url": ""}'),
      filename: managed,
      errors: [{ messageId: 'empty', data: { server: 'a' }, line: 1, column: 46, endColumn: 48 }],
    },
  ],
})

it('reports an empty url in a managed-mcp.json at a plugin root', () => {
  const code = wrap('{"type": "http", "url": ""}')
  const root = repo({ '.claude-plugin/plugin.json': '{}' })
  expect(ids(lintJson('mcp-remote-url-empty', code, path.join(root, managed)))).toEqual(['empty'])
  // The control: the `.mcp.json` in the same directory is a `both` file, which can hold one.
  expect(ids(lintJson('mcp-remote-url-empty', code, path.join(root, '.mcp.json')))).toEqual([])
})
