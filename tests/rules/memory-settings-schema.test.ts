// The memory keys of a settings file, with the types and values that the settings reference gives
// (https://code.claude.com/docs/en/settings-reference#automemoryenabled). The files glob is in
// tests/configs.test.ts. The values of `instructionFiles` are the four of the memory page.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('memory-settings-schema')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'

const settings = (value: object) => JSON.stringify(value)
const instruction = (value: unknown, id = 'cc-plugin-agents-md@builtin') =>
  settings({ pluginConfigs: { [id]: { options: { instructionFiles: value } } } })
const wrongType = (key: string, expected: string) => ({
  messageId: 'wrongType' as const,
  data: { key, expected },
})
const ALLOWED = '"claude-md-or-agents-md", "claude-md-and-agents-md", "claude-md", "managed-only"'

jsonTester.run('memory-settings-schema', rule, {
  valid: [
    { code: '{}', filename: project },
    // The examples of the docs.
    { code: settings({ autoMemoryEnabled: false }), filename: project },
    { code: settings({ autoMemoryEnabled: true }), filename: local },
    { code: settings({ autoMemoryDirectory: '~/my-memory-dir' }), filename: project },
    { code: settings({ autoMemoryDirectory: '~/my-custom-memory-dir' }), filename: managed },
    { code: settings({ claudeMdExcludes: ['**/vendor/**/CLAUDE.md'] }), filename: project },
    { code: settings({ claudeMdExcludes: [] }), filename: project },
    // Each form of an absolute directory.
    { code: settings({ autoMemoryDirectory: '/var/memory' }), filename: project },
    { code: settings({ autoMemoryDirectory: 'C:\\memory' }), filename: project },
    { code: settings({ autoMemoryDirectory: 'd:/memory' }), filename: project },
    { code: settings({ autoMemoryDirectory: '\\\\server\\share\\memory' }), filename: project },
    // Each value of `instructionFiles`, under each ID of the built-in plugin.
    ...['claude-md-or-agents-md', 'claude-md-and-agents-md', 'claude-md', 'managed-only'].flatMap(
      (value) => [
        { code: instruction(value), filename: managed },
        { code: instruction(value, 'agents-md@builtin'), filename: dropIn },
      ],
    ),
    // A key that is unset reads as absent.
    {
      code: '{"autoMemoryEnabled": null, "autoMemoryDirectory": null, "claudeMdExcludes": null, "pluginConfigs": null}',
      filename: project,
    },
    { code: instruction(null), filename: managed },
    // Other plugins, and other options of the built-in plugin, are not read.
    {
      code: settings({
        pluginConfigs: { 'deployer@acme-tools': { options: { instructionFiles: 1 } } },
      }),
      filename: managed,
    },
    {
      code: settings({
        pluginConfigs: { 'cc-plugin-agents-md@builtin': { options: { other: 1 } } },
      }),
      filename: managed,
    },
    // A shape above `instructionFiles` that is not an object is not this rule's fault.
    { code: settings({ pluginConfigs: [] }), filename: managed },
    { code: settings({ pluginConfigs: { 'agents-md@builtin': 1 } }), filename: managed },
    {
      code: settings({ pluginConfigs: { 'agents-md@builtin': { options: [] } } }),
      filename: managed,
    },
    { code: '[1]', filename: project },
    // The last of two keys of one name counts, as in `JSON.parse`.
    { code: '{"autoMemoryEnabled": 1, "autoMemoryEnabled": true}', filename: project },
    // A hidden drop-in is ignored by Claude Code, so no report.
    { code: settings({ autoMemoryEnabled: 'x' }), filename: 'managed-settings.d/.20-hidden.json' },
  ],
  invalid: [
    // `autoMemoryEnabled`.
    {
      code: '{"autoMemoryEnabled": "false"}',
      filename: project,
      errors: [
        { ...wrongType('autoMemoryEnabled', 'a Boolean'), line: 1, column: 23, endColumn: 30 },
      ],
    },
    {
      code: settings({ autoMemoryEnabled: 0 }),
      filename: local,
      errors: [wrongType('autoMemoryEnabled', 'a Boolean')],
    },
    {
      code: settings({ autoMemoryEnabled: {} }),
      filename: managed,
      errors: [wrongType('autoMemoryEnabled', 'a Boolean')],
    },
    // `autoMemoryDirectory`: not a string, and not an absolute or home path.
    {
      code: settings({ autoMemoryDirectory: 5 }),
      filename: project,
      errors: [wrongType('autoMemoryDirectory', 'a string')],
    },
    {
      code: settings({ autoMemoryDirectory: ['~/m'] }),
      filename: project,
      errors: [wrongType('autoMemoryDirectory', 'a string')],
    },
    ...['memory', './memory', '../memory', '~', '~user/memory', '', 'C:memory', '\\memory'].map(
      (directory) => ({
        code: settings({ autoMemoryDirectory: directory }),
        filename: project,
        errors: [{ messageId: 'directoryForm' as const }],
      }),
    ),
    // `claudeMdExcludes`: not an array, and an entry that is not a string.
    {
      code: settings({ claudeMdExcludes: '**/a/CLAUDE.md' }),
      filename: project,
      errors: [wrongType('claudeMdExcludes', 'an array of strings')],
    },
    {
      code: settings({ claudeMdExcludes: { a: 1 } }),
      filename: project,
      errors: [wrongType('claudeMdExcludes', 'an array of strings')],
    },
    {
      code: '{"claudeMdExcludes": ["**/a/**", 1, null, ["x"]]}',
      filename: dropIn,
      errors: [
        { messageId: 'entryType', line: 1, column: 34 },
        { messageId: 'entryType' },
        { messageId: 'entryType' },
      ],
    },
    // `instructionFiles`: an unknown value, and a value of another type, under each ID.
    {
      code: instruction('both'),
      filename: managed,
      errors: [{ messageId: 'instructionFiles', data: { allowed: ALLOWED } }],
    },
    {
      code: instruction('CLAUDE-MD', 'agents-md@builtin'),
      filename: managed,
      errors: [{ messageId: 'instructionFiles' }],
    },
    { code: instruction(true), filename: dropIn, errors: [{ messageId: 'instructionFiles' }] },
    {
      code: instruction(['claude-md']),
      filename: managed,
      errors: [{ messageId: 'instructionFiles' }],
    },
    { code: instruction(''), filename: managed, errors: [{ messageId: 'instructionFiles' }] },
    // The two IDs give one report each.
    {
      code: settings({
        pluginConfigs: {
          'cc-plugin-agents-md@builtin': { options: { instructionFiles: 'a' } },
          'agents-md@builtin': { options: { instructionFiles: 'b' } },
        },
      }),
      filename: managed,
      errors: [{ messageId: 'instructionFiles' }, { messageId: 'instructionFiles' }],
    },
    // One file with a fault in each key.
    {
      code: settings({
        autoMemoryEnabled: 'no',
        autoMemoryDirectory: 'memory',
        claudeMdExcludes: 'x',
        pluginConfigs: { 'agents-md@builtin': { options: { instructionFiles: 'x' } } },
      }),
      filename: managed,
      errors: [
        { messageId: 'wrongType' },
        { messageId: 'directoryForm' },
        { messageId: 'wrongType' },
        { messageId: 'instructionFiles' },
      ],
    },
    // The last of two keys of one name counts.
    {
      code: '{"autoMemoryEnabled": true, "autoMemoryEnabled": 1}',
      filename: project,
      errors: [wrongType('autoMemoryEnabled', 'a Boolean')],
    },
  ],
})

// The text of each message.
jsonTester.run('memory-settings-schema (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: settings({ autoMemoryEnabled: 1 }),
      filename: project,
      errors: [{ message: '"autoMemoryEnabled" must be a Boolean.' }],
    },
    {
      code: settings({ autoMemoryDirectory: 'memory' }),
      filename: project,
      errors: [{ message: '"autoMemoryDirectory" must be an absolute path or start with "~/".' }],
    },
    {
      code: settings({ claudeMdExcludes: [1] }),
      filename: project,
      errors: [{ message: 'Each "claudeMdExcludes" entry must be a string.' }],
    },
    {
      code: instruction('x'),
      filename: managed,
      errors: [{ message: `"instructionFiles" must be one of ${ALLOWED}.` }],
    },
  ],
})
