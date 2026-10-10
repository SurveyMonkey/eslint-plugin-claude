// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference): the settings index and the Type line and
// field tables of each entry, and the settings page for `$schema`.
import { describe, expect, it } from 'vitest'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-schema')

const project = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const ALL = [project, local, managed, dropIn]
const obj = (value: object) => JSON.stringify(value)

type Data = Record<string, string>
type Expected = {
  messageId: string
  data: Data
  line?: number
  column?: number
  endColumn?: number
}
const err = (messageId: string, data: Data): Expected => ({ messageId, data })
const unknown = (key: string) => err('unknownKey', { key })
const type = (key: string, expected: string) => err('wrongType', { key, expected })
const oneOf = (key: string, expected: string) => err('notOneOf', { key, expected })
const range = (key: string, expected: string) => err('outOfRange', { key, expected })
const format = (key: string, expected: string) => err('badFormat', { key, expected })
const missing = (key: string, field: string) => err('missingField', { key, field })

/** One invalid case in the project file. */
const bad = (value: unknown, ...errors: Expected[]) => ({
  code: typeof value === 'string' ? value : obj(value as object),
  filename: project,
  errors,
})

const words = (list: string[]) => `one of ${list.map((word) => `"${word}"`).join(', ')}`
const REGEX_ROW = { type: 'regex', pattern: 'a', url: 'https://x.example/{a}' }

