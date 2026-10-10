// An MCP tool reference is `mcp__<server>` or `mcp__<server>__<tool>`. The permissions page lists
// the forms in "MCP". The hooks page lists the tool names in "Match MCP tools". The rule reports a
// name that starts with `mcp` and has another form, and that `permissions-unknown-tool` and
// `permissions-tool-name-glob` do not report. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-tool-name-format')

const project = '.claude/settings.json'
const settings = (permissions: unknown) => JSON.stringify({ permissions })
const allow = (...rules: string[]) => settings({ allow: rules })

jsonTester.run('mcp-tool-name-format (valid)', rule, {
  valid: [
    // The three forms of the "MCP" section, and the scoped names of the other sections.
    {
      name: 'the documented forms',
      code: allow(
        'mcp__puppeteer',
        'mcp__puppeteer__*',
        'mcp__puppeteer__puppeteer_navigate',
        'mcp__plugin_my-plugin_db__query',
        'mcp__claude_ai_Slack__post',
        'mcp__workspace__bash',
      ),
      filename: project,
    },
    { name: 'a form with a specifier', code: allow('mcp__a__b(x)'), filename: project },
    // A name that does not start with `mcp`. The case matters.
    {
      name: 'other tools',
      code: allow('Bash', 'Read(./x)', 'ListMcpResourcesTool', 'ReadMcpResourceTool', 'MCP__a'),
      filename: project,
    },
    { name: 'a name that holds mcp', code: allow('xmcp_a', 'Xmcp__a'), filename: project },
    // `permissions-unknown-tool` reports a name with no `_` and no `*`.
    {
      name: 'no underscore, owned by permissions-unknown-tool',
      code: allow('mcp', 'mcp-server', 'mcpserver', 'mcp-a-b'),
      filename: project,
    },
    // `permissions-tool-name-glob` owns a glob.
    {
      name: 'a glob',
      code: allow('mcp*', 'mcp_*', 'mcp_a_*', '*mcp_a', 'mcp____*', 'mcp____x*'),
      filename: project,
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { name: 'a rule that does not parse', code: allow('mcp_a(', 'mcp_a(x) y'), filename: project },
    { name: 'not a list', code: settings({ allow: 'mcp_a' }), filename: project },
    { name: 'a non-string entry', code: allow(1 as unknown as string), filename: project },
    { name: 'no permissions', code: JSON.stringify({ model: 'x' }), filename: project },
    {
      name: 'a key outside permissions',
      code: JSON.stringify({ allow: ['mcp_a'] }),
      filename: project,
    },
    // Claude Code ignores a hidden drop-in.
    { name: 'hidden drop-in', code: allow('mcp_a'), filename: 'managed-settings.d/.10.json' },
  ],
  invalid: [],
})

jsonTester.run('mcp-tool-name-format (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'one underscore, with the position of the entry',
      code: allow('mcp_server_tool'),
      filename: project,
      errors: [
        {
          messageId: 'format',
          data: { tool: 'mcp_server_tool' },
          line: 1,
          column: 26,
          endColumn: 43,
        },
      ],
    },
    {
      name: 'a bare prefix with one underscore',
      code: allow('mcp_'),
      filename: project,
      errors: [{ messageId: 'format', data: { tool: 'mcp_' } }],
    },
    {
      name: 'a prefix with no server',
      code: allow('mcp__'),
      filename: project,
      errors: [{ messageId: 'format', data: { tool: 'mcp__' } }],
    },
    {
      name: 'an empty server before the tool',
      code: allow('mcp____tool'),
      filename: project,
      errors: [{ messageId: 'format', data: { tool: 'mcp____tool' } }],
    },
    {
      name: 'a first part that is not mcp, with an underscore later',
      code: allow('mcp-server_tool', 'mcpserver_tool'),
      filename: project,
      errors: [
        { messageId: 'format', data: { tool: 'mcp-server_tool' } },
        { messageId: 'format', data: { tool: 'mcpserver_tool' } },
      ],
    },
    {
      name: 'a specifier is not part of the tool name',
      code: allow('mcp_a__b(x)'),
      filename: project,
      errors: [{ messageId: 'format', data: { tool: 'mcp_a__b' } }],
    },
    {
      name: 'allow, ask and deny, in the local file',
      code: settings({ allow: ['mcp_a'], ask: ['mcp_b'], deny: ['mcp_c'] }),
      filename: '.claude/settings.local.json',
      errors: [{ messageId: 'format' }, { messageId: 'format' }, { messageId: 'format' }],
    },
    {
      name: 'two bad entries in one list',
      code: allow('mcp__a', 'mcp_b', 'mcp__c', 'mcp__'),
      filename: project,
      errors: [
        { messageId: 'format', data: { tool: 'mcp_b' } },
        { messageId: 'format', data: { tool: 'mcp__' } },
      ],
    },
  ],
})

// The managed settings files: the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in.
describe('mcp-tool-name-format on managed settings files', () => {
  const bad = settings({ deny: ['mcp_a'] })
  const good = settings({ deny: ['mcp__a'] })
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']

  jsonTester.run('mcp-tool-name-format (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'format' as const }],
    })),
  })

  it('is silent in a hidden drop-in', () => {
    expect(lintJson('mcp-tool-name-format', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})

// The skills page, "Pre-approve tools for a skill": `allowed-tools` is an allow list and
// `disallowed-tools` is a deny list. Each takes a string or a YAML list.
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('mcp-tool-name-format in skill files', rule, {
  valid: [
    skill('allowed-tools: mcp__s__t, Read\n'),
    skill('allowed-tools:\n  - mcp__s__*\n'),
    skill('allowed-tools: mcp-server\n'),
    skill('allowed-tools: mcp_s_t\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: '.claude/skills/s/SKILL.md' },
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read mcp_s_t\n'),
      errors: [{ messageId: 'format', data: { tool: 'mcp_s_t' } }],
    },
    {
      ...skill('disallowed-tools:\n  - mcp_s_t\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'format' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-tool-name-format (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: allow('mcp_server_tool'),
      filename: project,
      errors: [
        {
          message:
            'The tool name "mcp_server_tool" is not an MCP tool form. Use "mcp__<server>" or "mcp__<server>__<tool>".',
        },
      ],
    },
  ],
})
