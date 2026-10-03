// The permissions page, "Match by input parameter": Claude Code skips each
// `mcp__` rule that has parentheses when it loads a settings file.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-mcp-rule-parens')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-mcp-rule-parens', rule, {
  valid: [
    // The three forms of the "MCP" section.
    {
      code: settings({
        allow: ['mcp__puppeteer', 'mcp__puppeteer__*', 'mcp__puppeteer__puppeteer_navigate'],
      }),
      filename: '.claude/settings.json',
    },
    // A rule for a tool that is not an MCP tool.
    {
      code: settings({ deny: ['Agent(model:opus)', 'mcp_a(x)', 'Mcp__a(x)', 'Xmcp__a(x)'] }),
      filename: '.claude/settings.local.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: settings({ allow: ['mcp__a(', 'mcp__a(x) y'] }), filename: '.claude/settings.json' },
    { code: JSON.stringify({ deny: ['mcp__a(x)'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ deny: ['mcp__github__create_issue(title:x)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'parens', line: 1, column: 25 }],
    },
    {
      code: settings({ allow: ['mcp__a(x)'], ask: ['mcp__a__b()'], deny: ['mcp__*(x)'] }),
      filename: '.claude/settings.local.json',
      errors: [{ messageId: 'parens' }, { messageId: 'parens' }, { messageId: 'parens' }],
    },
  ],
})

// The skills page, "Pre-approve tools for a skill": `allowed-tools` is an
// allow list, and `disallowed-tools` is a deny list. Each takes a string or a
// YAML list.
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('permissions-mcp-rule-parens in skill files', rule, {
  valid: [
    skill('allowed-tools: mcp__a mcp__a__* mcp__a__b\n'),
    skill('disallowed-tools: Agent(model:opus) Xmcp__a(x)\n'),
    skill('allowed-tools: mcp__a(\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read mcp__a(x)\n'),
      errors: [{ messageId: 'parens', line: 2, column: 21, endColumn: 30 }],
    },
    {
      ...skill('disallowed-tools:\n  - mcp__a__b(x)\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'parens', line: 3 }],
    },
    {
      ...skill('allowed-tools: [mcp__a(x), mcp__b(y)]\n', pluginSkill()),
      errors: [{ messageId: 'parens' }, { messageId: 'parens' }],
    },
  ],
})
