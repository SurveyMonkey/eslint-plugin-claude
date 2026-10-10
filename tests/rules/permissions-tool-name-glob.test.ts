// The permissions page, "Tool name wildcards": a deny or ask rule takes a
// glob anywhere in the name. An allow rule takes one only after a literal
// `mcp__<server>__` prefix.
import { describe, expect, it } from 'vitest'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

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

// The skills page, "Pre-approve tools for a skill": `allowed-tools` is an
// allow list, and `disallowed-tools` is a deny list. Each takes a string or a
// YAML list.
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('permissions-tool-name-glob in skill files', rule, {
  valid: [
    skill('allowed-tools: mcp__puppeteer__* mcp__github__get_*\n'),
    // `disallowed-tools` is a deny list, and a deny rule takes a glob anywhere.
    skill('disallowed-tools: * mcp__* B*\n'),
    skill('allowed-tools: Bash(git *) Read(**/*.ts)\n'),
    skill('allowed-tools: *(\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read *\n'),
      errors: [{ messageId: 'unanchored', line: 2, column: 21, endColumn: 22 }],
    },
    {
      ...skill('allowed-tools:\n  - mcp__*\n  - B*\n', '.claude/commands/c.md'),
      errors: [
        { messageId: 'unanchored', line: 3 },
        { messageId: 'unanchored', line: 4 },
      ],
    },
    {
      ...skill('allowed-tools: "mcp__*__get, Ba*"\n', pluginSkill()),
      errors: [{ messageId: 'unanchored' }, { messageId: 'unanchored' }],
    },
  ],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-tool-name-glob on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const allow = list('allow')
  const bad = allow('B*')
  const good = allow('mcp__a__*')

  jsonTester.run('permissions-tool-name-glob (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'unanchored' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('permissions-tool-name-glob', bad, 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-tool-name-glob', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})
