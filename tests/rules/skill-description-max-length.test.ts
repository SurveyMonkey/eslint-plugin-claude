// Fixtures sit on each side of the 1,536-character limit on `description`
// plus `when_to_use` (the Claude Code skill listing).
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const filename = '.claude/skills/s/SKILL.md'
const skill = (fields: string) => ({ code: `---\nname: s\n${fields}---\n\n# S\n`, filename })
const text = (n: number) => 'a'.repeat(n)

markdownTester.run('skill-description-max-length', ruleOf('skill-description-max-length'), {
  valid: [
    skill(`description: ${text(1536)}\n`),
    skill(`description: ${text(1024)}\nwhen_to_use: ${text(512)}\n`),
    skill(`when_to_use: ${text(1536)}\n`),
    { code: '# No frontmatter\n', filename },
    skill('description: [unclosed\n'),
    skill('description: 3\n'),
    { ...skill(`description: ${text(1600)}\n`), options: [{ listingMax: 1600 }] },
    skill(`description: >-\n  ${text(1000)}\n  ${text(535)}\n`),
  ],
  invalid: [
    {
      ...skill(`description: ${text(1537)}\n`),
      errors: [
        {
          messageId: 'listingTruncated',
          data: { length: '1537', max: '1536' },
          line: 1,
          column: 1,
        },
      ],
    },
    {
      ...skill(`description: ${text(1000)}\nwhen_to_use: ${text(537)}\n`),
      errors: [{ messageId: 'listingTruncated', data: { length: '1537', max: '1536' } }],
    },
    {
      ...skill(`when_to_use: ${text(1537)}\n`),
      errors: [{ messageId: 'listingTruncated', data: { length: '1537', max: '1536' } }],
    },
    {
      ...skill(`description: ${text(101)}\nwhen_to_use: ${text(100)}\n`),
      options: [{ listingMax: 200 }],
      errors: [{ messageId: 'listingTruncated', data: { length: '201', max: '200' } }],
    },
  ],
})

// The schema and the message at a team value are checked through `Linter`,
// the way a user loads the option from a config.
describe('skill-description-max-length options', () => {
  const lint = (length: number, options: unknown[]) =>
    new Linter({ cwd: '/' }).verify(
      `---\nname: s\ndescription: ${text(length)}\n---\n\n# S\n`,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          languageOptions: { frontmatter: 'yaml' },
          rules: { 'claude/skill-description-max-length': ['warn', ...options] as never },
        },
      ],
      { filename: '/repo/.claude/skills/s/SKILL.md' },
    )

  it.fails('names a team value as the configured limit and not as a cut', () => {
    const [report] = lint(1200, [{ listingMax: 1000 }])
    expect(report?.message).toBe(
      '`description` plus `when_to_use` has 1200 characters. The configured limit is 1000.',
    )
    expect(report?.message).not.toContain('cuts')
  })

  it('keeps the cut message at the default value', () => {
    const [report] = lint(1537, [])
    expect(report?.message).toBe(
      '`description` plus `when_to_use` has 1537 characters. The skill listing cuts it at 1536.',
    )
  })

  it('keeps the cut message when the option names the default', () => {
    const [report] = lint(1537, [{ listingMax: 1536 }])
    expect(report?.message).toContain('The skill listing cuts it at 1536.')
  })

  it.fails('refuses a value above the 1,536 character cut', () => {
    expect(() => lint(10, [{ listingMax: 2000 }])).toThrow(/listingMax/)
  })

  it('accepts 1,536 as the largest value', () => {
    expect(lint(1537, [{ listingMax: 1536 }])).toHaveLength(1)
    expect(lint(1536, [{ listingMax: 1536 }])).toHaveLength(0)
  })
})
