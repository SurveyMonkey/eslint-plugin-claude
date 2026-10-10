// A `paths` glob of a rule file is valid when each `[` starts a bracket expression, and when the
// brace groups of the whole list expand to at most 1,000 patterns and 4 MiB
// (https://code.claude.com/docs/en/memory#path-specific-rules). The checks are the ones of
// `skill-paths-glob-valid`, and tests/paths-glob.test.ts covers them. These cases cover what is
// particular to a rule file. The expected counts are worked out by hand: `{a,b}/{c,d}/*.{ts,tsx}`
// is eight patterns.
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('rules-paths-glob-valid')

const filename = '.claude/rules/api.md'
const rulefile = (paths: string, name = filename) => ({
  code: `---\npaths: ${paths}\n---\n\n# API\n`,
  filename: name,
})
const list = (...items: string[]) =>
  rulefile(`\n${items.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}`)
const text = (value: string) => rulefile(JSON.stringify(value))
/** A brace group of `n` single letters. */
const group = (n: number) => `{${'abcdefghijklmnopqrstuvwxyz'.slice(0, n).split('').join(',')}}`
const budget = (count: number, bytes: number) => ({
  messageId: 'budget' as const,
  data: { count: String(count), bytes: String(bytes) },
})
const bracket = (pattern: string) => ({ messageId: 'bracket' as const, data: { pattern } })

markdownTester.run('rules-paths-glob-valid', rule, {
  valid: [
    // The examples of the docs.
    list('src/api/**/*.ts'),
    list('src/**/*.{ts,tsx}', 'lib/**/*.ts', 'tests/**/*.test.ts'),
    list('**/*.ts', 'src/**/*', '*.md', 'src/components/*.tsx'),
    text('src/**/*.ts, lib/**/*.ts'),
    text('{a,b}/{c,d}/*.{ts,tsx}'),
    // A literal `[`, and a bracket expression.
    text('photos \\[2024/**'),
    text('[abc].ts, file[0-9].ts'),
    // 10 x 10 x 10 is exactly the limit.
    text(`${group(10)}/${group(10)}/${group(10)}`),
    // Not a string or a list of strings; `rules-frontmatter-schema` reports that.
    rulefile('3'),
    rulefile('[1, {a: b}]'),
    rulefile(''),
    // No `paths`, no frontmatter, and YAML that does not parse.
    { code: '---\nglobs: "[unclosed"\n---\n', filename },
    { code: '# API\n', filename },
    { code: '---\npaths: [unclosed\n---\n', filename },
    // A block below line 1 is rule text, so it holds no glob.
    { code: '# API\n\n---\npaths: "[unclosed"\n---\n', filename },
    // A rule file at each depth, with a good glob.
    { ...text('src/**'), filename: '.claude/rules/frontend/react.md' },
    { ...text('src/**'), filename: 'packages/web/.claude/rules/a.md' },
    // A file that is not a rule file is not read, even with a bad glob.
    { ...text('[unclosed'), filename: 'docs/rules/a.md' },
    { ...text('[unclosed'), filename: '.claude/skills/rules/a.md' },
    { ...text('[unclosed'), filename: 'CLAUDE.md' },
    { ...text('[unclosed'), filename: 'docs/CLAUDE-notes.md' },
    { ...text('[unclosed'), filename: '.claude/commands/c.md' },
  ],
  invalid: [
    {
      ...text('photos [2024/**'),
      errors: [{ ...bracket('photos [2024/**'), line: 2, column: 8 }],
    },
    // The list and the string give one report for each bad pattern.
    {
      ...list('src/*.ts', '[a', 'lib/[', 'ok/**'),
      errors: [bracket('[a'), bracket('lib/[')],
    },
    {
      ...text('src/*.ts, [a, lib/*.{ts,tsx}, b['),
      errors: [bracket('[a'), bracket('b[')],
    },
    // A rule file at each depth.
    { ...text('[a'), filename: '.claude/rules/frontend/react.md', errors: [bracket('[a')] },
    { ...text('[a'), filename: 'packages/web/.claude/rules/a.md', errors: [bracket('[a')] },
    // The budget: 1,001 patterns, with 5 bytes in each.
    {
      ...text(`${group(7)}/${group(11)}/${group(13)}`),
      errors: [budget(1001, 5005)],
    },
    // The whole list shares the budget: two patterns of 600.
    {
      ...list(`${group(6)}/${group(10)}/${group(10)}`, `${group(10)}/${group(10)}/${group(6)}`),
      errors: [budget(1200, 6000)],
    },
    // A bad `[` and the budget are two reports.
    {
      ...text(`${group(11)}/${group(10)}/${group(10)}/[`),
      errors: [{ messageId: 'bracket' }, { messageId: 'budget' }],
    },
  ],
})

// The text of each message.
markdownTester.run('rules-paths-glob-valid (message text)', rule, {
  valid: [],
  invalid: [
    {
      ...text('a['),
      errors: [
        {
          message:
            '`a[` has a `[` that starts no bracket expression. Claude Code matches no file with it. Escape the `[` as `\\[`.',
        },
      ],
    },
    {
      ...text(`${group(11)}/${group(10)}/${group(10)}`),
      errors: [
        {
          message:
            'The brace groups in `paths` expand to 1100 patterns and 5500 bytes. The limit is 1,000 patterns or 4 MiB. Claude Code then keeps the patterns that exceed the budget as they are, and their braces match no file.',
        },
      ],
    },
  ],
})
