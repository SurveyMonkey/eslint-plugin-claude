// The value that each settings key takes: its type, enum, range and shape. Source: the Type line
// and the field tables of each entry in the settings reference
// (https://code.claude.com/docs/en/settings-reference), checked on Claude Code 2.1.296 on
// 2026-10-10. Review these lists on or before 2027-04-10, the `stale_after` date of
// docs/rules/settings-schema.md. The key catalog is `src/data/settings-keys.ts`.
//
// A key is in `SETTINGS_VALUES` only when `settings-schema` is the one rule that reports its value.
// These keys are not in the table:
// - `permissions`, `sandbox`, `autoMode` and `disableAutoMode`: the rule makes no report there.
//   The rules of the permissions group are not built yet.
// - `env`, `hooks`, `enabledPlugins`, `extraKnownMarketplaces`, `strictKnownMarketplaces`,
//   `blockedMarketplaces`, `pluginConfigs`, the MCP keys and `claudeMd`, `claudeMdExcludes`
//   and `autoMemoryDirectory`: a rule of the group that owns the key checks the value.
// - A key with a rule of its own for any value: the keys of `NO_EFFECT_KEYS`, and the keys with a
//   `reportedBy` entry in `src/data/settings-keys.ts`.
// - A Global config key. `settings-key-scope` reports it in every settings file.
// - `allowedHttpHookUrls` and `httpHookAllowedEnvVars`: the hooks group reads them.
// - The name in `timeZone`. The docs say "an IANA time zone name". The names depend on the ICU
//   data of the machine that runs the rule. The rule checks that the value is a string.

/** What a value must be. The `kind` is the JSON type of an accepted value. */
export type ValueSpec =
  | { kind: 'any' }
  | { kind: 'boolean' }
  | { kind: 'literal'; value: boolean | number | string }
  | {
      kind: 'string'
      maxLength?: number
      /** The words, the form, or both, that a value must fit. A string with no `form` is any text. */
      form?: {
        oneOf?: readonly string[]
        pattern?: RegExp
        /** To finish the sentence "The value must be ...". */
        expected: string
      }
    }
  | ({ kind: 'number'; integer?: boolean } & (
      | { min: number; max?: number }
      /** The value must be above `above`, as in "a fraction greater than 0". */
      | { above: number; max: number }
    ))
  | { kind: 'array'; items: ValueSpec; maxItems?: number }
  | {
      kind: 'object'
      /** The fields. A key that is not here is an unknown key. */
      fields: Readonly<Record<string, ValueSpec>>
      required?: readonly string[]
    }
  | {
      kind: 'map'
      values: ValueSpec
      /** The form of each key. */
      keyPattern?: RegExp
      keyExpected?: string
    }
  | { kind: 'anyOf'; options: readonly ValueSpec[] }

const BOOLEAN: ValueSpec = { kind: 'boolean' }
const STRING: ValueSpec = { kind: 'string' }
const STRINGS: ValueSpec = { kind: 'array', items: STRING }
const words = (...oneOf: string[]): ValueSpec => ({
  kind: 'string',
  form: { oneOf, expected: `one of ${oneOf.map((word) => JSON.stringify(word)).join(', ')}` },
})
const shaped = (pattern: RegExp, expected: string, maxLength?: number): ValueSpec => ({
  kind: 'string',
  form: { pattern, expected },
  ...(maxLength !== undefined && { maxLength }),
})
const whole = (min: number, max?: number): ValueSpec => ({
  kind: 'number',
  integer: true,
  min,
  ...(max !== undefined && { max }),
})

const EFFORT = ['low', 'medium', 'high', 'xhigh']
const TIMEOUTS = ['60s', '5m', '10m', 'never']
const CACHE_TTL = words('5m', '1h')
const COMMAND: ValueSpec = {
  kind: 'object',
  fields: { type: words('command'), command: STRING },
  required: ['type', 'command'],
}
const AUTO_WINDOW: ValueSpec = { kind: 'number', min: 100000, max: 1000000 }
const RATE: ValueSpec = { kind: 'number', min: 0, max: 10000 }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/
const SCHEMES = [
  'https',
  'http',
  'vscode',
  'vscode-insiders',
  'cursor',
  'windsurf',
  'zed',
  'jetbrains',
  'idea',
  'slack',
  'linear',
  'notion',
  'figma',
]
const TIP_ID = /^[A-Za-z0-9._-]{1,64}$/

