// Fixtures sit on each side of the 1,536-character limit on `description`
// plus `when_to_use` (the Claude Code skill listing).
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
