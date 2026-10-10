// `${CLAUDE_PROJECT_DIR}` needs a default in the `command` and `args` of a project `.mcp.json`.
// A plugin config substitutes it directly. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-project-dir-default')

const project = '.mcp.json'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')
const servers = (entries: Record<string, unknown>) => JSON.stringify({ mcpServers: entries })
const bare = `\${CLAUDE_PROJECT_DIR}`

jsonTester.run('mcp-project-dir-default (valid)', rule, {
  valid: [
    {
      name: 'a default in command',
      code: servers({ a: { command: `\${CLAUDE_PROJECT_DIR:-.}/s.sh` } }),
      filename: project,
    },
    {
      name: 'a default in args',
      code: servers({ a: { command: 'node', args: [`\${CLAUDE_PROJECT_DIR:-.}/s.js`] } }),
      filename: project,
    },
    {
      name: 'an empty default',
      code: servers({ a: { command: `\${CLAUDE_PROJECT_DIR:-}/s` } }),
      filename: project,
    },
    {
      name: 'no reference',
      code: servers({ a: { command: 'node', args: ['s.js', 1, null] } }),
      filename: project,
    },
    // Only `command` and `args` are in the docs sentence.
    {
      name: 'env and url are other fields',
      code: servers({ a: { command: 'x', env: { D: bare }, url: bare } }),
      filename: project,
    },
    {
      name: 'bare shell form',
      code: servers({ a: { command: '$CLAUDE_PROJECT_DIR/s' } }),
      filename: project,
    },
    {
      name: 'another variable',
      code: servers({ a: { command: `\${CLAUDE_PROJECT_DIR_X}/s` } }),
      filename: project,
    },
    { name: 'command is no string', code: servers({ a: { command: 1 } }), filename: project },
    {
      name: 'args is no array',
      code: servers({ a: { command: 'x', args: bare } }),
      filename: project,
    },
    { name: 'entry is no object', code: servers({ a: bare }), filename: project },
    {
      name: 'duplicate server, the last has a default',
      code: `{"mcpServers": {"a": {"command": "\${CLAUDE_PROJECT_DIR}"}, "a": {"command": "\${CLAUDE_PROJECT_DIR:-.}"}}}`,
      filename: project,
    },
    {
      name: 'duplicate args, the last has a default',
      code: `{"mcpServers": {"a": {"args": ["\${CLAUDE_PROJECT_DIR}"], "args": ["\${CLAUDE_PROJECT_DIR:-.}"]}}}`,
      filename: project,
    },
    {
      name: 'plugin file is exempt',
      code: servers({ a: { command: `${bare}/s` } }),
      filename: pluginMcp,
    },
    {
      name: 'unread path',
      code: servers({ a: { command: `${bare}/s` } }),
      filename: '.claude/.mcp.json',
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-project-dir-default (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'command, on the string',
      code: servers({ a: { command: `${bare}/s.sh` } }),
      filename: project,
      errors: [
        { messageId: 'noDefault', data: { field: 'command', server: 'a' }, line: 1, column: 31 },
      ],
    },
    {
      name: 'args item',
      code: servers({ a: { command: 'node', args: ['-v', `${bare}/s.js`] } }),
      filename: project,
      errors: [{ messageId: 'noDefault', data: { field: 'args[1]', server: 'a' } }],
    },
    {
      name: 'command and two args',
      code: servers({ a: { command: bare, args: [bare, 'x', `--r=${bare}`] } }),
      filename: project,
      errors: [
        { messageId: 'noDefault', data: { field: 'command', server: 'a' } },
        { messageId: 'noDefault', data: { field: 'args[0]', server: 'a' } },
        { messageId: 'noDefault', data: { field: 'args[2]', server: 'a' } },
      ],
    },
    {
      name: 'duplicate server, the last has none',
      code: `{"mcpServers": {"a": {"command": "\${CLAUDE_PROJECT_DIR:-.}"}, "a": {"command": "\${CLAUDE_PROJECT_DIR}"}}}`,
      filename: project,
      errors: [{ messageId: 'noDefault', data: { field: 'command', server: 'a' } }],
    },
    {
      name: 'duplicate command, the last has none',
      code: `{"mcpServers": {"a": {"command": "x", "command": "\${CLAUDE_PROJECT_DIR}"}}}`,
      filename: project,
      errors: [{ messageId: 'noDefault', data: { field: 'command', server: 'a' } }],
    },
  ],
})