jsonTester.run('settings-schema (valid)', rule, {
  valid: [
    // A file that sets keys of many kinds with the values that the docs give.
    ...ALL.map((filename) => ({
      code: obj({
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        model: 'opus',
        effortLevel: 'xhigh',
        maxEffortLevel: 'max',
        alwaysThinkingEnabled: true,
        availableModels: ['sonnet', 'opus'],
        fallbackModel: ['opus'],
        modelOverrides: { 'claude-opus-4-8': 'arn:aws:bedrock:x' },
        modelSettings: {
          'claude-opus-5-5': {
            effortLevel: 'high',
            maxEffortLevel: 'max',
            autoCompactWindow: 'auto',
          },
          other: { autoCompactWindow: 200000 },
        },
        modelPicker: {
          options: [
            { model: 'opus', label: 'Opus', description: 'x', behavesAs: 'claude-opus-4-8' },
          ],
          replaceBuiltInOptions: true,
        },
        modelPricing: {
          multiplier: 0.85,
          overrides: { m: { input: 2.4, output: 12, cacheRead: 0, cacheWrite: 10000 } },
        },
        attribution: { commit: 'x', pr: '', sessionUrl: false },
        statusLine: {
          type: 'command',
          command: 'x',
          padding: 0,
          refreshInterval: 1,
          hideVimModeIndicator: true,
        },
        subagentStatusLine: { type: 'command', command: 'x' },
        fileSuggestion: { type: 'command', command: 'x' },
        voice: { enabled: true, autoSubmit: false, mode: 'tap' },
        spinnerVerbs: { mode: 'append', verbs: ['Pondering'] },
        spellcheck: { enabled: true, checker: 'auto', language: 'en_US', color: '#ff0000' },
        worktree: {
          baseRef: 'fresh',
          symlinkDirectories: ['node_modules'],
          sparsePaths: ['src'],
          bgIsolation: 'none',
        },
        skillOverrides: { review: 'name-only', 'p:s': 'off' },
        vimInsertModeRemaps: { jj: '<Esc>', ';;': '<Esc>' },
        footerLinksRegexes: [{ ...REGEX_ROW, label: '{a}' }],
        sshConfigs: [
          { id: 'a', name: 'b', sshHost: 'c', sshPort: 22, sshIdentityFile: '~/.ssh/x' },
        ],
        remote: { defaultEnvironmentId: 'env_1' },
        companyAnnouncements: ['hello'],
        autoCompactWindow: 100000,
        bashOutputMaxChars: 4000,
        skillListingBudgetFraction: 1,
        skillListingMaxDescChars: 1,
        maxProseWidth: 40,
        cleanupPeriodDays: 1,
        desktopSessionCleanupPeriodDays: 0,
        feedbackSurveyRate: 0,
        plansDirectory: 'plans/today',
        prUrlTemplate: '{host}/{owner}/{repo}/pull/{number}?u={url}',
        minimumVersion: '2.1.100',
        forceLoginOrgUUID: ['123e4567-e89b-12d3-a456-426614174000'],
        theme: 'custom:acme:night',
        timeFormat: '%H:%M',
        timeZone: 'Nowhere/Land',
        language: 'japanese',
        tui: 'fullscreen',
        viewMode: 'focus',
        editorMode: 'vim',
        autoUpdatesChannel: 'stable',
        promptCacheTtl: '1h',
        subagentPromptCacheTtl: '5m',
        teammateMode: 'iterm2',
        workflowSizeGuideline: 'unrestricted',
        preferredNotifChannel: 'notifications_disabled',
        defaultShell: 'powershell',
        dialogExpiry: 'never',
        askUserQuestionTimeout: '60s',
        crossSessionInbound: 'refuse',
        feedbackDrafts: 'quiet',
        disableDeepLinkRegistration: 'disable',
      }),
      filename,
    })),
    // The managed keys, with the values that the docs give.
    ...ALL.map((filename) => ({
      code: obj({
        availableModelsMatch: 'exact',
        browserExternalPageTools: 'DISABLE',
        disableBrowserExternalNavigation: true,
        forceLoginMethod: 'gateway',
        forceLoginOrgUUID: '123E4567-E89B-12D3-A456-426614174000',
        managedSourcesBehavior: 'merge',
        parentSettingsBehavior: 'first-wins',
        policyHelper: { path: '/opt/policy-helper', timeoutMs: 1000, refreshIntervalMs: 0 },
        requiredMaximumVersion: '2.1.150',
        requiredMinimumVersion: '2.2.0-beta.1',
        strictPluginOnlyCustomization: ['skills', 'agents', 'hooks', 'mcp'],
        allowedProviders: ['anthropic', 'bedrock', 'customEndpoint'],
        allowedChannelPlugins: [
          { marketplace: 'm', plugin: 'p' },
          'telegram@claude-plugins-official',
        ],
        sshHostAllowlist: ['*.example.com'],
        pluginSuggestionMarketplaces: ['m'],
        deniedModels: ['best'],
      }),
      filename,
    })),
    // The edge of each range, and the longest allowed text.
    ...ALL.map((filename) => ({
      code: obj({
        autoCompactWindow: 1000000,
        skillListingBudgetFraction: 0.5,
        feedbackSurveyRate: 1,
        modelPricing: { multiplier: 10 },
        policyHelper: { path: 'C:\\Tools\\helper.exe', timeoutMs: 5000, refreshIntervalMs: 60000 },
        spinnerTipsOverride: {
          tips: [
            { id: 'a'.repeat(64), text: 'x'.repeat(500), cooldownSessions: 1000, priority: -10 },
            { id: 'A.b_c-1', text: 'x', cooldownSessions: 0, priority: 10 },
            'a plain tip',
          ],
          tipsFile: '~/tips.json',
          label: 'x'.repeat(40),
          excludeDefault: true,
        },
        strictPluginOnlyCustomization: true,
        attribution: false,
      }),
      filename,
    })),
    {
      code: obj({ spinnerTipsOverride: { tips: Array(200).fill('x'), tipsFile: '/tips.json' } }),
      filename: project,
    },
    { code: obj({ policyHelper: { path: '\\\\server\\share\\helper.exe' } }), filename: managed },
    { code: obj({ plansDirectory: 'a..b/c' }), filename: project },
    // Each form of `timeFormat` and `theme`.
    ...['auto', '12-hour', '24-hour', '24-hour-utc', '%H:%M', 'at %H'].map((timeFormat) => ({
      code: obj({ timeFormat }),
      filename: project,
    })),
    ...[
      'auto',
      'dark',
      'light',
      'dark-daltonized',
      'light-daltonized',
      'dark-ansi',
      'light-ansi',
      'custom:x',
    ].map((theme) => ({ code: obj({ theme }), filename: project })),
    // The rule makes no report inside `permissions` or `sandbox`: the permissions group owns them.
    ...ALL.map((filename) => ({
      code: obj({
        permissions: { allow: 'x', unknownField: 1, defaultMode: 'nonsense' },
        sandbox: { enabled: 'yes', network: { bogus: [] }, nope: 1 },
      }),
      filename,
    })),
    ...ALL.map((filename) => ({ code: obj({ permissions: [], sandbox: 'x' }), filename })),
    // A key that another rule owns, in any shape.
    ...ALL.map((filename) => ({
      code: obj({
        taskOutputMaxChars: 'x',
        keybindingFlavor: 1,
        permissionExplainerEnabled: 'x',
        teammateDefaultModel: 5,
        syncClaudeAiPlugins: 'x',
        autoContinueAtUsageLimit: 'x',
        env: [],
        hooks: 'x',
        enabledPlugins: [],
        extraKnownMarketplaces: 1,
        strictKnownMarketplaces: 'x',
        blockedMarketplaces: 'x',
        pluginConfigs: 'x',
        allowedMcpServers: 'x',
        deniedMcpServers: 'x',
        managedMcpServers: 'x',
        enabledMcpjsonServers: 'x',
        disabledMcpjsonServers: 'x',
        allowedHttpHookUrls: 'x',
        httpHookAllowedEnvVars: 'x',
        claudeMd: 5,
        claudeMdExcludes: 5,
        autoMemoryDirectory: 5,
        autoMode: 5,
        disableAutoMode: 5,
        ignorePatterns: 5,
      }),
      filename,
    })),
    // A Global config key. `settings-key-scope` reports it.
    ...ALL.map((filename) => ({
      code: obj({ diffTool: 5, copyOnSelect: 'x', autoConnectIde: [] }),
      filename,
    })),
    // The alias of a key that the rules for marketplaces read.
    ...ALL.map((filename) => ({
      code: obj({ additionalMarketplaces: 1, allowedMarketplaces: 1 }),
      filename,
    })),
    // `timeZone` takes any string here: the rule does not check the name.
    { code: obj({ timeZone: 5 }), filename: project },
    // A `null` is no value.
    ...ALL.map((filename) => ({
      code: obj({
        fastMode: null,
        model: null,
        statusLine: null,
        autoCompactWindow: null,
        theme: null,
        availableModels: null,
        attribution: null,
        modelSettings: { m: null },
        spellcheck: { enabled: null },
        worktree: { baseRef: null, symlinkDirectories: [null] },
        voice: null,
      }),
      filename,
    })),
    // A required field that is `null` is missing: see the invalid cases. A required key of an
    // object that is `null` is not read.
    { code: obj({ statusLine: null, modelPicker: { options: null } }), filename: project },
    // A key inside a value that the rule does not read is no settings key.
    ...ALL.map((filename) => ({
      code: obj({ env: { modle: 1 }, hooks: { modle: [] }, skillOverrides: { modle: 'on' } }),
      filename,
    })),
    // A key of the names of `Object.prototype` is inside a map, not an unknown key.
    ...ALL.map((filename) => ({
      code: obj({ modelOverrides: { constructor: 'x', toString: 'y' } }),
      filename,
    })),
    // The last of two keys of one name counts, as in `JSON.parse`.
    {
      code: '{"fastMode": "x", "fastMode": true, "effortLevel": "none", "effortLevel": "low"}',
      filename: project,
    },
    { code: '{"worktree": {"baseRef": "x", "baseRef": "fresh"}}', filename: project },
    // A `null` value after a bad value removes the key.
    { code: '{"fastMode": "x", "fastMode": null}', filename: project },
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    {
      code: obj({ modle: 1, fastMode: 'x', DISABLE_TELEMETRY: '1' }),
      filename: 'managed-settings.d/.10-x.json',
    },
    { code: obj({ modle: 1 }), filename: 'etc/managed-settings.d/.10-x.json' },
    // A top-level value that is not an object has no keys.
    ...ALL.flatMap((filename) =>
      ['[1]', '"x"', 'null', '1', 'true'].map((code) => ({ code, filename })),
    ),
    // A nested key with the name of a top-level key is a field of its object.
    {
      code: obj({ statusLine: { type: 'command', command: 'x' }, voice: { mode: 'hold' } }),
      filename: project,
    },
  ],
  invalid: [],
})

