// The skills page, "Pre-approve tools for a skill": a project skill grants its
// `allowed-tools` with no workspace trust, even in a `-p` run. The permissions
// page says that `Bash(*)` is the same as `Bash`, and a bare `PowerShell` or
// `PowerShell(*)` matches every command. It also says that `mcp__<server>` and
// `mcp__<server>__*` match every tool of the server.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('skill-allowed-tools-broad', ruleOf('skill-allowed-tools-broad'), {
  valid: [
    // The example of the skills page.
    file('allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)\n'),
    file('allowed-tools: Read Grep Glob WebSearch\n'),
    file('allowed-tools: Write(docs/**) Edit(src/**) WebFetch(domain:example.com)\n'),
    file('allowed-tools: mcp__puppeteer__puppeteer_navigate mcp__puppeteer__navigate_*\n'),
    // The permissions page: `mcp__github__get_*` matches the `get_` tools only. Claude Code skips
    // `mcp__*` in an allow rule, and `permissions-tool-name-glob` reports it.
    file('allowed-tools: mcp__github__get_* mcp__*\n'),
    // An empty server name is no server.
    file('allowed-tools: mcp__ mcp____*\n'),
    // A rule with parentheses on an MCP name is for `permissions-mcp-rule-parens`.
    file('allowed-tools: mcp__github__*(x)\n'),
    // The docs state the bare form for these tools and the `(*)` form for Bash and PowerShell only.
    file('allowed-tools: Write(*) Edit(*) WebFetch(*)\n'),
    // The deny list removes tools.
    file('disallowed-tools: Bash Write mcp__*\n'),
    // A rule that does not parse is for `permissions-rule-syntax`.
    file('allowed-tools: Bash(\n'),
    file('allowed-tools: 3\n'),
    file('allowed-tools: Bash\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: skill },
    file('allowed-tools: [unclosed\n'),
    // The option `allow` names the rules that the team accepts.
    { ...file('allowed-tools: Bash\n'), options: [{ allow: ['Bash'] }] },
    { ...file('allowed-tools: mcp__github__*\n'), options: [{ allow: ['mcp__github__*'] }] },
  ],
  invalid: [
    {
      ...file('allowed-tools: Read Bash\n'),
      errors: [{ messageId: 'broad', data: { rule: 'Bash' }, line: 2, column: 21, endColumn: 25 }],
    },
    // Each form of the docs.
    {
      ...file('allowed-tools: Bash(*) PowerShell PowerShell(*) Write Edit WebFetch\n'),
      errors: [
        { messageId: 'broad', data: { rule: 'Bash(*)' } },
        { messageId: 'broad', data: { rule: 'PowerShell' } },
        { messageId: 'broad', data: { rule: 'PowerShell(*)' } },
        { messageId: 'broad', data: { rule: 'Write' } },
        { messageId: 'broad', data: { rule: 'Edit' } },
        { messageId: 'broad', data: { rule: 'WebFetch' } },
      ],
    },
    // The permissions page: `mcp__puppeteer` and `mcp__puppeteer__*` each match every tool of the server.
    {
      ...file('allowed-tools: mcp__github__* mcp__puppeteer\n'),
      errors: [
        { messageId: 'broad', data: { rule: 'mcp__github__*' } },
        { messageId: 'broad', data: { rule: 'mcp__puppeteer' } },
      ],
    },
    // A server name can hold `_` and `-`. Claude.ai connectors are `mcp__claude_ai_<server>`.
    {
      ...file('allowed-tools: mcp__my_server mcp__my-server__* mcp__claude_ai_Slack__*\n'),
      errors: [
        { messageId: 'broad', data: { rule: 'mcp__my_server' } },
        { messageId: 'broad', data: { rule: 'mcp__my-server__*' } },
        { messageId: 'broad', data: { rule: 'mcp__claude_ai_Slack__*' } },
      ],
    },
    // A missed entry sends each later entry to the whole value, so the report is never inside it.
    {
      ...file('allowed-tools: Bash(git\n  add *) Bash\n'),
      errors: [{ messageId: 'broad', line: 2, column: 16, endLine: 3, endColumn: 14 }],
    },
    {
      ...file('allowed-tools:\n  - Bash\n  - Read\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'broad', line: 3 }],
    },
    { ...file('allowed-tools: [Write]\n', pluginSkill()), errors: [{ messageId: 'broad' }] },
    // The option names exact rules.
    {
      ...file('allowed-tools: Bash Write\n'),
      options: [{ allow: ['Bash', 'Edit'] }],
      errors: [{ messageId: 'broad', data: { rule: 'Write' } }],
    },
    {
      ...file('allowed-tools: Bash(*)\n'),
      options: [{ allow: ['Bash'] }],
      errors: [{ messageId: 'broad', data: { rule: 'Bash(*)' } }],
    },
  ],
})
