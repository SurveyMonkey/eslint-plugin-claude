// The permissions page, "Match by input parameter": Claude Code skips each
// `mcp__` rule that has parentheses when it loads a settings file.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

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

// The permissions page states the skip for a settings file only (ruling 17).
markdownTester.run('permissions-mcp-rule-parens in skill files', rule, {
  valid: [
    skill('allowed-tools: mcp__s__t(x)\n'),
    skill('disallowed-tools: mcp__s__t(x)\n', '.claude/commands/c.md'),
  ],
  invalid: [],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-mcp-rule-parens on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const deny = list('deny')
  const bad = deny('mcp__a(x)')
  const good = deny('mcp__a')

  jsonTester.run('permissions-mcp-rule-parens (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'parens' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(
      lintJson('permissions-mcp-rule-parens', bad, 'managed-settings.d/10-a.json'),
    ).toHaveLength(1)
  })

  it('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-mcp-rule-parens', bad, 'managed-settings.d/.10-a.json')).toEqual(
      [],
    )
  })
})
