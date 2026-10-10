// The names are from the tools table of the tools reference. The transcript
// label "Stop Task" is the example of the permissions page, "Tool name
// wildcards".
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  OTHER_RULE_TOOL_NAMES,
  PATH_RULE_REPLACEMENT,
  PRIMARY_FIELDS,
  SPECIFIER_TOOLS,
  TOOL_NAMES,
} from '../../src/data/tool-names.ts'
import plugin from '../../src/index.ts'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-unknown-tool')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

describe('TOOL_NAMES', () => {
  // The "Tool" column of the tools table, typed from the docs. It lists 46 tools.
  const TABLE = [
    'Agent',
    'Artifact',
    'AskUserQuestion',
    'Bash',
    'CronCreate',
    'CronDelete',
    'CronList',
    'Edit',
    'EndConversation',
    'EnterPlanMode',
    'EnterWorktree',
    'ExitPlanMode',
    'ExitWorktree',
    'Glob',
    'Grep',
    'ListAgents',
    'ListMcpResourcesTool',
    'LSP',
    'Monitor',
    'NotebookEdit',
    'PowerShell',
    'PushNotification',
    'Read',
    'ReadMcpResourceTool',
    'RemoteTrigger',
    'ReportFindings',
    'ScheduleWakeup',
    'SendFeedback',
    'SendMessage',
    'SendUserFile',
    'ShareOnboardingGuide',
    'Skill',
    'SubagentHandback',
    'TaskCreate',
    'TaskGet',
    'TaskList',
    'TaskOutput',
    'TaskStop',
    'TaskUpdate',
    'TodoWrite',
    'ToolSearch',
    'WaitForMcpServers',
    'WebFetch',
    'WebSearch',
    'Workflow',
    'Write',
  ]

  it('holds the tools of the tools table, in table order', () => {
    expect(TOOL_NAMES).toEqual(TABLE)
  })

  it('names only known tools in the other lists', () => {
    const known = new Set([...TOOL_NAMES, ...OTHER_RULE_TOOL_NAMES])
    const specifier = new Set(SPECIFIER_TOOLS)
    expect(SPECIFIER_TOOLS.filter((tool) => !known.has(tool))).toEqual([])
    expect([...PRIMARY_FIELDS.keys()].filter((tool) => !specifier.has(tool))).toEqual([])
    expect([...PATH_RULE_REPLACEMENT.keys()].filter((tool) => !known.has(tool))).toEqual([])
  })

  it('keeps the other rule names apart from the table', () => {
    expect(OTHER_RULE_TOOL_NAMES.filter((tool) => TOOL_NAMES.includes(tool))).toEqual([])
  })
})