/** The keys of type Boolean, in the Type line of the settings reference. */
const BOOLEAN_KEYS = [
  'agentPushNotifEnabled',
  'allowAllClaudeAiMcps',
  'allowClaudeInChromeWithManagedMcp',
  'allowManagedHooksOnly',
  'allowManagedMcpServersOnly',
  'allowManagedPermissionRulesOnly',
  'alwaysThinkingEnabled',
  'autoCompactEnabled',
  'autoMemoryEnabled',
  'autoScrollEnabled',
  'awaySummaryEnabled',
  'axScreenReader',
  'bashEditDiffEnabled',
  'channelsEnabled',
  'disableAgentView',
  'disableAllHooks',
  'disableArtifact',
  'disableBrowserExternalNavigation',
  'disableBundledSkills',
  'disableClaudeAiConnectors',
  'disableCommandPluginSources',
  'disableDesktopLocalSessions',
  'disableMobileSimulatorTools',
  'disableRemoteControl',
  'disableSideloadFlags',
  'disableSkillShellExecution',
  'disableWorkflows',
  'emojiCompletionEnabled',
  'enableAllProjectMcpServers',
  'enableArtifact',
  'enableWorkflows',
  'enforceAvailableModels',
  'fastMode',
  'fastModePerSessionOptIn',
  'fileCheckpointingEnabled',
  'forceRemoteSettingsRefresh',
  'includeCoAuthoredBy',
  'includeGitInstructions',
  'inputNeededNotifEnabled',
  'isolatePeerMachines',
  'prefersReducedMotion',
  'promptSuggestionEnabled',
  'remoteControlAtStartup',
  'respectGitignore',
  'respondToBashCommands',
  'showClearContextOnPlanAccept',
  'showThinkingSummaries',
  'showTurnDuration',
  'skipAutoPermissionPrompt',
  'skipDangerousModePermissionPrompt',
  'skipWebFetchPreflight',
  'spinnerTipsEnabled',
  'switchModelsOnFlag',
  'syncClaudeAiSkills',
  'syntaxHighlightingDisabled',
  'terminalProgressBarEnabled',
  'terminalTitleFromRename',
  'ultracode',
  'useAutoModeDuringPlan',
  'verbose',
  'voiceEnabled',
  'wheelScrollAccelerationEnabled',
  'workflowKeywordTriggerEnabled',
  'wslInheritsWindowsSettings',
]

/** The keys of type string with no form in the docs. */
const STRING_KEYS = [
  'advisorModel',
  'agent',
  'apiKeyHelper',
  'awsAuthRefresh',
  'awsCredentialExport',
  'forceLoginGatewayUrl',
  'gcpAuthRefresh',
  'language',
  'model',
  'otelHeadersHelper',
  'outputStyle',
  'pluginTrustMessage',
  'processWrapper',
  'timeZone',
]

/** The keys of type array of strings. */
const STRINGS_KEYS = [
  'appendPlugins',
  'availableModels',
  'companyAnnouncements',
  'deniedModels',
  'fallbackModel',
  'gatewayInternalNetworks',
  'pluginSuggestionMarketplaces',
  'prependPlugins',
  'sshHostAllowlist',
]