jsonTester.run('settings-schema (unknown keys)', rule, {
  valid: [],
  invalid: [
    // A top-level key that Claude Code does not know, in each file that the rule reads.
    ...ALL.map((filename) => ({
      code: obj({ modle: 'opus' }),
      filename,
      errors: [{ ...unknown('modle'), line: 1, column: 2, endColumn: 9 }],
    })),
    // A key of the names of `Object.prototype` is no settings key.
    bad(
      '{"constructor": 1, "__proto__": 2, "toString": 3}',
      unknown('constructor'),
      unknown('__proto__'),
      unknown('toString'),
    ),
    // A dotted name at the top level is one key, not a nested key.
    bad(
      { 'sandbox.bwrapPath': '/x', 'worktree.baseRef': 'head' },
      unknown('sandbox.bwrapPath'),
      unknown('worktree.baseRef'),
    ),
    // A key of the wrong letter case.
    bad(
      { Model: 'opus', 'enable-all': true, disable_telemetry: '1' },
      unknown('Model'),
      unknown('enable-all'),
      unknown('disable_telemetry'),
    ),
    // Two keys of one name give one report, on the last.
    bad('{"modle": 1, "modle": 2}', { ...unknown('modle'), column: 14 }),
    // An environment variable name at the top level belongs in `env`.
    ...[
      'DISABLE_TELEMETRY',
      'DISABLE_AUTOUPDATER',
      'ANTHROPIC_API_KEY',
      'TMPDIR',
      'A1',
      'CLAUDE_CODE_2',
    ].map((key) => bad(obj({ [key]: '1' }), err('envKey', { key }))),
    // A name that is not in the form of an environment variable is an unknown key.
    bad(
      obj({ A: 1, '1A': 1, 'A-B': 1, Ab: 1 }),
      err('envKey', { key: 'A' }),
      unknown('1A'),
      unknown('A-B'),
      unknown('Ab'),
    ),
    // A key that the settings index lists only under `permissions` or `sandbox` is not at the top.
    bad(
      obj({ allow: ['Bash'], defaultMode: 'plan', enabled: true }),
      unknown('allow'),
      unknown('defaultMode'),
      unknown('enabled'),
    ),
    // An unknown field inside each documented object, with its path.
    bad({ attribution: { co: 'x' } }, unknown('attribution.co')),
    bad({ statusLine: { type: 'command', command: 'x', pad: 1 } }, unknown('statusLine.pad')),
    bad(
      { subagentStatusLine: { type: 'command', command: 'x', pad: 1 } },
      unknown('subagentStatusLine.pad'),
    ),
    bad(
      { fileSuggestion: { type: 'command', command: 'x', timeout: 1 } },
      unknown('fileSuggestion.timeout'),
    ),
    bad({ voice: { on: true } }, unknown('voice.on')),
    bad({ spinnerVerbs: { words: [] } }, unknown('spinnerVerbs.words')),
    bad({ spellcheck: { dictionary: 'x' } }, unknown('spellcheck.dictionary')),
    bad({ worktree: { base: 'head' } }, unknown('worktree.base')),
    bad({ remote: { environmentId: 'env_1' } }, unknown('remote.environmentId')),
    bad({ policyHelper: { retries: 1 } }, unknown('policyHelper.retries')),
    bad({ modelPicker: { rows: [] } }, unknown('modelPicker.rows')),
    bad(
      { modelPicker: { options: [{ model: 'x', icon: 'y' }] } },
      unknown('modelPicker.options[0].icon'),
    ),
    bad({ modelPricing: { markup: 2 } }, unknown('modelPricing.markup')),
    bad(
      {
        modelPricing: {
          overrides: { m: { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, batch: 1 } },
        },
      },
      unknown('modelPricing.overrides.m.batch'),
    ),
    bad({ modelSettings: { m: { speed: 'fast' } } }, unknown('modelSettings.m.speed')),
    bad({ spinnerTipsOverride: { tip: [] } }, unknown('spinnerTipsOverride.tip')),
    bad(
      { spinnerTipsOverride: { tips: [{ id: 'a', text: 'b', weight: 1 }] } },
      unknown('spinnerTipsOverride.tips[0].weight'),
    ),
    bad(
      { footerLinksRegexes: [{ ...REGEX_ROW, color: 'red' }] },
      unknown('footerLinksRegexes[0].color'),
    ),
    bad(
      { sshConfigs: [{ id: 'a', name: 'b', sshHost: 'c', sshUser: 'd' }] },
      unknown('sshConfigs[0].sshUser'),
    ),
    bad(
      { allowedChannelPlugins: [{ marketplace: 'm', plugin: 'p', extra: 1 }] },
      unknown('allowedChannelPlugins[0].extra'),
    ),
  ],
})

