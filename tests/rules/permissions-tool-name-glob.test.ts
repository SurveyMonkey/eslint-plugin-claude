// The permissions page, "Tool name wildcards": a deny or ask rule takes a
// glob anywhere in the name. An allow rule takes one only after a literal
// `mcp__<server>__` prefix.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-tool-name-glob')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-tool-name-glob', rule, {
  valid: [
    // The two allow examples of the docs.
    {
      code: settings({ allow: ['mcp__puppeteer__*', 'mcp__github__get_*'] }),
      filename: '.claude/settings.json',
    },
    // Without a glob.
    {
      code: settings({ allow: ['mcp__puppeteer', 'mcp__a__b', 'Bash(git *)', 'Read(**/*.ts)'] }),
      filename: '.claude/settings.json',
    },
    // The docs give a deny or ask rule a glob anywhere in the name.
    {
      code: settings({ deny: ['*', 'mcp__*', 'B*'], ask: ['mcp__*__delete', 'mcp__a*'] }),
      filename: '.claude/settings.local.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: settings({ allow: ['*(', '(*)'] }), filename: '.claude/settings.json' },
    { code: JSON.stringify({ deny: ['*'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    // `mcp__` inside a name does not make it an MCP name.
    {
      code: settings({ allow: ['Xmcp__a__*'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unanchored' }],
    },
    // The three examples of the docs.
    {
      code: settings({ allow: ['*', 'B*', 'mcp__*'] }),
      filename: '.claude/settings.json',
      errors: [
        { messageId: 'unanchored', line: 1, column: 26 },
        { messageId: 'unanchored' },
        { messageId: 'unanchored' },
      ],
    },
    // A glob in the server segment.
    {
      code: settings({ allow: ['mcp__*__get', 'mcp__git*__get', 'mcp__git*', 'mcp____*'] }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'unanchored' },
        { messageId: 'unanchored' },
        { messageId: 'unanchored' },
        { messageId: 'unanchored' },
      ],
    },
    // A glob in the name of another tool, with or without a specifier.
    {
      code: settings({ allow: ['Ba*', 'Re*(./src/**)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unanchored' }, { messageId: 'unanchored' }],
    },
  ],
})
