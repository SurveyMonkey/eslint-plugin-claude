// The skills page, "Restrict Claude's skill access": "`Skill(anthropic *)`
// doesn't cover `anthropic-skills:pdf`, because a prefix outside the namespace
// doesn't match the names inside it." The page names this for an `allow` rule.
import { describe, expect, it } from 'vitest'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { jsonTester, lintJson, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-skill-rule')
const settings = (permissions: unknown) => JSON.stringify({ permissions })
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

jsonTester.run('permissions-skill-rule', rule, {
  valid: [
    // The examples of the docs.
    {
      code: settings({
        allow: ['Skill(commit)', 'Skill(review-pr *)', 'Skill(anthropic-skills:pdf)', 'Skill'],
        deny: ['Skill(deploy *)', 'Skill(skill:deploy)'],
      }),
      filename: '.claude/settings.json',
    },
    // A rule that reaches the namespace.
    {
      code: settings({ allow: ['Skill(anthropic-skills *)', 'Skill(anthropic-skills:p *)'] }),
      filename: '.claude/settings.json',
    },
    // A prefix that does not start with the vendor name, and a name that is no prefix of the namespace.
    {
      code: settings({ allow: ['Skill(a *)', 'Skill(deploy *)', 'Skill(anthropic-tools *)'] }),
      filename: '.claude/settings.json',
    },
    // The docs give the rule for `allow` only, and a prefix with no space is a literal name.
    {
      code: settings({ deny: ['Skill(anthropic *)'], ask: ['Skill(anthropic *)'] }),
      filename: '.claude/settings.local.json',
    },
    {
      code: settings({ allow: ['Skill(anthropic)', 'Skill(anthropic*)', 'Skill(anthropic-s*)'] }),
      filename: '.claude/settings.json',
    },
    // Another tool.
    { code: settings({ allow: ['Bash(anthropic *)'] }), filename: '.claude/settings.json' },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: settings({ allow: ['Skill(anthropic *'] }), filename: '.claude/settings.json' },
    { code: JSON.stringify({ allow: ['Skill(anthropic *)'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ allow: ['Skill(anthropic *)'] }),
      filename: '.claude/settings.json',
      errors: [
        {
          messageId: 'outsideNamespace',
          data: { prefix: 'anthropic' },
          line: 1,
          column: 26,
        },
      ],
    },
    // Each prefix between the vendor name and the namespace.
    {
      code: settings({ allow: ['Skill(anthropic- *)', 'Skill(anthropic-skill *)'] }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'outsideNamespace', data: { prefix: 'anthropic-' } },
        { messageId: 'outsideNamespace', data: { prefix: 'anthropic-skill' } },
      ],
    },
  ],
})

markdownTester.run('permissions-skill-rule in skill files', rule, {
  valid: [
    skill('allowed-tools: Skill(anthropic-skills *) Skill(commit) Skill\n'),
    // The deny list is not an allow list.
    skill('disallowed-tools: Skill(anthropic *)\n'),
    skill('allowed-tools: Skill(anthropic *\n'),
    skill('allowed-tools: Skill(anthropic *)\n', 'docs/SKILL.md'),
    skill('allowed-tools: 3\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read Skill(anthropic *)\n'),
      errors: [
        {
          messageId: 'outsideNamespace',
          data: { prefix: 'anthropic' },
          line: 2,
          column: 21,
          endColumn: 39,
        },
      ],
    },
    {
      ...skill('allowed-tools:\n  - Skill(anthropic *)\n', '.claude/commands/c.md'),
      errors: [{ messageId: 'outsideNamespace', line: 3 }],
    },
    {
      ...skill('allowed-tools: [Skill(anthropic *)]\n', pluginSkill()),
      errors: [{ messageId: 'outsideNamespace' }],
    },
  ],
})

// The managed settings files (#14): the rule lints `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in. Claude Code ignores a hidden drop-in, so the rule reads none.
describe('permissions-skill-rule on managed settings files', () => {
  const managed = ['managed-settings.json', 'etc/claude-code/managed-settings.d/10-a.json']
  const list = (key: string) => (rule: string) => JSON.stringify({ permissions: { [key]: [rule] } })
  const allow = list('allow')
  const bad = allow('Skill(anthropic *)')
  const good = allow('Skill(anthropic-skills *)')

  jsonTester.run('permissions-skill-rule (managed files)', rule, {
    valid: managed.map((filename) => ({ code: good, filename })),
    invalid: managed.map((filename) => ({
      code: bad,
      filename,
      errors: [{ messageId: 'outsideNamespace' as const }],
    })),
  })

  it('reports in a drop-in that is not hidden', () => {
    expect(lintJson('permissions-skill-rule', bad, 'managed-settings.d/10-a.json')).toHaveLength(1)
  })

  it('is silent in a hidden drop-in', () => {
    expect(lintJson('permissions-skill-rule', bad, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})