jsonTester.run('settings-schema (types)', rule, {
  valid: [],
  invalid: [
    // A key typed Boolean, with a string, a number and an array.
    bad(
      { fastMode: 'true' },
      { ...type('fastMode', 'a Boolean'), line: 1, column: 13, endColumn: 19 },
    ),
    bad(
      { alwaysThinkingEnabled: 1, verbose: [], disableAllHooks: {} },
      type('alwaysThinkingEnabled', 'a Boolean'),
      type('verbose', 'a Boolean'),
      type('disableAllHooks', 'a Boolean'),
    ),
    // A managed key that takes the JSON Boolean `true` only.
    bad(
      {
        disableBrowserExternalNavigation: 'true',
        disableMobileSimulatorTools: 1,
        disableDesktopLocalSessions: 'yes',
      },
      type('disableBrowserExternalNavigation', 'a Boolean'),
      type('disableMobileSimulatorTools', 'a Boolean'),
      type('disableDesktopLocalSessions', 'a Boolean'),
    ),
    // The Boolean keys that other groups name, and `disableArtifact` with a value that is not a Boolean.
    bad(
      {
        disableArtifact: 'false',
        includeCoAuthoredBy: 'no',
        voiceEnabled: 1,
        enableAllProjectMcpServers: 'true',
        allowManagedHooksOnly: 'x',
      },
      type('disableArtifact', 'a Boolean'),
      type('includeCoAuthoredBy', 'a Boolean'),
      type('voiceEnabled', 'a Boolean'),
      type('enableAllProjectMcpServers', 'a Boolean'),
      type('allowManagedHooksOnly', 'a Boolean'),
    ),
    // A string key.
    bad(
      {
        model: 5,
        advisorModel: true,
        language: [],
        outputStyle: {},
        agent: 1,
        apiKeyHelper: 1,
        pluginTrustMessage: 1,
      },
      type('model', 'a string'),
      type('advisorModel', 'a string'),
      type('language', 'a string'),
      type('outputStyle', 'a string'),
      type('agent', 'a string'),
      type('apiKeyHelper', 'a string'),
      type('pluginTrustMessage', 'a string'),
    ),
    // An array of strings.
    bad({ availableModels: 'opus' }, type('availableModels', 'an array')),
    bad(
      {
        fallbackModel: ['opus', 1],
        deniedModels: [[]],
        companyAnnouncements: [true],
        sshHostAllowlist: [null, {}],
      },
      type('fallbackModel[1]', 'a string'),
      type('deniedModels[0]', 'a string'),
      type('companyAnnouncements[0]', 'a string'),
      type('sshHostAllowlist[1]', 'a string'),
    ),
    // An object of strings.
    bad({ modelOverrides: { a: 1 } }, type('modelOverrides.a', 'a string')),
    bad({ modelOverrides: [] }, type('modelOverrides', 'an object')),
    // A shape with the wrong type.
    bad({ statusLine: 'echo' }, type('statusLine', 'an object')),
    bad({ attribution: 5 }, type('attribution', 'an object or false')),
    bad(
      { attribution: { commit: 1, pr: true, sessionUrl: 'x' } },
      type('attribution.commit', 'a string'),
      type('attribution.pr', 'a string'),
      type('attribution.sessionUrl', 'a Boolean'),
    ),
    bad({ forceLoginOrgUUID: 5 }, type('forceLoginOrgUUID', 'a UUID or an array')),
    bad(
      { strictPluginOnlyCustomization: 'skills' },
      type('strictPluginOnlyCustomization', 'true or an array'),
    ),
    bad(
      { modelSettings: { m: 1 }, spinnerVerbs: [], voice: 'on' },
      type('modelSettings.m', 'an object'),
      type('spinnerVerbs', 'an object'),
      type('voice', 'an object'),
    ),
    bad(
      { modelSettings: { m: { autoCompactWindow: true } } },
      type('modelSettings.m.autoCompactWindow', 'a number from 100000 to 1000000 or "auto"'),
    ),
    bad(
      { spinnerTipsOverride: { tips: [5] } },
      type('spinnerTipsOverride.tips[0]', 'a string or an object'),
    ),
    bad({ spinnerTipsOverride: { tips: 'a' } }, type('spinnerTipsOverride.tips', 'an array')),
    bad(
      { policyHelper: { refreshIntervalMs: 'never' } },
      type('policyHelper.refreshIntervalMs', '0 or a whole number of at least 60000'),
    ),
    bad(
      { allowedChannelPlugins: [5, [], { marketplace: 1, plugin: 'p' }] },
      type('allowedChannelPlugins[0]', 'an object or a string'),
      type('allowedChannelPlugins[1]', 'an object or a string'),
      type('allowedChannelPlugins[2].marketplace', 'a string'),
    ),
    bad({ footerLinksRegexes: {} }, type('footerLinksRegexes', 'an array')),
    bad({ sshConfigs: ['a'] }, type('sshConfigs[0]', 'an object')),
    bad(
      { worktree: { symlinkDirectories: 'a', sparsePaths: [1] } },
      type('worktree.symlinkDirectories', 'an array'),
      type('worktree.sparsePaths[0]', 'a string'),
    ),
    bad(
      { modelPicker: { options: [{ model: 5 }], replaceBuiltInOptions: 'yes' } },
      type('modelPicker.options[0].model', 'a string'),
      type('modelPicker.replaceBuiltInOptions', 'a Boolean'),
    ),
    bad({ vimInsertModeRemaps: [] }, type('vimInsertModeRemaps', 'an object')),
    bad(
      { disableDeepLinkRegistration: true },
      type('disableDeepLinkRegistration', 'one of "disable"'),
    ),
    bad(
      { autoCompactWindow: '200000', bashOutputMaxChars: true, feedbackSurveyRate: [] },
      type('autoCompactWindow', 'a number from 100000 to 1000000'),
      type('bashOutputMaxChars', 'a whole number of at least 1'),
      type('feedbackSurveyRate', 'a number from 0 to 1'),
    ),
    bad({ editorMode: 1 }, type('editorMode', 'one of "normal", "vim"')),
  ],
})

