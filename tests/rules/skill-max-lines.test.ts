// The skills page says to keep `SKILL.md` under 500 lines. Claude Code does not cut the file, so
// the option `max` has no schema maximum. A file of `max` lines reports, and one line fewer passes.
import { describe, expect, it } from 'vitest'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const file = '.claude/skills/s/SKILL.md'
const lines = (count: number, end = '\n') => `${'line\n'.repeat(count - 1)}line${end}`
const frontmatter = '---\ndescription: d\n---\n'

const error = (messageId: 'overDocsLimit' | 'overConfiguredLimit', extra: object = {}) => ({
  messageId,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
  ...extra,
})

markdownTester.run('skill-max-lines', ruleOf('skill-max-lines'), {
  valid: [
    { code: lines(499), filename: file },
    { code: lines(1), filename: file },
    { code: '', filename: file },
    // The line break at the end of the file does not start a line, and a file may lack it.
    { code: lines(499, ''), filename: file },
    { code: `${'line\r\n'.repeat(498)}line\r\n`, filename: file },
    // The frontmatter counts by default.
    { code: frontmatter + lines(496), filename: file },
    // `countFrontmatter: false` counts the body only.
    { code: frontmatter + lines(499), filename: file, options: [{ countFrontmatter: false }] },
    { code: `---\n---\n${lines(499)}`, filename: file, options: [{ countFrontmatter: false }] },
    { code: lines(499), filename: file, options: [{ countFrontmatter: false }] },
    // The frontmatter does not need to parse for the count.
    {
      code: `---\nname: [unclosed\n---\n${lines(499)}`,
      filename: file,
      options: [{ countFrontmatter: false }],
    },
    // Another value of `max`.
    { code: lines(9), filename: file, options: [{ max: 10 }] },
    { code: lines(999), filename: file, options: [{ max: 1000 }] },
    { code: lines(499), filename: file, options: [{ max: 500, countFrontmatter: true }] },
    // A plugin skill, and a plugin-root skill, that are short.
    { code: lines(10), filename: '.claude/skills/t/SKILL.md' },
    // A file below `commands/` is a command file, not a skill. A file elsewhere is no skill file.
    { code: lines(600), filename: '.claude/commands/x/SKILL.md' },
    { code: lines(600), filename: 'docs/SKILL.md' },
  ],
  invalid: [
    { code: lines(500), filename: file, errors: [error('overDocsLimit')] },
    { code: lines(501), filename: file, errors: [error('overDocsLimit')] },
    { code: lines(500, ''), filename: file, errors: [error('overDocsLimit')] },
    { code: `${'line\r\n'.repeat(499)}line\r\n`, filename: file, errors: [error('overDocsLimit')] },
    { code: frontmatter + lines(497), filename: file, errors: [error('overDocsLimit')] },
    {
      code: `---\nname: [unclosed\n---\n${lines(497)}`,
      filename: file,
      errors: [error('overDocsLimit')],
    },
    // The body alone is long.
    {
      code: frontmatter + lines(500),
      filename: file,
      options: [{ countFrontmatter: false }],
      errors: [error('overDocsLimit')],
    },
    {
      code: `---\n---\n${lines(500)}`,
      filename: file,
      options: [{ countFrontmatter: false }],
      errors: [error('overDocsLimit')],
    },
    {
      code: lines(500),
      filename: file,
      options: [{ countFrontmatter: false }],
      errors: [error('overDocsLimit')],
    },
    // A value that equals the docs number gives the docs message.
    { code: lines(500), filename: file, options: [{ max: 500 }], errors: [error('overDocsLimit')] },
    // Another value gives the message that names the configured limit.
    {
      code: lines(10),
      filename: file,
      options: [{ max: 10 }],
      errors: [error('overConfiguredLimit')],
    },
    {
      code: lines(1),
      filename: file,
      options: [{ max: 1 }],
      errors: [error('overConfiguredLimit')],
    },
    {
      code: lines(1000),
      filename: file,
      options: [{ max: 1000 }],
      errors: [error('overConfiguredLimit')],
    },
    {
      code: lines(300),
      filename: '.claude/skills/t/SKILL.md',
      options: [{ max: 200 }],
      errors: [error('overConfiguredLimit')],
    },
  ],
})

describe('the messages', () => {
  const messages = (code: string, options: unknown[]) =>
    lintMarkdown('skill-max-lines', code, file, options).map((m) => m.message)

  it('names the docs number at the default', () => {
    expect(messages(lines(520), [])).toEqual([
      'This file has 520 lines. The skills page says to keep `SKILL.md` under 500 lines. Move reference material to supporting files.',
    ])
  })

  it('names the configured limit at another value, and claims no docs number', () => {
    expect(messages(lines(12), [{ max: 10 }])).toEqual([
      'This file has 12 lines. The configured limit is under 10 lines. Move reference material to supporting files.',
    ])
  })

  it('counts the body only when the option says so', () => {
    expect(messages(frontmatter + lines(12), [{ max: 10, countFrontmatter: false }])).toEqual([
      'This file has 12 lines. The configured limit is under 10 lines. Move reference material to supporting files.',
    ])
  })
})

describe('the options', () => {
  const lint = (option: unknown) => lintMarkdown('skill-max-lines', lines(3), file, [option])

  it.each([
    { maxLines: 5 },
    { countfrontmatter: false },
    { max: '5' },
    { max: 0 },
    { max: 1.5 },
    { max: -1 },
    { countFrontmatter: 'yes' },
    { countFrontmatter: 1 },
  ])('refuses %j', (option) => {
    expect(() => lint(option)).toThrow('Key "claude/skill-max-lines"')
  })

  it('sets no schema maximum, because Claude Code does not cut the file', () => {
    expect(() => lint({ max: 1_000_000 })).not.toThrow()
  })
})
