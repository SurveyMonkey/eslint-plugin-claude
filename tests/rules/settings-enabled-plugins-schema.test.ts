// The rule reads `enabledPlugins` in `.claude/settings.json` and
// `.claude/settings.local.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-enabled-plugins-schema')

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const settings = (enabledPlugins: unknown) => JSON.stringify({ enabledPlugins })

jsonTester.run('settings-enabled-plugins-schema (valid)', rule, {
  valid: [
    { code: settings({ 'formatter@team-tools': true, 'experimental@personal': false }), filename },
    { code: settings({ 'formatter@team-tools': true }), filename: local },
    // The docs use these marketplace names for plugins that come from no marketplace.
    {
      code: settings({ 'hello-plugin@inline': false, 'x@synced': false, 'y@builtin': true }),
      filename,
    },
    { code: settings({}), filename },
    { code: JSON.stringify({ model: 'opus' }), filename },
    // The type of `enabledPlugins` itself is not checked.
    { code: settings('a@b'), filename },
    { code: settings(['a@b']), filename },
    { code: settings(null), filename },
    { code: '[]', filename },
    { code: '"a@b"', filename },
    // Two `enabledPlugins` keys. The rule reads the last, as `JSON.parse` does.
    { code: '{"enabledPlugins": {"bad": 1}, "enabledPlugins": {"a@b": true}}', filename },
    // Two members of one plugin. The last one counts.
    { code: '{"enabledPlugins": {"a@b": 1, "a@b": true}}', filename },
  ],
  invalid: [],
})

jsonTester.run('settings-enabled-plugins-schema (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: settings({ formatter: true }),
      filename,
      errors: [
        { messageId: 'keyForm', data: { key: 'formatter' }, line: 1, column: 20, endColumn: 31 },
      ],
    },
    {
      code: settings({ 'a@b@c': true }),
      filename,
      errors: [{ messageId: 'keyForm', data: { key: 'a@b@c' } }],
    },
    {
      code: settings({ '@b': true }),
      filename,
      errors: [{ messageId: 'keyForm', data: { key: '@b' } }],
    },
    {
      code: settings({ 'a@': true }),
      filename,
      errors: [{ messageId: 'keyForm', data: { key: 'a@' } }],
    },
    {
      code: settings({ '@': true }),
      filename,
      errors: [{ messageId: 'keyForm', data: { key: '@' } }],
    },
    // An empty key has no "@".
    {
      code: settings({ '': true }),
      filename,
      errors: [{ messageId: 'keyForm', data: { key: '' } }],
    },
    {
      code: settings({ 'a@b': 'true' }),
      filename,
      errors: [
        { messageId: 'valueType', data: { key: 'a@b' }, line: 1, column: 26, endColumn: 32 },
      ],
    },
    { code: settings({ 'a@b': 1 }), filename, errors: [{ messageId: 'valueType' }] },
    { code: settings({ 'a@b': null }), filename, errors: [{ messageId: 'valueType' }] },
    { code: settings({ 'a@b': [] }), filename, errors: [{ messageId: 'valueType' }] },
    { code: settings({ 'a@b': {} }), filename, errors: [{ messageId: 'valueType' }] },
    { code: settings({ 'a@b': '' }), filename, errors: [{ messageId: 'valueType' }] },
    // A bad key and a bad value are two faults, so two reports. A good entry gets none.
    {
      code: settings({ x: 'yes', 'ok@m': true }),
      filename,
      errors: [
        { messageId: 'keyForm', data: { key: 'x' } },
        { messageId: 'valueType', data: { key: 'x' } },
      ],
    },
    {
      code: settings({ 'a@b': 1, 'c@d': true, e: true }),
      filename: local,
      errors: [
        { messageId: 'valueType', data: { key: 'a@b' } },
        { messageId: 'keyForm', data: { key: 'e' } },
      ],
    },
    // Two `enabledPlugins` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"enabledPlugins": {"a@b": true}, "enabledPlugins": {"bad": true}}',
      filename,
      errors: [{ messageId: 'keyForm', data: { key: 'bad' } }],
    },
    {
      code: '{"enabledPlugins": {"a@b": true, "a@b": "no", "bad": 1, "bad": 2}}',
      filename,
      errors: [
        { messageId: 'valueType', data: { key: 'a@b' }, column: 41 },
        { messageId: 'keyForm', data: { key: 'bad' } },
        { messageId: 'valueType', data: { key: 'bad' } },
      ],
    },
  ],
})

json5Tester.run('settings-enabled-plugins-schema (JSON5 valid)', rule, {
  valid: [{ code: "{ enabledPlugins: { 'a@b': true, 'c@d': false } }", filename }],
  invalid: [],
})

json5Tester.run('settings-enabled-plugins-schema (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    // A bare key is an identifier, and it has no "@".
    {
      code: '{ enabledPlugins: { bare: true } }',
      filename,
      errors: [{ messageId: 'keyForm', data: { key: 'bare' } }],
    },
    {
      code: "{ enabledPlugins: { 'a@b': 'x' } }",
      filename,
      errors: [{ messageId: 'valueType', data: { key: 'a@b' } }],
    },
  ],
})