jsonTester.run('settings-schema (enums)', rule, {
  valid: [],
  invalid: [
    bad(
      { editorMode: 'emacs' },
      { ...oneOf('editorMode', words(['normal', 'vim'])), line: 1, column: 15, endColumn: 22 },
    ),
    bad({ effortLevel: 'max' }, oneOf('effortLevel', words(['low', 'medium', 'high', 'xhigh']))),
    bad(
      { maxEffortLevel: 'ultra' },
      oneOf('maxEffortLevel', words(['low', 'medium', 'high', 'xhigh', 'max'])),
    ),
    bad(
      { availableModelsMatch: 'regex' },
      oneOf('availableModelsMatch', words(['prefix', 'exact'])),
    ),
    bad(
      { promptCacheTtl: '30m', subagentPromptCacheTtl: '1d' },
      oneOf('promptCacheTtl', words(['5m', '1h'])),
      oneOf('subagentPromptCacheTtl', words(['5m', '1h'])),
    ),
    bad(
      { askUserQuestionTimeout: '1m', dialogExpiry: 'soon' },
      oneOf('askUserQuestionTimeout', words(['60s', '5m', '10m', 'never'])),
      oneOf('dialogExpiry', words(['60s', '5m', '10m', 'never'])),
    ),
    bad({ defaultShell: 'zsh' }, oneOf('defaultShell', words(['bash', 'powershell']))),
    bad({ tui: 'classic' }, oneOf('tui', words(['default', 'fullscreen']))),
    bad({ viewMode: 'compact' }, oneOf('viewMode', words(['default', 'verbose', 'focus']))),
    bad(
      { teammateMode: 'screen' },
      oneOf('teammateMode', words(['in-process', 'auto', 'tmux', 'iterm2'])),
    ),
    bad(
      { workflowSizeGuideline: 'huge' },
      oneOf('workflowSizeGuideline', words(['unrestricted', 'small', 'medium', 'large'])),
    ),
    bad(
      { skillOverrides: { s: 'maybe', t: 'on' } },
      oneOf('skillOverrides.s', words(['on', 'name-only', 'user-invocable-only', 'off'])),
    ),
    bad(
      { crossSessionInbound: 'ignore' },
      oneOf('crossSessionInbound', words(['accept', 'hold', 'refuse'])),
    ),
    bad({ autoUpdatesChannel: 'beta' }, oneOf('autoUpdatesChannel', words(['latest', 'stable']))),
    bad({ feedbackDrafts: 'on' }, oneOf('feedbackDrafts', words(['notify', 'quiet', 'off']))),
    bad(
      { forceLoginMethod: 'sso' },
      oneOf('forceLoginMethod', words(['claudeai', 'console', 'gateway'])),
    ),
    bad(
      { preferredNotifChannel: 'sound' },
      oneOf(
        'preferredNotifChannel',
        words([
          'auto',
          'terminal_bell',
          'iterm2',
          'iterm2_with_bell',
          'kitty',
          'ghostty',
          'notifications_disabled',
        ]),
      ),
    ),
    bad(
      { managedSourcesBehavior: 'last-wins', parentSettingsBehavior: 'replace' },
      oneOf('managedSourcesBehavior', words(['first-wins', 'merge'])),
      oneOf('parentSettingsBehavior', words(['first-wins', 'merge'])),
    ),
    bad(
      { worktree: { baseRef: 'main', bgIsolation: 'sandbox' } },
      oneOf('worktree.baseRef', words(['fresh', 'head'])),
      oneOf('worktree.bgIsolation', words(['worktree', 'none'])),
    ),
    bad(
      { spellcheck: { checker: 'enchant' } },
      oneOf('spellcheck.checker', words(['aspell', 'hunspell', 'ispell', 'auto'])),
    ),
    bad(
      { voice: { mode: 'toggle' }, spinnerVerbs: { mode: 'prepend' } },
      oneOf('voice.mode', words(['hold', 'tap'])),
      oneOf('spinnerVerbs.mode', words(['append', 'replace'])),
    ),
    bad(
      { disableDeepLinkRegistration: 'enable' },
      oneOf('disableDeepLinkRegistration', words(['disable'])),
    ),
    bad(
      { allowedProviders: ['openai', 'bedrock'] },
      oneOf(
        'allowedProviders[0]',
        words([
          'anthropic',
          'bedrock',
          'vertex',
          'foundry',
          'anthropicAws',
          'mantle',
          'customEndpoint',
          'gateway',
        ]),
      ),
    ),
    bad(
      { strictPluginOnlyCustomization: ['skills', 'plugins'] },
      oneOf('strictPluginOnlyCustomization[1]', words(['skills', 'agents', 'hooks', 'mcp'])),
    ),
    bad({ strictPluginOnlyCustomization: false }, oneOf('strictPluginOnlyCustomization', 'true')),
    bad({ attribution: true }, oneOf('attribution', 'false')),
    bad(
      { vimInsertModeRemaps: { jj: '<Tab>' } },
      oneOf('vimInsertModeRemaps.jj', words(['<Esc>'])),
    ),
    bad(
      { modelSettings: { m: { effortLevel: 'max', maxEffortLevel: 'extreme' } } },
      oneOf('modelSettings.m.effortLevel', words(['low', 'medium', 'high', 'xhigh'])),
      oneOf('modelSettings.m.maxEffortLevel', words(['low', 'medium', 'high', 'xhigh', 'max'])),
    ),
    bad(
      { modelSettings: { m: { autoCompactWindow: 'manual' } } },
      oneOf('modelSettings.m.autoCompactWindow', '"auto"'),
    ),
    bad(
      { policyHelper: { refreshIntervalMs: 1 } },
      oneOf('policyHelper.refreshIntervalMs', '0 or a whole number of at least 60000'),
    ),
    bad(
      { theme: 'solarized' },
      oneOf('theme', 'a built-in theme, "custom:<slug>" or "custom:<plugin>:<slug>"'),
    ),
    bad(
      { theme: 'custom:' },
      oneOf('theme', 'a built-in theme, "custom:<slug>" or "custom:<plugin>:<slug>"'),
    ),
    bad(
      { theme: 'custom:a:b:c' },
      oneOf('theme', 'a built-in theme, "custom:<slug>" or "custom:<plugin>:<slug>"'),
    ),
    bad(
      { timeFormat: '24h' },
      oneOf('timeFormat', '"auto", "12-hour", "24-hour", "24-hour-utc" or a pattern with %'),
    ),
  ],
})

