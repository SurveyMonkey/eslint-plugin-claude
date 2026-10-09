// The rule reads the top-level keys of a settings file, and the nested keys that the settings
// reference lists. The scope of each key is the Scope column of the settings index
// (https://code.claude.com/docs/en/settings-reference#settings-index). The files glob and the
// managed files are in tests/configs.test.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { settingsKeyScope } from '../../src/data/settings-keys.ts'
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-key-scope')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'

const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)

// A key of each scope, from the index: Managed, User or managed, User, local, or managed, and
// Global config.
const MANAGED_KEY = 'allowManagedHooksOnly'
const USER_OR_MANAGED_KEY = 'modelPicker'
const USER_LOCAL_KEY = 'skipDangerousModePermissionPrompt'
const GLOBAL_KEY = 'autoConnectIde'

jsonTester.run('settings-key-scope (valid)', rule, {
  valid: [
    // A Managed key is for managed files.
    // A drop-in can have the name of a project file. The directory makes it a managed file.
    ...['managed-settings.d/settings.json', 'managed-settings.d/settings.local.json'].map(
      (filename) => ({ code: obj({ [MANAGED_KEY]: true, [USER_OR_MANAGED_KEY]: [] }), filename }),
    ),
    ...[managed, dropIn, 'etc/claude-code/managed-settings.json'].map((filename) => ({
      code: obj({ [MANAGED_KEY]: true }),
      filename,
    })),
    // A User or managed key is for managed files.
    ...[managed, dropIn].map((filename) => ({
      code: obj({ [USER_OR_MANAGED_KEY]: [] }),
      filename,
    })),
    // A User, local, or managed key is for the local file and managed files.
    ...[local, managed, dropIn].map((filename) => ({
      code: obj({ [USER_LOCAL_KEY]: true }),
      filename,
    })),
    // An Any file key is for each file.
    ...ALL.map((filename) => ({
      code: obj({ model: 'opus', env: { A: '1' }, hooks: {} }),
      filename,
    })),
    // A key that the settings reference does not list is for `settings-schema`.
    ...ALL.map((filename) => ({ code: obj({ madeUpKey: 1, 'sandbox.nope': 1 }), filename })),
    // A key inside a value that the rule does not read is not a settings key.
    ...ALL.map((filename) => ({
      code: obj({ env: { [MANAGED_KEY]: '1', [GLOBAL_KEY]: '1' }, hooks: { [MANAGED_KEY]: [] } }),
      filename,
    })),
    // Nested keys. `sandbox.network.allowManagedDomainsOnly` is Managed, and
    // `sandbox.network.allowedDomains` is Any file.
    {
      code: obj({ sandbox: { network: { allowManagedDomainsOnly: true } } }),
      filename: managed,
    },
    {
      code: obj({ sandbox: { network: { allowedDomains: ['a.test'] }, enabled: true } }),
      filename: project,
    },
    { code: obj({ sandbox: { ripgrep: { command: 'rg' } } }), filename: dropIn },
    {
      code: obj({ attribution: { commit: 'x' }, permissions: { allow: [], deny: [] } }),
      filename: local,
    },
    // A top-level key with a dot is one key, not a nested path.
    { code: obj({ 'sandbox.bwrapPath': '/bin/bwrap' }), filename: project },
    { code: obj({ sandbox: { 'network.allowManagedDomainsOnly': true } }), filename: project },
    { code: obj({ 'policyHelper path': 1 }), filename: project },
    // The aliases take the scope of their canonical key.
    { code: obj({ additionalMarketplaces: {} }), filename: project },
    { code: obj({ allowedMarketplaces: [] }), filename: managed },
    { code: obj({ permissions: { disableAutoMode: 'disable' } }), filename: project },
    // `bashEditDiffEnabled` is User or managed, and a `false` in a project file is honored.
    { code: obj({ bashEditDiffEnabled: false }), filename: project },
    { code: obj({ bashEditDiffEnabled: false }), filename: local },
    // The rule reports the Boolean `true` only. A value of another type is for `settings-schema`.
    { code: obj({ bashEditDiffEnabled: 'true' }), filename: project },
    { code: obj({ bashEditDiffEnabled: 1 }), filename: project },
    { code: obj({ bashEditDiffEnabled: true }), filename: managed },
    // `syncClaudeAiPlugins` is for `settings-sync-claude-ai-plugins`: no report in any file.
    ...ALL.flatMap((filename) =>
      [true, false, null, 'x'].map((value) => ({
        code: obj({ syncClaudeAiPlugins: value }),
        filename,
      })),
    ),
    // `autoContinueAtUsageLimit` is for `settings-project-autocontinue-off`, because a project
    // value turns the feature off. It is not ignored.
    ...ALL.map((filename) => ({ code: obj({ autoContinueAtUsageLimit: false }), filename })),
    // A value that is not an object has no keys to read.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    { code: obj({ sandbox: 'x' }), filename: project },
    { code: obj({ sandbox: [{ ripgrep: 1 }] }), filename: project },
    { code: obj({ sandbox: null }), filename: project },
    // Two keys. The rule reads the last. The last `sandbox` has no listed key.
    { code: '{"sandbox": {"ripgrep": 1}, "sandbox": {}}', filename: project },
    { code: `{"${MANAGED_KEY}": 1, "${MANAGED_KEY}": 2}`, filename: managed },
  ],
  invalid: [],
})

