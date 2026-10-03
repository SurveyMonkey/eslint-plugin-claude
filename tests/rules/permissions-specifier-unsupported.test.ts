// The tools reference, "Configure tools with permission rules and hooks": a
// tool that the rule format table does not list takes the bare name only.
// `WebSearch` is in the table, and its row says "No specifier".
import { describe, expect, it } from 'vitest'
import { SPECIFIER_TOOLS, TOOL_NAMES } from '../../src/data/tool-names.ts'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-specifier-unsupported')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

describe('SPECIFIER_TOOLS', () => {
  it('holds each tool of the "Applies to" column, and Cd and Task', () => {
    expect([...SPECIFIER_TOOLS].sort()).toEqual(
      [
        'Agent',
        'Bash',
        'Cd',
        'Edit',
        'Glob',
        'Grep',
        'LSP',
        'Monitor',
        'NotebookEdit',
        'PowerShell',
        'Read',
        'Skill',
        'Task',
        'WebFetch',
        'Write',
      ].sort(),
    )
    expect(TOOL_NAMES).toContain('WebSearch')
  })
})

jsonTester.run('permissions-specifier-unsupported', rule, {
  valid: [
    // The forms of the table.
    {
      code: settings({
        allow: [
          'Bash(npm run *)',
          'Monitor(tail *)',
          'PowerShell(Get-ChildItem *)',
          'Read(~/secrets/**)',
          'Edit(/src/**)',
          'Skill(deploy *)',
          'Agent(Explore)',
          'WebFetch(domain:example.com)',
          'Cd(~/code/**)',
          'Task(Explore)',
        ],
      }),
      filename: '.claude/settings.json',
    },
    // The bare names.
    {
      code: settings({
        allow: ['WebSearch', 'ExitPlanMode', 'ShareOnboardingGuide'],
        deny: ['ToolSearch'],
      }),
      filename: '.claude/settings.json',
    },
    // A deny or ask rule can match a parameter of any built-in tool.
    {
      code: settings({
        deny: ['WebSearch(query:foo)', 'SendMessage(to: bob)', 'Agent(model:opus)'],
      }),
      filename: '.claude/settings.json',
    },
    { code: settings({ ask: ['ListAgents(x:1)'] }), filename: '.claude/settings.local.json' },
    // A path rule for a file tool is for `permissions-path-rule-tool`.
    {
      code: settings({ allow: ['Write(docs/**)', 'MultiEdit(a)'] }),
      filename: '.claude/settings.json',
    },
    // The docs do not say what an MCP or unknown tool takes.
    {
      code: settings({ allow: ['mcp__a__b(x)', 'Bogus(x)', 'bash(x)', '*(x)'] }),
      filename: '.claude/settings.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    {
      code: settings({ allow: ['WebSearch(', 'WebSearch(x) y'] }),
      filename: '.claude/settings.json',
    },
    { code: JSON.stringify({ allow: ['WebSearch(x)'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ allow: ['WebSearch(rust)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unsupported', data: { tool: 'WebSearch' }, line: 1, column: 26 }],
    },
    {
      code: settings({ deny: ['SendMessage(bob)', 'ListAgents(*)'], ask: ['ExitPlanMode(x)'] }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'unsupported', data: { tool: 'SendMessage' } },
        { messageId: 'unsupported', data: { tool: 'ListAgents' } },
        { messageId: 'unsupported', data: { tool: 'ExitPlanMode' } },
      ],
    },
    // An allow rule has no parameter form. The deny form is `param:value`.
    {
      code: settings({ allow: ['ToolSearch(query:foo)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unsupported', data: { tool: 'ToolSearch' } }],
    },
    // An empty specifier is still a specifier.
    {
      code: settings({ allow: ['WebSearch()'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unsupported' }],
    },
    // A deny specifier without a parameter name.
    {
      code: settings({ deny: ['WebSearch(a.b:c)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unsupported' }],
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

markdownTester.run('permissions-specifier-unsupported in skill files', rule, {
  valid: [
    skill('allowed-tools: Bash(git add *) Read(docs/**) WebSearch ExitPlanMode\n'),
    skill('disallowed-tools: WebSearch(query:x)\n'),
    skill('allowed-tools: WebSearch(x\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read WebSearch(x)\n'),
      errors: [
        {
          messageId: 'unsupported',
          data: { tool: 'WebSearch' },
          line: 2,
          column: 21,
          endColumn: 33,
        },
      ],
    },
    {
      ...skill('disallowed-tools:\n  - ToolSearch(x)\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'unsupported', line: 3 }],
    },
    {
      ...skill('allowed-tools: [SendMessage(x)]\n', pluginSkill()),
      errors: [{ messageId: 'unsupported' }],
    },
  ],
})