jsonTester.run('settings-schema (ranges)', rule, {
  valid: [],
  invalid: [
    bad(
      { autoCompactWindow: 99999 },
      {
        ...range('autoCompactWindow', 'a number from 100000 to 1000000'),
        column: 22,
        endColumn: 27,
      },
    ),
    bad(
      { autoCompactWindow: 1000001 },
      range('autoCompactWindow', 'a number from 100000 to 1000000'),
    ),
    bad(
      { modelSettings: { m: { autoCompactWindow: 5 } } },
      range('modelSettings.m.autoCompactWindow', 'a number from 100000 to 1000000'),
    ),
    bad({ bashOutputMaxChars: 0 }, range('bashOutputMaxChars', 'a whole number of at least 1')),
    bad({ bashOutputMaxChars: 1.5 }, range('bashOutputMaxChars', 'a whole number of at least 1')),
    bad(
      { skillListingBudgetFraction: 0 },
      range('skillListingBudgetFraction', 'a number above 0 and at most 1'),
    ),
    bad(
      { skillListingBudgetFraction: 1.01 },
      range('skillListingBudgetFraction', 'a number above 0 and at most 1'),
    ),
    bad(
      { skillListingMaxDescChars: 0 },
      range('skillListingMaxDescChars', 'a whole number of at least 1'),
    ),
    bad({ maxProseWidth: 39 }, range('maxProseWidth', 'a whole number of at least 40')),
    bad({ maxProseWidth: 80.5 }, range('maxProseWidth', 'a whole number of at least 40')),
    bad({ cleanupPeriodDays: 0 }, range('cleanupPeriodDays', 'a whole number of at least 1')),
    bad(
      { desktopSessionCleanupPeriodDays: -1 },
      range('desktopSessionCleanupPeriodDays', 'a whole number of at least 0'),
    ),
    bad({ feedbackSurveyRate: -0.1 }, range('feedbackSurveyRate', 'a number from 0 to 1')),
    bad({ feedbackSurveyRate: 1.1 }, range('feedbackSurveyRate', 'a number from 0 to 1')),
    bad(
      { statusLine: { type: 'command', command: 'x', padding: -1, refreshInterval: 0 } },
      range('statusLine.padding', 'a whole number of at least 0'),
      range('statusLine.refreshInterval', 'a whole number of at least 1'),
    ),
    bad(
      { modelPricing: { multiplier: 0 } },
      range('modelPricing.multiplier', 'a number above 0 and at most 10'),
    ),
    bad(
      { modelPricing: { multiplier: 10.5 } },
      range('modelPricing.multiplier', 'a number above 0 and at most 10'),
    ),
    bad(
      {
        modelPricing: {
          overrides: { m: { input: -1, output: 10001, cacheRead: 0, cacheWrite: 0 } },
        },
      },
      range('modelPricing.overrides.m.input', 'a number from 0 to 10000'),
      range('modelPricing.overrides.m.output', 'a number from 0 to 10000'),
    ),
    bad(
      { policyHelper: { timeoutMs: 999 } },
      range('policyHelper.timeoutMs', 'a whole number of at least 1000'),
    ),
    bad(
      { policyHelper: { refreshIntervalMs: 59999 } },
      oneOf('policyHelper.refreshIntervalMs', '0 or a whole number of at least 60000'),
    ),
    bad(
      {
        spinnerTipsOverride: {
          tips: [
            { id: 'a', text: 'b', cooldownSessions: 1001, priority: 11 },
            { id: 'c', text: 'd', cooldownSessions: -1, priority: -11 },
          ],
        },
      },
      range('spinnerTipsOverride.tips[0].cooldownSessions', 'a whole number from 0 to 1000'),
      range('spinnerTipsOverride.tips[0].priority', 'a whole number from -10 to 10'),
      range('spinnerTipsOverride.tips[1].cooldownSessions', 'a whole number from 0 to 1000'),
      range('spinnerTipsOverride.tips[1].priority', 'a whole number from -10 to 10'),
    ),
    bad(
      { spinnerTipsOverride: { tips: [{ id: 'a', text: 'b', priority: 0.5 }] } },
      range('spinnerTipsOverride.tips[0].priority', 'a whole number from -10 to 10'),
    ),
    bad(
      { spinnerTipsOverride: { tips: Array(201).fill('x') } },
      range('spinnerTipsOverride.tips', 'an array of at most 200 entries'),
    ),
    bad(
      {
        spinnerTipsOverride: { tips: [{ id: 'a', text: 'x'.repeat(501) }], label: 'x'.repeat(41) },
      },
      range('spinnerTipsOverride.tips[0].text', 'a string of at most 500 characters'),
      range('spinnerTipsOverride.label', 'a string of at most 40 characters'),
    ),
  ],
})

