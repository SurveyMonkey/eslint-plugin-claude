// Claude Code matches each `claudeMdExcludes` pattern against absolute file paths
// (https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files). The docs examples
// start with `**/` or `/`, and the large codebases guide says to start a relative-style
// pattern with `**/`. The files glob is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('claude-md-excludes-pattern')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'

const excludes = (...patterns: string[]) => JSON.stringify({ claudeMdExcludes: patterns })
const relative = (pattern: string) => ({
  messageId: 'relative' as const,
  data: { pattern },
})

jsonTester.run('claude-md-excludes-pattern', rule, {
  valid: [
    // The examples of the docs.
    { code: excludes('**/monorepo/CLAUDE.md'), filename: local },
    { code: excludes('/home/user/monorepo/other-team/.claude/rules/**'), filename: local },
    { code: excludes('**/vendor/**/CLAUDE.md'), filename: project },
    { code: excludes('**/packages/web/**'), filename: project },
    { code: excludes('**/packages/*/CLAUDE.md', '**/packages/legacy-*/**'), filename: project },
    { code: excludes('/home/user/monorepo/legacy/CLAUDE.md'), filename: project },
    // A Windows drive, with either separator, and a Windows share.
    { code: excludes('C:\\work\\monorepo\\**'), filename: project },
    { code: excludes('d:/work/monorepo/CLAUDE.md'), filename: project },
    { code: excludes('\\\\server\\share\\CLAUDE.md'), filename: project },
    // `**` alone matches every absolute path.
    { code: excludes('**'), filename: project },
    // An empty list, no key, and a value that is not a list.
    { code: excludes(), filename: project },
    { code: '{}', filename: project },
    { code: '{"claudeMdExcludes": "packages/web/**"}', filename: project },
    { code: '{"claudeMdExcludes": {"a": "b"}}', filename: project },
    // An entry that is not a string is for `memory-settings-schema`.
    { code: '{"claudeMdExcludes": [1, null, ["x"], {"a": 1}]}', filename: project },
    // A document that is not an object.
    { code: '[1]', filename: project },
    // The last of two keys of one name counts, as in `JSON.parse`.
    {
      code: '{"claudeMdExcludes": ["a/**"], "claudeMdExcludes": ["**/a/**"]}',
      filename: project,
    },
    // A hidden drop-in is ignored by Claude Code, so no report.
    { code: excludes('packages/web/**'), filename: 'managed-settings.d/.20-hidden.json' },
  ],
  invalid: [
    {
      code: '{"claudeMdExcludes": ["packages/web/**"]}',
      filename: project,
      errors: [{ ...relative('packages/web/**'), line: 1, column: 23, endColumn: 40 }],
    },
    // The guide shows `**/packages/web/**` as the fix of this relative-style pattern.
    {
      code: excludes('packages/*/CLAUDE.md'),
      filename: local,
      errors: [relative('packages/*/CLAUDE.md')],
    },
    { code: excludes('CLAUDE.md'), filename: project, errors: [relative('CLAUDE.md')] },
    { code: excludes('./packages/**'), filename: project, errors: [relative('./packages/**')] },
    { code: excludes('../other/**'), filename: project, errors: [relative('../other/**')] },
    { code: excludes('~/work/**'), filename: project, errors: [relative('~/work/**')] },
    { code: excludes('*/CLAUDE.md'), filename: project, errors: [relative('*/CLAUDE.md')] },
    { code: excludes('**CLAUDE.md'), filename: project, errors: [relative('**CLAUDE.md')] },
    { code: excludes(''), filename: project, errors: [relative('')] },
    { code: excludes('C:work/**'), filename: project, errors: [relative('C:work/**')] },
    { code: excludes('\\a'), filename: project, errors: [relative('\\a')] },
    // Each bad entry gets a report, and a good entry beside it gets none.
    {
      code: excludes('a/**', '**/b/**', 'c/**'),
      filename: project,
      errors: [relative('a/**'), relative('c/**')],
    },
    // The managed files.
    { code: excludes('a/**'), filename: managed, errors: [relative('a/**')] },
    { code: excludes('a/**'), filename: dropIn, errors: [relative('a/**')] },
    // The last of two keys of one name counts.
    {
      code: '{"claudeMdExcludes": ["**/a/**"], "claudeMdExcludes": ["a/**"]}',
      filename: project,
      errors: [relative('a/**')],
    },
    // A string entry beside entries of other types.
    {
      code: '{"claudeMdExcludes": [1, "a/**", null]}',
      filename: project,
      errors: [relative('a/**')],
    },
  ],
})

// The text of the message.
jsonTester.run('claude-md-excludes-pattern (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: excludes('packages/web/**'),
      filename: project,
      errors: [
        {
          message:
            '`claudeMdExcludes` matches absolute file paths, so "packages/web/**" matches none. Start the pattern with `**/`, or write the absolute path.',
        },
      ],
    },
  ],
})