/** The shapes, enums, ranges and forms. */
const SHAPES: Record<string, ValueSpec> = {
  allowedChannelPlugins: {
    kind: 'array',
    items: {
      kind: 'anyOf',
      options: [
        {
          kind: 'object',
          fields: { marketplace: STRING, plugin: STRING },
          required: ['marketplace', 'plugin'],
        },
        STRING,
      ],
    },
  },
  allowedProviders: {
    kind: 'array',
    items: words(
      'anthropic',
      'bedrock',
      'vertex',
      'foundry',
      'anthropicAws',
      'mantle',
      'customEndpoint',
      'gateway',
    ),
  },
  askUserQuestionTimeout: words(...TIMEOUTS),
  attribution: {
    kind: 'anyOf',
    options: [
      { kind: 'object', fields: { commit: STRING, pr: STRING, sessionUrl: BOOLEAN } },
      { kind: 'literal', value: false },
    ],
  },
  autoCompactWindow: AUTO_WINDOW,
  autoUpdatesChannel: words('latest', 'stable'),
  availableModelsMatch: words('prefix', 'exact'),
  bashOutputMaxChars: whole(1),
  browserExternalPageTools: shaped(/^disabled?$/i, '"disabled" or "disable", in either case'),
  cleanupPeriodDays: whole(1),
  crossSessionInbound: words('accept', 'hold', 'refuse'),
  defaultShell: words('bash', 'powershell'),
  desktopSessionCleanupPeriodDays: whole(0),
  dialogExpiry: words(...TIMEOUTS),
  disableDeepLinkRegistration: words('disable'),
  editorMode: words('normal', 'vim'),
  effortLevel: words(...EFFORT),
  feedbackDrafts: words('notify', 'quiet', 'off'),
  feedbackSurveyRate: { kind: 'number', min: 0, max: 1 },
  fileSuggestion: COMMAND,
  footerLinksRegexes: {
    kind: 'array',
    items: {
      kind: 'object',
      fields: {
        type: words('regex'),
        pattern: STRING,
        url: shaped(
          new RegExp(`^(?:${SCHEMES.join('|')}):`),
          `a URL with the scheme ${SCHEMES.join(', ')}`,
        ),
        label: STRING,
      },
      required: ['type', 'pattern', 'url'],
    },
  },
  forceLoginMethod: words('claudeai', 'console', 'gateway'),
  forceLoginOrgUUID: {
    kind: 'anyOf',
    options: [shaped(UUID, 'a UUID'), { kind: 'array', items: shaped(UUID, 'a UUID') }],
  },
  managedSourcesBehavior: words('first-wins', 'merge'),
  maxEffortLevel: words(...EFFORT, 'max'),
  maxProseWidth: whole(40),
  minimumVersion: shaped(VERSION, 'a version such as 2.1.100'),
  modelOverrides: { kind: 'map', values: STRING },
  modelPicker: {
    kind: 'object',
    fields: {
      options: {
        kind: 'array',
        items: {
          kind: 'object',
          fields: { model: STRING, label: STRING, description: STRING, behavesAs: STRING },
          required: ['model'],
        },
      },
      replaceBuiltInOptions: BOOLEAN,
    },
  },
  modelPricing: {
    kind: 'object',
    fields: {
      multiplier: { kind: 'number', above: 0, max: 10 },
      overrides: {
        kind: 'map',
        values: {
          kind: 'object',
          fields: { input: RATE, output: RATE, cacheRead: RATE, cacheWrite: RATE },
          required: ['input', 'output', 'cacheRead', 'cacheWrite'],
        },
      },
    },
  },
  modelSettings: {
    kind: 'map',
    values: {
      kind: 'object',
      fields: {
        effortLevel: words(...EFFORT),
        maxEffortLevel: words(...EFFORT, 'max'),
        autoCompactWindow: {
          kind: 'anyOf',
          options: [AUTO_WINDOW, { kind: 'literal', value: 'auto' }],
        },
      },
    },
  },
  parentSettingsBehavior: words('first-wins', 'merge'),
  plansDirectory: shaped(
    /^(?![/\\~]|[A-Za-z]:)(?!(?:.*[/\\])?\.\.(?:[/\\]|$))/,
    'a path inside the project root',
  ),
  policyHelper: {
    kind: 'object',
    fields: {
      path: shaped(
        /^(?:(?!.*(?:\/\/|\/\.\.?(?:\/|$)))\/|(?![\s\S]*[/\\]\.\.?(?:[/\\]|$))(?:[A-Za-z]:[/\\]|\\\\).*\.exe$)/i,
        'an absolute path in normalized form, with a name that ends in .exe on Windows',
      ),
      timeoutMs: whole(1000),
      refreshIntervalMs: { kind: 'anyOf', options: [{ kind: 'literal', value: 0 }, whole(60000)] },
    },
    required: ['path'],
  },
  preferredNotifChannel: words(
    'auto',
    'terminal_bell',
    'iterm2',
    'iterm2_with_bell',
    'kitty',
    'ghostty',
    'notifications_disabled',
  ),
  prUrlTemplate: shaped(
    /^(?:[^{}]|\{(?:host|owner|repo|number|url)\})*$/,
    'a URL with the placeholders {host}, {owner}, {repo}, {number} and {url} only',
  ),
  promptCacheTtl: CACHE_TTL,
  remote: {
    kind: 'object',
    fields: {
      defaultEnvironmentId: shaped(/^(?:env|ccpool)_/, 'an ID that starts with env_ or ccpool_'),
    },
  },
  requiredMaximumVersion: shaped(VERSION, 'a version such as 2.1.150'),
  requiredMinimumVersion: shaped(VERSION, 'a version such as 2.1.150'),
  skillListingBudgetFraction: { kind: 'number', above: 0, max: 1 },
  skillListingMaxDescChars: whole(1),
  skillOverrides: {
    kind: 'map',
    values: words('on', 'name-only', 'user-invocable-only', 'off'),
  },
  spellcheck: {
    kind: 'object',
    fields: {
      enabled: BOOLEAN,
      checker: words('aspell', 'hunspell', 'ispell', 'auto'),
      language: STRING,
      color: STRING,
    },
  },
  spinnerTipsOverride: {
    kind: 'object',
    fields: {
      tips: {
        kind: 'array',
        maxItems: 200,
        items: {
          kind: 'anyOf',
          options: [
            STRING,
            {
              kind: 'object',
              fields: {
                id: shaped(TIP_ID, 'up to 64 letters, digits, ".", "_" or "-"'),
                text: shaped(/^[^\r\n]*$/, 'one line', 500),
                cooldownSessions: whole(0, 1000),
                priority: whole(-10, 10),
              },
              required: ['id', 'text'],
            },
          ],
        },
      },
      tipsFile: shaped(
        /^(?:\/|~\/|[A-Za-z]:[/\\]|\\\\)/,
        'an absolute path or a path that starts with ~/',
      ),
      label: { kind: 'string', maxLength: 40 },
      excludeDefault: BOOLEAN,
    },
  },
  spinnerVerbs: {
    kind: 'object',
    fields: { mode: words('append', 'replace'), verbs: STRINGS },
  },
  sshConfigs: {
    kind: 'array',
    items: {
      kind: 'object',
      fields: {
        id: STRING,
        name: STRING,
        sshHost: STRING,
        sshPort: { kind: 'any' },
        sshIdentityFile: { kind: 'any' },
      },
      required: ['id', 'name', 'sshHost'],
    },
  },
  statusLine: {
    kind: 'object',
    fields: {
      type: words('command'),
      command: STRING,
      padding: { kind: 'number', min: 0 },
      refreshInterval: { kind: 'number', min: 1 },
      hideVimModeIndicator: BOOLEAN,
    },
    required: ['type', 'command'],
  },
  strictPluginOnlyCustomization: {
    kind: 'anyOf',
    options: [
      { kind: 'literal', value: true },
      { kind: 'array', items: STRING },
    ],
  },
  subagentPromptCacheTtl: CACHE_TTL,
  subagentStatusLine: COMMAND,
  teammateMode: words('in-process', 'auto', 'tmux', 'iterm2'),
  theme: {
    kind: 'string',
    form: {
      oneOf: [
        'auto',
        'dark',
        'light',
        'dark-daltonized',
        'light-daltonized',
        'dark-ansi',
        'light-ansi',
      ],
      pattern: /^custom:[^:\s]+(?::[^:\s]+)?$/,
      expected: 'a built-in theme, "custom:<slug>" or "custom:<plugin>:<slug>"',
    },
  },
  timeFormat: {
    kind: 'string',
    form: {
      oneOf: ['auto', '12-hour', '24-hour', '24-hour-utc'],
      pattern: /%/,
      expected: '"auto", "12-hour", "24-hour", "24-hour-utc" or a pattern with %',
    },
  },
  tui: words('default', 'fullscreen'),
  viewMode: words('default', 'verbose', 'focus'),
  vimInsertModeRemaps: {
    kind: 'map',
    keyPattern: /^\P{C}{2}$/u,
    keyExpected: 'exactly two printable characters',
    values: words('<Esc>'),
  },
  voice: {
    kind: 'object',
    fields: { enabled: BOOLEAN, autoSubmit: BOOLEAN, mode: words('hold', 'tap') },
  },
  workflowSizeGuideline: words('unrestricted', 'small', 'medium', 'large'),
  worktree: {
    kind: 'object',
    fields: {
      baseRef: words('fresh', 'head'),
      symlinkDirectories: STRINGS,
      sparsePaths: STRINGS,
      bgIsolation: words('worktree', 'none'),
    },
  },
}

/** The value that each top-level key takes. A key that is not here has no value check. */
export const SETTINGS_VALUES: Readonly<Record<string, ValueSpec>> = {
  ...Object.fromEntries(BOOLEAN_KEYS.map((key) => [key, BOOLEAN])),
  ...Object.fromEntries(STRING_KEYS.map((key) => [key, STRING])),
  ...Object.fromEntries(STRINGS_KEYS.map((key) => [key, STRINGS])),
  ...SHAPES,
}

/** The top-level keys that Claude Code reads and that are not in the settings index. `$schema`
 *  points editors to the JSON schema
 *  (https://code.claude.com/docs/en/settings#settings-files-and-who-they-affect). The settings
 *  reference says that `permissions.deny` replaces the deprecated `ignorePatterns`. The rule
 *  makes no report on that key. */
export const NOT_UNKNOWN_KEYS: readonly string[] = ['$schema', 'ignorePatterns']

/** An environment variable name: capital letters, digits and underscores. Claude Code reads
 *  no settings key of this form. */
export const ENV_NAME_FORM = /^[A-Z][A-Z0-9_]*$/