describe('options', () => {
  const lint = (options: unknown) =>
    new Linter().verify(
      settings({ allow: ['Bash'] }),
      [
        {
          files: ['**/.claude/settings.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { 'claude/permissions-unknown-tool': ['error', options] },
        },
      ],
      { filename: '.claude/settings.json' },
    )

  it('rejects a repeated name and an unknown key', () => {
    expect(() => lint({ additionalTools: ['a', 'a'] })).toThrow()
    expect(() => lint({ other: [] })).toThrow()
  })

  it('accepts an empty option object', () => {
    expect(lint({})).toEqual([])
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

// The skills page, "Pre-approve tools for a skill": `allowed-tools` is an
// allow list, and `disallowed-tools` is a deny list. Each takes a string or a
// YAML list.
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('permissions-unknown-tool in skill files', rule, {
  valid: [
    // The example of the skills page.
    skill('allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)\n'),
    skill('allowed-tools: Read, Grep\n'),
    skill('allowed-tools:\n  - Read\n  - mcp__a__b\n  - Task\n'),
    skill('disallowed-tools: AskUserQuestion\n'),
    skill('allowed-tools: Bash(\n'),
    skill('allowed-tools: 3\n'),
    skill('allowed-tools: [3, Read]\n'),
    skill('allowed-tools:\n'),
    skill('allowed-tools: Bogus\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: '.claude/skills/s/SKILL.md' },
    skill('allowed-tools: [unclosed\n'),
    // A key written as an alias is in the data and has no field: the rule reads nothing.
    skill('name: &k allowed-tools\n*k : Bogus\n'),
    { ...skill('allowed-tools: Extra\n'), options: [{ additionalTools: ['Extra'] }] },
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read Bogus\n'),
      errors: [
        { messageId: 'unknown', data: { tool: 'Bogus' }, line: 2, column: 21, endColumn: 26 },
      ],
    },
    {
      ...skill('allowed-tools: bash(git add *)\n'),
      errors: [{ messageId: 'wrongCase', data: { tool: 'bash', known: 'Bash' }, column: 16 }],
    },
    // The list form reports at the entry.
    {
      ...skill('allowed-tools:\n  - Read\n  - Grpe\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'unknown', line: 4, column: 5, endColumn: 9 }],
    },
    // A comma separates two entries, and a space inside parentheses does not.
    {
      ...skill('disallowed-tools: Bogus,Read ,  Other(a b)\n', pluginSkill()),
      errors: [
        { messageId: 'unknown', data: { tool: 'Bogus' }, column: 19 },
        { messageId: 'unknown', data: { tool: 'Other' }, column: 33 },
      ],
    },
    // The text of an escaped string does not hold the entry as written: the report covers the value.
    {
      ...skill('allowed-tools: "Bogus\\x28a)"\n'),
      errors: [{ messageId: 'unknown', data: { tool: 'Bogus' }, column: 16, endColumn: 29 }],
    },
    // A comment, a tab or a line break in the field does not move the report.
    {
      ...skill('allowed-tools:\n  - Read   # Bogus2\n  - Bogus2\n'),
      errors: [{ messageId: 'unknown', line: 4, column: 5, endColumn: 11 }],
    },
    {
      ...skill('allowed-tools: |\n  Bogus1\n  Bogus2\n'),
      errors: [
        { messageId: 'unknown', line: 3, column: 3, endColumn: 9 },
        { messageId: 'unknown', line: 4, column: 3, endColumn: 9 },
      ],
    },
    // An entry that the text does not hold sends each later entry of the item to the whole item.
    // The position of the missed entry is not known, so a later match could lie inside it.
    {
      ...skill('allowed-tools: "Bogus \\u0041B Bogus"\n'),
      errors: [
        { messageId: 'unknown', data: { tool: 'AB' }, column: 16, endColumn: 37 },
        { messageId: 'unknown', data: { tool: 'Bogus' }, column: 16, endColumn: 37 },
        { messageId: 'unknown', data: { tool: 'Bogus' }, column: 17, endColumn: 22 },
      ],
    },
    // A plain string folded over two lines does not hold the first entry as written. The second
    // entry would match inside the first, so it is reported at the whole value.
    {
      ...skill('allowed-tools: Bogus(a\n  b) Bogus\n'),
      errors: [
        { messageId: 'unknown', line: 2, column: 16, endLine: 3, endColumn: 11 },
        { messageId: 'unknown', line: 2, column: 16, endLine: 3, endColumn: 11 },
      ],
    },
    // A tab separates entries, and a trailing comment is not part of the report.
    {
      ...skill('allowed-tools: Bogus1\tBogus2 # Bogus2\n'),
      errors: [
        { messageId: 'unknown', data: { tool: 'Bogus1' }, column: 16, endColumn: 22 },
        { messageId: 'unknown', data: { tool: 'Bogus2' }, column: 23, endColumn: 29 },
      ],
    },
    {
      ...skill('allowed-tools:\n  - "Bogus\\x28a)" # Bogus\n'),
      errors: [{ messageId: 'unknown', line: 3, column: 5, endColumn: 18 }],
    },
    {
      ...skill('allowed-tools: Bogus Bogus\n'),
      errors: [
        { messageId: 'unknown', column: 16, endColumn: 21 },
        { messageId: 'unknown', column: 22, endColumn: 27 },
      ],
    },
    {
      ...skill('allowed-tools: Bad\n'),
      options: [{ additionalTools: ['Other'] }],
      errors: [{ messageId: 'unknown' }],
    },
  ],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-unknown-tool on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const allow = list('allow')
  const bad = allow('bogus')
  const good = allow('Bash')

  jsonTester.run('permissions-unknown-tool (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'unknown' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(lintJson('permissions-unknown-tool', bad, 'managed-settings.d/10-a.json')).toHaveLength(
      1,
    )
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-unknown-tool', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})
