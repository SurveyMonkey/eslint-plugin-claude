// The expected values come from the `attribution` entry of the settings reference
// (https://code.claude.com/docs/en/settings-reference#attribution): `false` needs Claude Code
// v2.1.281 or later, and an earlier version skips the whole user, project or local file.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-attribution-false')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const FILES = [project, local]

jsonTester.run('settings-attribution-false (valid)', rule, {
  valid: [
    // The form for a file that an older version also reads.
    ...FILES.map((filename) => ({
      code: '{"attribution": {"commit": "", "pr": "", "sessionUrl": false}}',
      filename,
    })),
    // A value of another type is for `settings-schema`.
    ...FILES.flatMap((filename) =>
      ['true', 'null', '"false"', '0', '{}'].map((value) => ({
        code: `{"attribution": ${value}}`,
        filename,
      })),
    ),
    // `false` for another key, and `attribution` inside another value.
    ...FILES.map((filename) => ({
      code: '{"includeCoAuthoredBy": false, "env": {"attribution": false}}',
      filename,
    })),
    // The last of two keys of one name counts.
    { code: '{"attribution": false, "attribution": {}}', filename: project },
    // A value that is not an object has no keys.
    ...FILES.flatMap((filename) => ['[1]', '"x"', 'null', '1'].map((code) => ({ code, filename }))),
  ],
  invalid: [],
})

jsonTester.run('settings-attribution-false (invalid)', rule, {
  valid: [],
  invalid: [
    // The report is on the value.
    ...FILES.map((filename) => ({
      code: '{"attribution": false}',
      filename,
      errors: [{ messageId: 'older' as const, line: 1, column: 17, endColumn: 22 }],
    })),
    // The last of two keys of one name counts.
    {
      code: '{"attribution": {}, "attribution": false}',
      filename: project,
      errors: [{ messageId: 'older' as const, line: 1, column: 36 }],
    },
  ],
})