jsonTester.run('settings-schema (forms)', rule, {
  valid: [],
  invalid: [
    bad(
      {
        minimumVersion: 'latest',
        requiredMinimumVersion: '2.1',
        requiredMaximumVersion: 'v2.1.150',
      },
      format('minimumVersion', 'a version such as 2.1.100'),
      format('requiredMinimumVersion', 'a version such as 2.1.150'),
      format('requiredMaximumVersion', 'a version such as 2.1.150'),
    ),
    bad({ forceLoginOrgUUID: 'org-1' }, format('forceLoginOrgUUID', 'a UUID')),
    bad(
      { forceLoginOrgUUID: ['123e4567-e89b-12d3-a456-426614174000', 'x'] },
      format('forceLoginOrgUUID[1]', 'a UUID'),
    ),
    ...[
      '/abs/plans',
      '\\plans',
      '~/plans',
      'C:\\plans',
      'c:/plans',
      '../plans',
      'a/../../b',
      'a\\..',
      '..',
    ].map((value) =>
      bad({ plansDirectory: value }, format('plansDirectory', 'a path inside the project root')),
    ),
    bad(
      { prUrlTemplate: 'https://{host}/{org}/{repo}' },
      format(
        'prUrlTemplate',
        'a URL with the placeholders {host}, {owner}, {repo}, {number} and {url} only',
      ),
    ),
    bad(
      { prUrlTemplate: 'https://x/{host' },
      format(
        'prUrlTemplate',
        'a URL with the placeholders {host}, {owner}, {repo}, {number} and {url} only',
      ),
    ),
    bad(
      { remote: { defaultEnvironmentId: 'abc' } },
      format('remote.defaultEnvironmentId', 'an ID that starts with env_ or ccpool_'),
    ),
    bad({ browserExternalPageTools: 'enabled' }, format('browserExternalPageTools', '"disabled"')),
    ...[
      'relative/helper',
      '/a/../b',
      '/a/./b',
      '/a//b',
      '/a/..',
      'C:\\Tools\\helper',
      'D:\\a\\..\\b.exe',
      '\\\\server\\a\\.\\b.exe',
      'helper.exe',
    ].map((value) =>
      bad(
        { policyHelper: { path: value } },
        format(
          'policyHelper.path',
          'an absolute path in normalized form, ending in .exe on Windows',
        ),
      ),
    ),
    bad(
      {
        footerLinksRegexes: [
          { ...REGEX_ROW, url: 'ftp://x/{a}' },
          { ...REGEX_ROW, url: 'x.example/{a}' },
        ],
      },
      format(
        'footerLinksRegexes[0].url',
        'a URL with the scheme https, http, vscode, vscode-insiders, cursor, windsurf, zed, jetbrains, idea, slack, linear, notion, figma',
      ),
      format(
        'footerLinksRegexes[1].url',
        'a URL with the scheme https, http, vscode, vscode-insiders, cursor, windsurf, zed, jetbrains, idea, slack, linear, notion, figma',
      ),
    ),
    bad(
      { footerLinksRegexes: [{ ...REGEX_ROW, type: 'glob' }] },
      oneOf('footerLinksRegexes[0].type', words(['regex'])),
    ),
    bad(
      { spinnerTipsOverride: { tipsFile: 'tips.json' } },
      format('spinnerTipsOverride.tipsFile', 'an absolute path or a path that starts with ~/'),
    ),
    bad(
      {
        spinnerTipsOverride: {
          tips: [
            { id: 'bad id', text: 'b' },
            { id: 'x'.repeat(65), text: 'b' },
            { id: '', text: 'b' },
          ],
        },
      },
      format('spinnerTipsOverride.tips[0].id', 'up to 64 letters, digits, ".", "_" or "-"'),
      format('spinnerTipsOverride.tips[1].id', 'up to 64 letters, digits, ".", "_" or "-"'),
      format('spinnerTipsOverride.tips[2].id', 'up to 64 letters, digits, ".", "_" or "-"'),
    ),
    bad(
      {
        spinnerTipsOverride: {
          tips: [
            { id: 'a', text: 'two\nlines' },
            { id: 'b', text: 'a\rb' },
          ],
        },
      },
      format('spinnerTipsOverride.tips[0].text', 'one line'),
      format('spinnerTipsOverride.tips[1].text', 'one line'),
    ),
    bad(
      { vimInsertModeRemaps: { j: '<Esc>', jjj: '<Esc>', '': '<Esc>', 'j\u0007': '<Esc>' } },
      format('vimInsertModeRemaps.j', 'exactly two printable characters'),
      format('vimInsertModeRemaps.jjj', 'exactly two printable characters'),
      format('vimInsertModeRemaps.', 'exactly two printable characters'),
      format('vimInsertModeRemaps.j\u0007', 'exactly two printable characters'),
    ),
  ],
})

