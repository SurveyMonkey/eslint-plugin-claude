// The rule reads one managed settings file: `managed-settings.json` or a file in a
// `managed-settings.d/` directory. The files glob, and the match of a hidden file by that glob,
// are in tests/configs.test.ts. The page "Deploy managed settings" gives each fact:
// https://code.claude.com/docs/en/managed-settings
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-managed-file')

const main = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const hidden = 'managed-settings.d/.10-x.json'
const obj = (value: object) => JSON.stringify(value)

jsonTester.run('settings-managed-file (valid)', rule, {
  valid: [
    // A file with a policy key counts.
    { code: obj({ model: 'opus' }), filename: main },
    { code: obj({ model: 'opus' }), filename: dropIn },
    { code: obj({ model: 'opus' }), filename: 'etc/claude-code/managed-settings.json' },
    { code: obj({ model: 'opus' }), filename: 'etc/claude-code/managed-settings.d/20-y.json' },
    // An empty object is an empty managed settings file. The docs say it counts as `{}`.
    { code: '{}', filename: main },
    { code: '{}', filename: dropIn },
    // A control key beside a policy key.
    { code: obj({ managedSourcesBehavior: 'first-wins', model: 'opus' }), filename: main },
    {
      code: obj({ wslInheritsWindowsSettings: true, allowManagedHooksOnly: true }),
      filename: dropIn,
    },
    // A policy key counts when its value is not `null`. A `null` removes the key, so the file
    // holds no key at all, and the rule has no control key to report.
    { code: obj({ model: null }), filename: main },
    {
      code: obj({ managedSourcesBehavior: null, wslInheritsWindowsSettings: null }),
      filename: dropIn,
    },
    // A control key with a `null` value is no control key, and a policy key beside it counts.
    { code: obj({ managedSourcesBehavior: null, model: 'opus' }), filename: main },
    // Two keys of one name. The rule reads the last. The last `managedSourcesBehavior` is not
    // "merge", so there is nothing to report.
    {
      code: '{"managedSourcesBehavior": "merge", "managedSourcesBehavior": "first-wins", "model": "x"}',
      filename: main,
    },
    // Two keys of one name: the last `model` is a value, so the file holds a policy key.
    { code: '{"model": null, "model": "x", "managedSourcesBehavior": "merge"}', filename: dropIn },
    // "merge" beside a policy key in a drop-in. The page states the lowest rank for the
    // `managed-settings.json` file. The rule does not check a drop-in for it.
    { code: obj({ managedSourcesBehavior: 'merge', model: 'x' }), filename: dropIn },
    // A value of another type is not the string "merge".
    { code: obj({ managedSourcesBehavior: true, model: 'x' }), filename: main },
    // A file in `managed-settings.d` that is named `managed-settings.json` is a drop-in.
    { code: obj({ model: 'x' }), filename: 'managed-settings.d/managed-settings.json' },
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: 'managed-settings.d/managed-settings.json',
    },
    // A dot inside a file name is not a hidden file.
    { code: obj({ model: 'x' }), filename: 'managed-settings.d/10.x.json' },
    // A hidden name outside `managed-settings.d` is not a drop-in.
    { code: obj({ model: 'x' }), filename: 'other/.managed-settings.json' },
  ],
  invalid: [],
})

jsonTester.run('settings-managed-file (invalid)', rule, {
  valid: [],
  invalid: [
    // A top-level value that is not an object: Claude Code refuses to start. The report is on
    // the value.
    ...[main, dropIn].flatMap((filename) =>
      ['[1]', '"x"', '1', 'null', 'true', 'false'].map((code) => ({
        code,
        filename,
        errors: [{ messageId: 'notObject' as const }],
      })),
    ),
    {
      code: '\n  [{"a": 1}]',
      filename: main,
      errors: [{ messageId: 'notObject', line: 2, column: 3 }],
    },
    // A hidden drop-in: Claude Code ignores it. The report is on the top-level value.
    {
      code: obj({ model: 'opus' }),
      filename: hidden,
      errors: [{ messageId: 'hiddenDropIn', line: 1, column: 1 }],
    },
    // A hidden drop-in gets the one report. Claude Code does not read it, so a top level
    // that is not an object, and a control key, do not matter.
    { code: '[1]', filename: hidden, errors: [{ messageId: 'hiddenDropIn' }] },
    {
      code: obj({ managedSourcesBehavior: 'first-wins' }),
      filename: 'etc/claude-code/managed-settings.d/.20-y.json',
      errors: [{ messageId: 'hiddenDropIn' }],
    },
    // A file with only control keys: Claude Code does not count it, and moves on.
    ...[main, dropIn].flatMap((filename) =>
      [
        { managedSourcesBehavior: 'first-wins' },
        { wslInheritsWindowsSettings: true },
        { wslInheritsWindowsSettings: false, managedSourcesBehavior: 'first-wins' },
        // A `null` removes a policy key, so only the control key is left.
        { model: null, managedSourcesBehavior: 'first-wins' },
      ].map((value) => ({
        code: obj(value),
        filename,
        errors: [{ messageId: 'controlKeysOnly' as const, line: 1, column: 1 }],
      })),
    ),
    // The last of two keys of one name counts.
    {
      code: '{"model": "x", "model": null, "managedSourcesBehavior": "first-wins"}',
      filename: main,
      errors: [{ messageId: 'controlKeysOnly' }],
    },
    // "merge" in `managed-settings.json` has no source below it to combine with.
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: main,
      errors: [{ messageId: 'mergeNothing', line: 1, column: 27, endColumn: 34 }],
    },
    {
      code: '{"model": "x", "managedSourcesBehavior": "first-wins", "managedSourcesBehavior": "merge"}',
      filename: 'etc/claude-code/managed-settings.json',
      errors: [{ messageId: 'mergeNothing' }],
    },
    // A file with only "merge" gets one report: the file does not count, so "merge" has no effect.
    {
      code: obj({ managedSourcesBehavior: 'merge' }),
      filename: main,
      errors: [{ messageId: 'controlKeysOnly' }],
    },
  ],
})

// The text of each message.
jsonTester.run('settings-managed-file (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: '[1]',
      filename: main,
      errors: [
        {
          message:
            'Claude Code refuses to start when a managed settings file is not a JSON object. The top-level value has the type Array.',
        },
      ],
    },
    {
      code: '{}',
      filename: hidden,
      errors: [
        {
          message:
            'Claude Code ignores the hidden file ".10-x.json" in managed-settings.d. Rename it, or remove it.',
        },
      ],
    },
    {
      code: obj({ wslInheritsWindowsSettings: true }),
      filename: dropIn,
      errors: [
        {
          message:
            'This file holds only the control keys wslInheritsWindowsSettings and managedSourcesBehavior. Claude Code does not count it as a policy source, and moves on to the next source.',
        },
      ],
    },
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: main,
      errors: [
        {
          message:
            '"merge" in a managed settings file has no source below it to combine with. The file is the lowest-ranked admin source.',
        },
      ],
    },
  ],
})
