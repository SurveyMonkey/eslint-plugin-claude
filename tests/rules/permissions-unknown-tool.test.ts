// The names are from the tools table of the tools reference. The transcript
// label "Stop Task" is the example of the permissions page, "Tool name
// wildcards".
import { describe, expect, it } from 'vitest'
import { OTHER_RULE_TOOL_NAMES, TOOL_NAMES } from '../../src/data/tool-names.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-unknown-tool')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

describe('TOOL_NAMES', () => {
  // The tools table lists 46 tools.
  it('holds the 46 documented tools, each once', () => {
    expect(TOOL_NAMES).toHaveLength(46)
    expect(new Set(TOOL_NAMES).size).toBe(46)
  })

  it('keeps the other rule names apart from the table', () => {
    expect(OTHER_RULE_TOOL_NAMES.filter((tool) => TOOL_NAMES.includes(tool))).toEqual([])
  })
})

jsonTester.run('permissions-unknown-tool', rule, {
  valid: [
    { code: settings({ allow: [...TOOL_NAMES] }), filename: '.claude/settings.json' },
    // The old name of Agent, a legacy tool, and the rule name of /cd.
    {
      code: settings({ allow: ['Task(Explore)', 'MultiEdit', 'Cd(~/code/*)'] }),
      filename: '.claude/settings.json',
    },
    {
      code: settings({ deny: ['Bash(rm *)', 'Read(./.env)'], ask: ['WebFetch'] }),
      filename: '.claude/settings.local.json',
    },
    // The docs exempt a name with `_` or `*`: each MCP name and each glob.
    {
      code: settings({ deny: ['mcp__*', 'mcp__a', 'mcp__a__b_c', '*', 'my_tool', 'B*'] }),
      filename: '.claude/settings.json',
    },
    { code: JSON.stringify({ model: 'x' }), filename: '.claude/settings.json' },
    // A rule that does not parse is for `permissions-rule-syntax`.
    {
      code: settings({ allow: ['bash(', '', 'Stop Task(x) y'] }),
      filename: '.claude/settings.json',
    },
    {
      code: settings({ allow: ['FutureTool'] }),
      filename: '.claude/settings.json',
      options: [{ additionalTools: ['FutureTool'] }],
    },
  ],
  invalid: [
    {
      code: settings({ deny: ['Stop Task'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unknown', data: { tool: 'Stop Task' }, line: 1, column: 25 }],
    },
    {
      code: settings({ allow: ['Bash', 'advisor'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unknown', data: { tool: 'advisor' } }],
    },
    {
      code: settings({ ask: ['Frobnicate(x)'] }),
      filename: '.claude/settings.local.json',
      errors: [{ messageId: 'unknown', data: { tool: 'Frobnicate' } }],
    },
    // Wrong case, with the name that the docs use.
    {
      code: settings({ allow: ['bash(npm run *)'], deny: ['read', 'WEBFETCH'] }),
      filename: '.claude/settings.json',
      errors: [
        { messageId: 'wrongCase', data: { tool: 'bash', known: 'Bash' } },
        { messageId: 'wrongCase', data: { tool: 'read', known: 'Read' } },
        { messageId: 'wrongCase', data: { tool: 'WEBFETCH', known: 'WebFetch' } },
      ],
    },
    {
      code: settings({ allow: ['futureTool'] }),
      filename: '.claude/settings.json',
      options: [{ additionalTools: ['FutureTool'] }],
      errors: [{ messageId: 'wrongCase', data: { tool: 'futureTool', known: 'FutureTool' } }],
    },
    // `additionalTools` adds names. It does not replace the list.
    {
      code: settings({ allow: ['Bogus'] }),
      filename: '.claude/settings.json',
      options: [{ additionalTools: ['FutureTool'] }],
      errors: [{ messageId: 'unknown', data: { tool: 'Bogus' } }],
    },
  ],
})
