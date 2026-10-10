// The permissions page, "Read and Edit": Claude Code checks file permissions
// against `Edit(path)` and `Read(path)` rules only. The error reference
// names `Write`, `NotebookEdit`, `MultiEdit` and `Glob`.
import { describe, expect, it } from 'vitest'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-path-rule-tool')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-path-rule-tool', rule, {
  valid: [
    {
      code: settings({ allow: ['Edit(docs/**)', 'Read(docs/**)'], deny: ['Read(./.env)'] }),
      filename: '.claude/settings.json',
    },
    // The docs say to leave a bare name alone.
    {
      code: settings({ allow: ['Write', 'NotebookEdit', 'MultiEdit', 'Glob'], deny: ['Write'] }),
      filename: '.claude/settings.json',
    },
    // The docs name no replacement for `Grep` and `LSP`.
    {
      code: settings({ allow: ['Grep(src/**)', 'LSP(src/**)'] }),
      filename: '.claude/settings.json',
    },
    // A deny or ask parameter rule is for `permissions-param-rule`.
    {
      code: settings({ deny: ['Write(file_path:x)', 'Glob(path:x)'] }),
      filename: '.claude/settings.local.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: settings({ allow: ['Write(', 'Write(a) b'] }), filename: '.claude/settings.json' },
    { code: JSON.stringify({ allow: ['Write(a)'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    // An empty specifier is still a path rule, and Claude Code never consults it.
    {
      code: settings({ deny: ['Write()', 'Write(*)'] }),
      filename: '.claude/settings.json',
      errors: [
        { messageId: 'neverConsulted', data: { tool: 'Write', replacement: 'Edit' } },
        { messageId: 'neverConsulted', data: { tool: 'Write', replacement: 'Edit' } },
      ],
    },
    {
      code: settings({ allow: ['Write(docs/**)'] }),
      filename: '.claude/settings.json',
      errors: [
        {
          messageId: 'neverConsulted',
          data: { tool: 'Write', replacement: 'Edit' },
          line: 1,
          column: 26,
        },
      ],
    },
    {
      code: settings({
        deny: ['NotebookEdit(docs/**)', 'MultiEdit(docs/**)'],
        ask: ['Glob(docs/**)'],
      }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'neverConsulted', data: { tool: 'NotebookEdit', replacement: 'Edit' } },
        { messageId: 'neverConsulted', data: { tool: 'MultiEdit', replacement: 'Edit' } },
        { messageId: 'neverConsulted', data: { tool: 'Glob', replacement: 'Read' } },
      ],
    },
    // An allow rule has no parameter form.
    {
      code: settings({ allow: ['Write(file_path:x)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'neverConsulted' }],
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

markdownTester.run('permissions-path-rule-tool in skill files', rule, {
  valid: [
    skill('allowed-tools: Edit(docs/**) Read(docs/**) Write NotebookEdit Glob\n'),
    skill('allowed-tools: Grep(src/**) LSP(src/**)\n'),
    skill('disallowed-tools: Write(path:x)\n'),
    skill('allowed-tools: Write(docs/**\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read Write(docs/**)\n'),
      errors: [
        {
          messageId: 'neverConsulted',
          data: { tool: 'Write', replacement: 'Edit' },
          line: 2,
          column: 21,
          endColumn: 35,
        },
      ],
    },
    {
      ...skill('disallowed-tools:\n  - Glob(src/**)\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'neverConsulted', data: { tool: 'Glob', replacement: 'Read' } }],
    },
    {
      ...skill('allowed-tools: [NotebookEdit(a.ipynb)]\n', pluginSkill()),
      errors: [{ messageId: 'neverConsulted' }],
    },
  ],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-path-rule-tool on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const allow = list('allow')
  const bad = allow('Write(docs/**)')
  const good = allow('Edit(docs/**)')

  jsonTester.run('permissions-path-rule-tool (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'neverConsulted' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('permissions-path-rule-tool', bad, 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })

  it('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-path-rule-tool', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})
