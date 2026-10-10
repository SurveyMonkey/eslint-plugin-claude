// Claude Code reads `.mcp.json` at the project root, and no MCP config under `.claude/`. The
// rule reports the three paths that people try. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { pluginCommand } from '../plugin-fixture.test-support.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-json-location')

const code = '{"mcpServers": {"db": {"command": "db-mcp"}}}'
const pluginMcp = path.resolve(pluginCommand(), '..', '..', '.mcp.json')

jsonTester.run('mcp-json-location (valid)', rule, {
  valid: [
    // The places where Claude Code reads the file.
    { code, filename: '.mcp.json' },
    { code, filename: 'packages/app/.mcp.json' },
    { name: 'plugin root', code, filename: pluginMcp },
    // Near misses: a name or a directory that is almost one of the three paths.
    { code, filename: '.claude/settings.json' },
    { code, filename: '.claude/sub/mcp.json' },
    { code, filename: '.claude/config/other.json' },
    { code, filename: '.claude/config/.mcp.json' },
    { code, filename: 'claude/mcp.json' },
    { code, filename: 'config/mcp.json' },
    { code, filename: 'mcp.json' },
    { code, filename: 'docs/.claude-notes/mcp.json' },
    { code, filename: '.claude/skills/s/.mcp.json' },
    { code, filename: '.claude/plugins/p/mcp.json' },
    { code, filename: '.claude/mcp.json.bak' },
  ],
  invalid: [],
})

jsonTester.run('mcp-json-location (invalid)', rule, {
  valid: [],
  invalid: [
    // The report is at the start of the file.
    {
      code,
      filename: '.claude/.mcp.json',
      errors: [{ messageId: 'unread', line: 1, column: 1, endLine: 1, endColumn: 2 }],
    },
    { code, filename: '.claude/mcp.json', errors: [{ messageId: 'unread' }] },
    { code, filename: '.claude/config/mcp.json', errors: [{ messageId: 'unread' }] },
    // A nested directory, and a `.claude/` that holds the config of a user.
    { code, filename: 'packages/app/.claude/.mcp.json', errors: [{ messageId: 'unread' }] },
    { code, filename: 'home/.claude/config/mcp.json', errors: [{ messageId: 'unread' }] },
    { code: '{}', filename: '.claude/mcp.json', errors: [{ messageId: 'unread' }] },
  ],
})

// The text of the message.
jsonTester.run('mcp-json-location (message text)', rule, {
  valid: [],
  invalid: [
    {
      code,
      filename: '.claude/.mcp.json',
      errors: [
        {
          message:
            'Claude Code does not read an MCP config under `.claude/`. Move the servers to `.mcp.json` at the repository root.',
        },
      ],
    },
  ],
})
