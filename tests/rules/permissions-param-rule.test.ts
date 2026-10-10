// The permissions page, "Match by input parameter": a `Tool(param:value)`
// rule cannot match the primary field of the tool.
import { describe, expect, it } from 'vitest'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-param-rule')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-param-rule', rule, {
  valid: [
    // The examples of the docs.
    {
      code: settings({
        deny: [
          'Agent(model:opus)',
          'Agent(isolation:worktree)',
          'Bash(run_in_background:true)',
          'Agent(isolation:*)',
        ],
      }),
      filename: '.claude/settings.json',
    },
    {
      code: settings({ ask: ['Skill(skill:deploy)', 'Agent( model : opus )'] }),
      filename: '.claude/settings.local.json',
    },
    // The rules that the docs give in place of a primary-field rule.
    {
      code: settings({ deny: ['Bash(rm *)', 'Read(./path)', 'WebFetch(domain:host)'] }),
      filename: '.claude/settings.json',
    },
    // A field that is not primary for this tool.
    {
      code: settings({
        deny: ['Read(path:x)', 'Grep(file_path:x)', 'Bash(file_path:x)', 'Bogus(command:x)'],
      }),
      filename: '.claude/settings.json',
    },
    // The `:*` suffix of a command pattern has no primary field.
    {
      code: settings({ deny: ['Bash(git:*)', 'Bash(command)'] }),
      filename: '.claude/settings.json',
    },
    // An allow rule uses the specifier of its tool.
    {
      code: settings({ allow: ['Bash(command:rm *)', 'WebFetch(url:x)'] }),
      filename: '.claude/settings.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    {
      code: settings({ deny: ['Bash(command:x', 'Bash(command:x) y'] }),
      filename: '.claude/settings.json',
    },
    { code: JSON.stringify({ deny: ['Bash(command:x)'] }), filename: '.claude/settings.json' },
    // A bare name has no parameter.
    { code: settings({ deny: ['Bash'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ deny: ['Bash(command:rm *)'] }),
      filename: '.claude/settings.json',
      errors: [
        {
          messageId: 'primaryField',
          data: { tool: 'Bash', field: 'command' },
          line: 1,
          column: 25,
        },
      ],
    },
    // The primary field of each tool in the docs.
    {
      code: settings({
        deny: [
          'PowerShell(command:x)',
          'Read(file_path:x)',
          'Edit(file_path:x)',
          'Write(file_path:x)',
        ],
        ask: ['Grep(path:x)', 'Glob(path:x)', 'NotebookEdit(notebook_path:x)', 'WebFetch(url:x)'],
      }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'primaryField', data: { tool: 'PowerShell', field: 'command' } },
        { messageId: 'primaryField', data: { tool: 'Read', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Edit', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Write', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Grep', field: 'path' } },
        { messageId: 'primaryField', data: { tool: 'Glob', field: 'path' } },
        { messageId: 'primaryField', data: { tool: 'NotebookEdit', field: 'notebook_path' } },
        { messageId: 'primaryField', data: { tool: 'WebFetch', field: 'url' } },
      ],
    },
    // Whitespace around the colon is ignored.
    {
      code: settings({ deny: ['Bash( command : rm)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'primaryField' }],
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

markdownTester.run('permissions-param-rule in skill files', rule, {
  valid: [
    // A deny rule of the docs.
    skill('disallowed-tools: Agent(model:opus) Bash(rm *)\n'),
    // `allowed-tools` is an allow list, and an allow rule uses the specifier of its tool.
    skill('allowed-tools: Bash(command:rm *)\n'),
    skill('allowed-tools:\n  - Bash(command:rm *)\n'),
    // A rule that does not parse is for `permissions-rule-syntax`.
    skill('disallowed-tools: Bash(command:x\n'),
    skill('disallowed-tools: 3\n'),
    { ...skill('disallowed-tools: Bash(command:x)\n', 'docs/SKILL.md') },
    { code: '# No frontmatter\n', filename: '.claude/skills/s/SKILL.md' },
    skill('disallowed-tools: [unclosed\n'),
  ],
  invalid: [
    {
      ...skill('disallowed-tools: Read Bash(command:rm *)\n'),
      errors: [
        {
          messageId: 'primaryField',
          data: { tool: 'Bash', field: 'command' },
          line: 2,
          column: 24,
          endColumn: 42,
        },
      ],
    },
    {
      ...skill('disallowed-tools:\n  - Read(file_path:x)\n  - Grep\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'primaryField', line: 3, column: 5, endColumn: 22 }],
    },
    {
      ...skill('disallowed-tools: [WebFetch(url:x), Glob(path:x)]\n', pluginSkill()),
      errors: [{ messageId: 'primaryField' }, { messageId: 'primaryField' }],
    },
  ],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-param-rule on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const deny = list('deny')
  const bad = deny('Bash(command:x)')
  const good = deny('Bash(run_in_background:true)')

  jsonTester.run('permissions-param-rule (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'primaryField' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(lintJson('permissions-param-rule', bad, 'managed-settings.d/10-a.json')).toHaveLength(1)
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-param-rule', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})
