// A `paths` glob of a skill is valid when each `[` starts a bracket
// expression, and when the brace groups of the whole list expand to at most
// 1,000 patterns and 4 MiB. The expected counts are worked out by hand from
// the examples of the docs: `{a,b}/{c,d}/*.{ts,tsx}` is eight patterns.

import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const filename = '.claude/skills/s/SKILL.md'
const skill = (paths: string, name = filename) => ({
  code: `---\nname: s\npaths: ${paths}\n---\n\n# S\n`,
  filename: name,
})
const list = (...items: string[]) =>
  skill(`\n${items.map((i) => `  - ${JSON.stringify(i)}`).join('\n')}`)
const text = (value: string) => skill(JSON.stringify(value))
/** A brace group of `n` single letters. */
const group = (n: number) => `{${'abcdefghijklmnopqrstuvwxyz'.slice(0, n).split('').join(',')}}`
/** Nine groups of two: 512 patterns, 9 bytes each before any added text. */
const many = '{a,b}'.repeat(9)
const budget = (count: number, bytes: number) => ({
  messageId: 'budget' as const,
  data: { count: String(count), bytes: String(bytes) },
})
const bracket = (pattern: string) => ({ messageId: 'bracket' as const, data: { pattern } })

markdownTester.run('skill-paths-glob-valid', ruleOf('skill-paths-glob-valid'), {
  valid: [
    // The examples of the docs.
    list('src/**/*.{ts,tsx}', 'lib/**/*.ts', 'tests/**/*.test.ts'),
    list('**/*.ts', 'src/**/*', '*.md', 'src/components/*.tsx'),
    text('src/**/*.ts, lib/**/*.ts'),
    text('src/*.{ts,tsx}, lib/*.js'),
    text('src/*.{ts,tsx},,lib/*.js,'),
    text('{a,b}/{c,d}/*.{ts,tsx}'),
    // A literal `[`, and each form of a bracket expression.
    text('photos \\[2024/**'),
    text('[[].ts, [^]a].ts, [!]a].ts'),
    text('[abc].ts, file[0-9].ts, [!a]*.ts, [^a]*.ts, []a]*.ts, [[:alpha:]]*.ts, [a\\]b].ts'),
    // Patterns with no brace group do not count against the budget.
    list(...Array.from({ length: 2000 }, (_, i) => `dir${i}/*.ts`)),
    // 10 x 10 x 10 is exactly the limit. A nested group counts its leaves.
    text(`${group(10)}/${group(10)}/${group(10)}`),
    text('{a,{b,c}}'.repeat(6)),
    // Exactly 4 MiB is within the budget: 512 patterns of 8,192 bytes.
    text(`${many}${'x'.repeat(8192 - 9)}`),
    // A group nested more than 100 deep is text, so the rule neither fails nor counts it.
    // These are 1,001 patterns inside 101 groups.
    text(`${'{'.repeat(101)}${group(7)}/${group(11)}/${group(13)}${'}'.repeat(101)}`),
    text(`${'{'.repeat(20000)}a,b${'}'.repeat(20000)}`),
    // A brace that closes nothing, or that is escaped, or that has no comma, is text.
    text(`${group(10)}${group(10)}${group(10)}/{a,b`),
    text('\\{a,b\\}'.repeat(12)),
    text('{a}'.repeat(20)),
    text(`${'\\{a,b}'.repeat(11)}`),
    text('}{a,b}'),
    // Not a string or a list of strings.
    skill('3'),
    skill('[1, {a: b}]'),
    skill(''),
    list('src/*.ts', ''),
    { code: '---\nname: s\n---\n', filename },
    { code: '# S\n', filename },
    { code: '---\npaths: [unclosed\n---\n', filename },
    // A command file takes no `paths`; `skill-frontmatter-schema` reports that.
    skill('"[unclosed"', '.claude/commands/c.md'),
    skill('"[unclosed"', 'docs/SKILL.md'),
    // A plugin skill.
    { ...text('src/**/*.{ts,tsx}'), filename: pluginSkill() },
    { ...text('src/**/*.{ts,tsx}'), filename: pluginSkill('other') },
    { ...text('[unclosed'), filename: pluginCommand() },
  ],
  invalid: [
    {
      ...text('photos [2024/**'),
      errors: [{ ...bracket('photos [2024/**'), line: 3, column: 8 }],
    },
    // Each form of a `[` that no `]` closes.
    ...['[', 'a[', '[]', '[!', '[^', '[!]', '[^]', '[a', 'a\\[b[', '[a\\]', '[\\'].map(
      (pattern) => ({
        ...list(pattern),
        errors: [bracket(pattern)],
      }),
    ),
    // The list and the string give one report for each bad pattern.
    {
      ...list('src/*.ts', '[a', 'lib/[', 'ok/**'),
      errors: [bracket('[a'), bracket('lib/[')],
    },
    {
      ...text('src/*.ts, [a, lib/*.{ts,tsx}, b['),
      errors: [bracket('[a'), bracket('b[')],
    },
    // A brace group does not hide a bad `[`.
    {
      ...text('{a,b}/['),
      errors: [bracket('{a,b}/[')],
    },
    // A plugin skill.
    {
      ...text('[a'),
      filename: pluginSkill(),
      errors: [bracket('[a')],
    },
    // The budget: 1,001 patterns, with 5 bytes in each.
    {
      ...text(`${group(7)}/${group(11)}/${group(13)}`),
      errors: [budget(1001, 5005)],
    },
    {
      ...text(`${group(11)}/${group(10)}/${group(10)}`),
      errors: [budget(1100, 5500)],
    },
    {
      ...text('{a,{b,c}}'.repeat(7)),
      errors: [budget(2187, 2187 * 7)],
    },
    // An escaped brace or comma does not end a group, and a group of one alternative expands inside.
    { ...text('{a,\\{b}'.repeat(10)), errors: [budget(1024, 20480)] },
    { ...text('{a\\,b,c}'.repeat(10)), errors: [budget(1024, 25600)] },
    { ...text('{{a,b}}'.repeat(10)), errors: [budget(1024, 30720)] },
    // The whole list shares the budget: two patterns of 600.
    {
      ...list(`${group(6)}/${group(10)}/${group(10)}`, `${group(10)}/${group(10)}/${group(6)}`),
      errors: [budget(1200, 6000)],
    },
    // A pattern with no braces is not in the sum.
    {
      ...list(`${group(11)}/${group(10)}/${group(10)}`, 'plain/**/*.ts'),
      errors: [budget(1100, 5500)],
    },
    // The bytes: 512 patterns of 8,193 bytes are 512 bytes over 4 MiB.
    {
      ...text(`${many}${'x'.repeat(8193 - 9)}`),
      errors: [budget(512, 512 * 8193)],
    },
    // A letter that takes more than one byte counts its bytes: 512 patterns of 8,209 bytes.
    {
      ...text(`${many}${'\u00e9'.repeat(4100)}`),
      errors: [budget(512, 512 * 8209)],
    },
    // Inside 100 groups, the same 1,001 patterns count, and each one holds 200 more bytes.
    {
      ...text(`${'{'.repeat(100)}${group(7)}/${group(11)}/${group(13)}${'}'.repeat(100)}`),
      errors: [budget(1001, 1001 * (5 + 200))],
    },
    // The count has a cap, so a long list of groups stays finite.
    {
      ...text('{a,b}'.repeat(60)),
      errors: [budget(1e12, 1e12)],
    },
    // A bad `[` and the budget are two reports.
    {
      ...text(`${group(11)}/${group(10)}/${group(10)}/[`),
      errors: [{ messageId: 'bracket' }, { messageId: 'budget' }],
    },
  ],
})