jsonTester.run('settings-key-scope (invalid)', rule, {
  valid: [],
  invalid: [
    // A Managed key is a fault in each file that is not a managed file. The report is on the key.
    ...[project, local].map((filename) => ({
      code: obj({ [MANAGED_KEY]: true }),
      filename,
      errors: [{ messageId: 'managedOnly' as const, line: 1, column: 2, endColumn: 25 }],
    })),
    // A User or managed key is a fault in the project files.
    ...[project, local].map((filename) => ({
      code: obj({ [USER_OR_MANAGED_KEY]: [] }),
      filename,
      errors: [{ messageId: 'userOrManaged' as const, line: 1, column: 2 }],
    })),
    // A User, local, or managed key is a fault in `.claude/settings.json` only.
    {
      code: obj({ [USER_LOCAL_KEY]: true }),
      filename: project,
      errors: [{ messageId: 'userLocalOrManaged' }],
    },
    // A Global config key is a fault in each file, a managed file too.
    ...ALL.map((filename) => ({
      code: obj({ [GLOBAL_KEY]: true }),
      filename,
      errors: [{ messageId: 'globalConfig' as const }],
    })),
    // A file in a nested directory is read by its name.
    {
      code: obj({ [MANAGED_KEY]: true }),
      filename: 'packages/app/.claude/settings.local.json',
      errors: [{ messageId: 'managedOnly' }],
    },
    {
      code: obj({ [GLOBAL_KEY]: true }),
      filename: 'deploy/managed-settings.d/20-y.json',
      errors: [{ messageId: 'globalConfig' }],
    },
    // Nested keys. The report is on the nested key.
    {
      code: '{"sandbox": {"network": {"allowManagedDomainsOnly": true}}}',
      filename: project,
      errors: [{ messageId: 'managedOnly', line: 1, column: 26, endColumn: 51 }],
    },
    {
      code: obj({ sandbox: { ripgrep: { command: 'rg' } } }),
      filename: local,
      errors: [{ messageId: 'userOrManaged' }],
    },
    {
      code: obj({ sandbox: { credentials: { sigv4: [] } } }),
      filename: project,
      errors: [{ messageId: 'userOrManaged' }],
    },
    {
      code: obj({ sandbox: { bwrapPath: '/bin/bwrap' } }),
      filename: project,
      errors: [{ messageId: 'managedOnly' }],
    },
    // A key with children reports once, on the parent.
    {
      code: obj({ policyHelper: { path: '/bin/helper', timeoutMs: 1 } }),
      filename: project,
      errors: [{ messageId: 'managedOnly', column: 2 }],
    },
    {
      code: obj({ autoMode: { classifyAllShell: true } }),
      filename: local,
      errors: [{ messageId: 'userOrManaged', column: 2 }],
    },
    // A parent with listed children gets one report, on the parent. The rule does not read below it.
    {
      code: obj({ strictPluginOnlyCustomization: { hooks: true } }),
      filename: local,
      errors: [{ messageId: 'managedOnly', column: 2 }],
    },
    // The aliases take the scope of their canonical key.
    {
      code: obj({ allowedMarketplaces: [] }),
      filename: project,
      errors: [{ messageId: 'managedOnly' }],
    },
    // `bashEditDiffEnabled` is User or managed, and a `true` in a project file does not count.
    ...[project, local].map((filename) => ({
      code: obj({ bashEditDiffEnabled: true }),
      filename,
      errors: [{ messageId: 'userOrManaged' as const }],
    })),
    // The Scope of `syncClaudeAiSkills` and `useAutoModeDuringPlan` is User, local, or managed.
    // The settings page says that Claude Code ignores a `false` in `.claude/settings.json` too.
    ...[true, false].flatMap((value) =>
      ['syncClaudeAiSkills', 'useAutoModeDuringPlan'].map((key) => ({
        code: obj({ [key]: value }),
        filename: project,
        errors: [{ messageId: 'userLocalOrManaged' as const }],
      })),
    ),
    // One report for each key, in file order.
    {
      code: obj({ [GLOBAL_KEY]: 1, model: 'x', [MANAGED_KEY]: 1, syncClaudeAiPlugins: false }),
      filename: project,
      errors: [
        { messageId: 'globalConfig', column: 2 },
        { messageId: 'managedOnly', column: 33 },
      ],
    },
    // Two keys. The rule reads the last, and reports once.
    {
      code: `{"${MANAGED_KEY}": 1, "${MANAGED_KEY}": 2}`,
      filename: project,
      errors: [{ messageId: 'managedOnly', column: 30 }],
    },
    {
      code: '{"sandbox": {}, "sandbox": {"bwrapPath": "/x"}}',
      filename: project,
      errors: [{ messageId: 'managedOnly', column: 29 }],
    },
  ],
})