jsonTester.run('settings-schema (shapes)', rule, {
  valid: [],
  invalid: [
    // A missing field is a report on the object, with the path of the object.
    bad(
      { statusLine: {} },
      { ...missing('statusLine', 'type'), line: 1, column: 15, endColumn: 17 },
      missing('statusLine', 'command'),
    ),
    bad({ statusLine: { type: 'command' } }, missing('statusLine', 'command')),
    bad(
      { subagentStatusLine: { command: 'x' }, fileSuggestion: { type: 'command' } },
      missing('subagentStatusLine', 'type'),
      missing('fileSuggestion', 'command'),
    ),
    // A field that is `null` is missing.
    bad({ statusLine: { type: 'command', command: null } }, missing('statusLine', 'command')),
    bad(
      { statusLine: { type: 'prompt', command: 'x' } },
      oneOf('statusLine.type', words(['command'])),
    ),
    bad(
      { modelPicker: { options: [{ label: 'x' }, { model: 'ok' }] } },
      missing('modelPicker.options[0]', 'model'),
    ),
    bad(
      { modelPricing: { overrides: { m: { input: 1 } } } },
      missing('modelPricing.overrides.m', 'output'),
      missing('modelPricing.overrides.m', 'cacheRead'),
      missing('modelPricing.overrides.m', 'cacheWrite'),
    ),
    bad(
      { footerLinksRegexes: [{}] },
      missing('footerLinksRegexes[0]', 'type'),
      missing('footerLinksRegexes[0]', 'pattern'),
      missing('footerLinksRegexes[0]', 'url'),
    ),
    bad(
      { sshConfigs: [{ id: 'a' }] },
      missing('sshConfigs[0]', 'name'),
      missing('sshConfigs[0]', 'sshHost'),
    ),
    bad(
      { spinnerTipsOverride: { tips: [{ text: 'b' }, { id: 'a' }] } },
      missing('spinnerTipsOverride.tips[0]', 'id'),
      missing('spinnerTipsOverride.tips[1]', 'text'),
    ),
    bad(
      { allowedChannelPlugins: [{ marketplace: 'm' }] },
      missing('allowedChannelPlugins[0]', 'plugin'),
    ),
  ],
})

describe('settings-schema reports by the real linter', () => {
  it('reports a key in each file that the rule reads, and in no hidden drop-in', () => {
    const run = (filename: string) =>
      lintJson('settings-schema', obj({ modle: 1 }), filename).map((m) => m.messageId)
    expect(run('/repo/.claude/settings.json')).toEqual(['unknownKey'])
    expect(run('/repo/managed-settings.d/20-x.json')).toEqual(['unknownKey'])
    expect(run('/repo/managed-settings.d/.20-x.json')).toEqual([])
  })
})
