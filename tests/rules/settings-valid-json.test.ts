// The rule reads the top-level value of `.claude/settings.json` and `.claude/settings.local.json`.
// A comment and a trailing comma are parse errors of the `json/json` language, so a RuleTester
// case cannot reach them. The files glob and the managed files are in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-valid-json')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'

jsonTester.run('settings-valid-json (valid)', rule, {
  valid: [
    { code: '{}', filename: project },
    { code: '{}', filename: local },
    { code: JSON.stringify({ model: 'opus' }), filename: project },
    { code: '{"model": "opus", "env": {"A": "1"}}', filename: local },
    // A file in a nested directory is read by its name.
    { code: '{}', filename: 'packages/app/.claude/settings.json' },
    // A value inside the object is not the top level.
    { code: '{"a": [1], "b": "x", "c": null, "d": true}', filename: project },
  ],
  invalid: [],
})

jsonTester.run('settings-valid-json (invalid)', rule, {
  valid: [],
  invalid: [
    // The report is on the top-level value.
    {
      code: '[1]',
      filename: project,
      errors: [{ messageId: 'notObject', line: 1, column: 1, endColumn: 4 }],
    },
    { code: '[]', filename: local, errors: [{ messageId: 'notObject' }] },
    { code: '"x"', filename: project, errors: [{ messageId: 'notObject' }] },
    { code: '1', filename: project, errors: [{ messageId: 'notObject' }] },
    { code: 'null', filename: project, errors: [{ messageId: 'notObject' }] },
    { code: 'true', filename: local, errors: [{ messageId: 'notObject' }] },
    { code: 'false', filename: local, errors: [{ messageId: 'notObject' }] },
    // A line before the value moves the report to the value.
    {
      code: '\n\n  [{"a": 1}]\n',
      filename: 'packages/app/.claude/settings.local.json',
      errors: [{ messageId: 'notObject', line: 3, column: 3 }],
    },
  ],
})

// The text of each message.
jsonTester.run('settings-valid-json (message text)', rule, {
  valid: [],
  invalid: [
    ...[
      ['[1]', 'Array'],
      ['"x"', 'String'],
      ['1', 'Number'],
      ['true', 'Boolean'],
      ['null', 'Null'],
    ].map(([code, kind]) => ({
      code: code as string,
      filename: project,
      errors: [
        {
          message: `Claude Code rejects a settings file whose top level is not a JSON object. The top-level value has the type ${kind}.`,
        },
      ],
    })),
  ],
})