json5Tester.run('settings-key-scope (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: `{ ${MANAGED_KEY}: true }`,
      filename: project,
      errors: [{ messageId: 'managedOnly' }],
    },
    {
      code: `{ sandbox: { bwrapPath: '/x' } }`,
      filename: local,
      errors: [{ messageId: 'managedOnly' }],
    },
  ],
})

// The text of each message.
jsonTester.run('settings-key-scope (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: obj({ [MANAGED_KEY]: true }),
      filename: project,
      errors: [
        {
          message:
            'Claude Code reads "allowManagedHooksOnly" from managed settings only. It ignores the key in this file.',
        },
      ],
    },
    {
      code: obj({ sandbox: { ripgrep: {} } }),
      filename: local,
      errors: [
        {
          message:
            'Claude Code reads "sandbox.ripgrep" from user and managed settings. It ignores the key in this file.',
        },
      ],
    },
    {
      code: obj({ [USER_LOCAL_KEY]: true }),
      filename: project,
      errors: [
        {
          message:
            'Claude Code ignores "skipDangerousModePermissionPrompt" in .claude/settings.json. It reads the key from user, local and managed settings.',
        },
      ],
    },
    {
      code: obj({ [GLOBAL_KEY]: true }),
      filename: managed,
      errors: [
        {
          message:
            'Claude Code reads "autoConnectIde" from ~/.claude.json only. It ignores the key in this file.',
        },
      ],
    },
  ],
})

// The data module follows the Scope column of the settings index. The snapshot is the reviewed
// copy of that page, so it is a source that the module does not share.
describe('settings-keys data against the settings index snapshot', () => {
  const snapshot = JSON.parse(
    readFileSync(
      path.resolve(import.meta.dirname, '../../docs/docs-snapshot/settings-reference.json'),
      'utf8',
    ),
  ) as { sources: { id: string; text: string }[] }
  const index = snapshot.sources.find(({ id }) => id === 'settings-index')?.text ?? ''
  const SCOPE_OF: Record<string, string> = {
    Managed: 'managed',
    'User or managed': 'user-or-managed',
    'User, local, or managed': 'user-local-or-managed',
    'Global config': 'global',
    'Any file': 'any',
  }
  const rows = [...index.matchAll(/^\| \[`([^`]+)`\].*\| ([^|]+?) \|$/gm)].map(
    ([, key, scope]) => [key ?? '', scope ?? ''] as const,
  )

  it('reads the rows of the index', () => {
    expect(rows.length).toBeGreaterThan(200)
  })

  it('gives each key of the index the scope that the index states', () => {
    const wrong = rows.flatMap(([key, scope]) =>
      settingsKeyScope(key.split('.'))?.scope === SCOPE_OF[scope] ? [] : [`${key}: ${scope}`],
    )
    expect(wrong).toEqual([])
  })
})
