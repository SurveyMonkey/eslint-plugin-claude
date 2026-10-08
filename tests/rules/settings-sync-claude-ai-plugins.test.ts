// The rule reads `syncClaudeAiPlugins` in `.claude/settings.json` and
// `.claude/settings.local.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import plugin from '../../src/index.ts'
import { json5Tester, jsonTester } from '../rule-tester.test-support.ts'

// Red first: the rule is not in the plugin yet, so a stub with no checks stands in for it, and
// each case in an `invalid` block must fail. The rule commit removes the stub and the marks.
const rule = plugin.rules['settings-sync-claude-ai-plugins'] ?? {
  meta: { schema: [], messages: {} },
  create: () => ({}),
}
let red = false
Object.assign(RuleTester, {
  describe: (title: string, factory: () => void) =>
    describe(title, () => {
      const before = red
      red = title === 'invalid' || before
      try {
        factory()
      } finally {
        red = before
      }
    }),
  it: (title: string, test: () => void) => (red ? it.fails : it)(title, test),
})

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const sync = (value: unknown) => JSON.stringify({ syncClaudeAiPlugins: value })

jsonTester.run('settings-sync-claude-ai-plugins (valid)', rule, {
  valid: [
    // Claude Code honors `false` in the local file.
    { code: sync(false), filename: local },
    // Nothing to read.
    { code: JSON.stringify({ model: 'opus' }), filename: project },
    { code: JSON.stringify({ model: 'opus' }), filename: local },
    { code: '{}', filename: local },
    { code: '[]', filename: project },
    { code: '"syncClaudeAiPlugins"', filename: project },
    // A key inside a value is not the key.
    { code: JSON.stringify({ env: { syncClaudeAiPlugins: true } }), filename: project },
    { code: JSON.stringify({ env: { syncClaudeAiPlugins: true } }), filename: local },
    // The docs give the type as Boolean, and the rule reports `true` only. A value of another
    // type in the local file gives no report.
    { code: sync('true'), filename: local },
    { code: sync(1), filename: local },
    { code: sync(null), filename: local },
    { code: sync(''), filename: local },
    { code: sync([true]), filename: local },
    // The skills key is another setting.
    { code: JSON.stringify({ syncClaudeAiSkills: true }), filename: project },
    // Two keys. The rule reads the last.
    { code: '{"syncClaudeAiPlugins": true, "syncClaudeAiPlugins": false}', filename: local },
  ],
  invalid: [],
})

jsonTester.run('settings-sync-claude-ai-plugins (invalid)', rule, {
  valid: [],
  invalid: [
    // In the project file, Claude Code ignores the key for any value. The report is on the key.
    {
      code: sync(false),
      filename: project,
      errors: [{ messageId: 'ignoredInProject', line: 1, column: 2, endColumn: 23 }],
    },
    ...[true, null, 'true', 1, '', [], {}].map((value) => ({
      code: sync(value),
      filename: project,
      errors: [{ messageId: 'ignoredInProject' as const }],
    })),
    // `true` in the project file is one report: the file-level one.
    {
      code: '{"model": "opus", "syncClaudeAiPlugins": true}',
      filename: project,
      errors: [{ messageId: 'ignoredInProject', column: 19 }],
    },
    // In the local file, `true` is the same as unset. The report is on the value.
    {
      code: sync(true),
      filename: local,
      errors: [{ messageId: 'trueIsUnset', line: 1, column: 24, endColumn: 28 }],
    },
    // Two keys. The rule reads the last.
    {
      code: '{"syncClaudeAiPlugins": false, "syncClaudeAiPlugins": true}',
      filename: local,
      errors: [{ messageId: 'trueIsUnset', column: 55 }],
    },
    {
      code: '{"syncClaudeAiPlugins": 1, "syncClaudeAiPlugins": 2}',
      filename: project,
      errors: [{ messageId: 'ignoredInProject', column: 28 }],
    },
  ],
})

json5Tester.run('settings-sync-claude-ai-plugins (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: '{ syncClaudeAiPlugins: false }',
      filename: project,
      errors: [{ messageId: 'ignoredInProject' }],
    },
    {
      code: '{ syncClaudeAiPlugins: true }',
      filename: local,
      errors: [{ messageId: 'trueIsUnset' }],
    },
  ],
})
