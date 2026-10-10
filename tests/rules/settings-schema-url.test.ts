// The URL comes from the "Edit a settings file" section of the settings page
// (https://code.claude.com/docs/en/settings#edit-a-settings-file).
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-schema-url')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const URL = 'https://json.schemastore.org/claude-code-settings.json'

jsonTester.run('settings-schema-url (valid)', rule, {
  valid: [
    // The published URL, in each settings file.
    ...ALL.map((filename) => ({
      code: JSON.stringify({ $schema: URL, model: 'opus' }),
      filename,
    })),
    // The last of two keys of one name counts.
    {
      code: `{"$schema": "https://example.com/s.json", "$schema": "${URL}"}`,
      filename: project,
    },
    // A hidden drop-in is not a settings file for Claude Code.
    { code: '{}', filename: 'managed-settings.d/.10-x.json' },
    { code: '{"$schema": "x"}', filename: 'etc/managed-settings.d/.10-x.json' },
    // A value that is not an object has no keys. `settings-valid-json` reports it.
    ...ALL.flatMap((filename) => ['[1]', '"x"', 'null', '1'].map((code) => ({ code, filename }))),
  ],
  invalid: [],
})

jsonTester.run('settings-schema-url (invalid)', rule, {
  valid: [],
  invalid: [
    // No `$schema`: one report, at the first brace.
    ...ALL.map((filename) => ({
      code: '{"model": "opus"}',
      filename,
      errors: [{ messageId: 'missing' as const, line: 1, column: 1, endLine: 1, endColumn: 2 }],
    })),
    // An empty object has no `$schema` either. The brace is on line 2 here.
    {
      code: '\n  {}',
      filename: project,
      errors: [{ messageId: 'missing' as const, line: 2, column: 3, endLine: 2, endColumn: 4 }],
    },
    // Another URL, on the value. The check is exact: the old host, a final slash, `http`,
    // another letter case, and a space all fail.
    ...[
      'https://json.schemastore.org/claude-code-settings.json/',
      'http://json.schemastore.org/claude-code-settings.json',
      'https://www.schemastore.org/claude-code-settings.json',
      'https://json.schemastore.org/Claude-Code-Settings.json',
      ` ${URL}`,
      'https://json.schemastore.org/claude-code-keybindings.json',
      '',
    ].flatMap((value) =>
      ALL.map((filename) => ({
        code: `{"$schema": ${JSON.stringify(value)}}`,
        filename,
        errors: [
          {
            messageId: 'wrongUrl' as const,
            line: 1,
            column: 13,
            endColumn: 13 + JSON.stringify(value).length,
          },
        ],
      })),
    ),
    // A value that is not a string, a `null` too, is not the URL.
    ...['1', 'null', 'true', '["x"]', '{}'].map((value) => ({
      code: `{"$schema": ${value}}`,
      filename: project,
      errors: [{ messageId: 'wrongUrl' as const, line: 1, column: 13 }],
    })),
    // The last of two keys of one name counts.
    {
      code: `{"$schema": "${URL}", "$schema": "x"}`,
      filename: project,
      errors: [{ messageId: 'wrongUrl' as const }],
    },
    // A drop-in with the name of a project file is a managed file.
    {
      code: '{}',
      filename: 'managed-settings.d/settings.local.json',
      errors: [{ messageId: 'missing' as const }],
    },
  ],
})
