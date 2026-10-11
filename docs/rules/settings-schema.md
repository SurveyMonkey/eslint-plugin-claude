---
type: Reference
description: The ESLint rule claude/settings-schema, which reports a settings key that Claude Code does not know, an environment variable name at the top level, and a value with the wrong type, enum value, range, form or shape, from the key catalog in src/data/settings-keys.ts and the value data in src/data/settings-schema.ts.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-schema`

Set only the settings keys that Claude Code knows, with the values that it accepts.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code shows a Settings Error for a user, project or local file with a value that the schema
rejects.[^broken] The rule finds such a value before the file reaches a teammate. It also finds
a key that Claude Code does not know. The key catalog is the settings index.[^index] The rule
reads the index. It does not use the published JSON schema, which can be older than the newest
release.

### Unknown keys

- **A top-level key that the index does not list** gets `unknownKey`. The report is on the key.
  `$schema` and `ignorePatterns` are the two exceptions. `$schema` points an editor to the JSON
  schema. `ignorePatterns` is a deprecated key. The rule makes no report on it.
- **An environment variable name at the top level** gets `envKey`. The switches that turn off
  usage metrics, error reports and the auto-updater are environment variables, not
  keys.[^privacy][^channel] Set them in `env`. A name is a capital letter, then capital letters,
  digits and underscores. An unknown key of another form gets `unknownKey`.
- **An unknown field inside a documented object** gets `unknownKey`, with the path of the
  field. The objects are `attribution`, `statusLine`, `subagentStatusLine`, `fileSuggestion`,
  `voice`, `spinnerVerbs`, `spinnerTipsOverride`, `spellcheck`, `worktree`, `remote`,
  `policyHelper`, `modelPicker`, `modelPricing`, the entries of `modelSettings`, and the rows of
  the arrays below. A map, such as `modelOverrides`, `skillOverrides` and `env`, has no fixed
  keys.

A top-level key with a dot in its name is one key. `"sandbox.bwrapPath"` at the top level is an
unknown key. The alias keys of the index are known keys.

### Values

An invalid value is a report on the value. The message names the key by its path, such as
`spinnerTipsOverride.tips[0].priority`. A `null` is no value, and the rule makes no report on it.

| Message | The value |
|---------|-----------|
| `wrongType` | Is not of the JSON type that the Type line gives. |
| `notOneOf` | Is not one of the listed words, or not one of the alternatives of a key. |
| `outOfRange` | Is outside the range, is not a whole number, or is longer than the limit. |
| `badFormat` | Does not fit the form that the docs give. |
| `missingField` | Is an object that lacks a required field. A field with a `null` is missing. |

The data is in `src/data/settings-schema.ts`, with the Claude Code version and the date of the
last review. The kinds of value are below.

- **Boolean keys.** Each key that the Type line gives as Boolean. A managed key that "takes the
  JSON Boolean `true` only" is a Boolean key too. The string `"true"` is a `wrongType`
  report.[^index]
- **String and array keys.** `model`, `advisorModel`, `language`, `outputStyle`, `agent` and the
  helper commands are strings. `availableModels`, `fallbackModel`, `deniedModels`,
  `companyAnnouncements` and `sshHostAllowlist` are arrays of strings. `modelOverrides` is an
  object of strings. The rule checks the type. The model rules check the text.
- **Enums.** `effortLevel`, `maxEffortLevel`, `availableModelsMatch`, `promptCacheTtl`,
  `subagentPromptCacheTtl`, `askUserQuestionTimeout`, `dialogExpiry`, `defaultShell`,
  `editorMode`, `tui`, `viewMode`, `teammateMode`, `workflowSizeGuideline`, `skillOverrides`
  values, `crossSessionInbound`, `autoUpdatesChannel`, `feedbackDrafts`, `forceLoginMethod`,
  `preferredNotifChannel`, `managedSourcesBehavior`, `parentSettingsBehavior`,
  `allowedProviders`, `worktree.baseRef`, `worktree.bgIsolation`, `spellcheck.checker`,
  `voice.mode`, `spinnerVerbs.mode` and `disableDeepLinkRegistration`.
- **Ranges.** `autoCompactWindow` (100000 to 1000000, also under `modelSettings`),
  `bashOutputMaxChars` (a positive whole number), `skillListingBudgetFraction` (above 0, at most
  1), `skillListingMaxDescChars`, `maxProseWidth` (at least 40), `cleanupPeriodDays` (at least
  1), `desktopSessionCleanupPeriodDays` (at least 0), `feedbackSurveyRate` (0 to 1),
  `statusLine.padding`, `statusLine.refreshInterval` (at least 1), `modelPricing.multiplier`
  (above 0, at most 10), each `modelPricing` rate (0 to 10000), `policyHelper.timeoutMs` (at least
  1000), `policyHelper.refreshIntervalMs` (`0` or at least 60000), and the fields of a tip.
- **Shapes.** `attribution` is an object or `false`. `statusLine`, `subagentStatusLine` and
  `fileSuggestion` need `type: "command"` and `command`. `modelPicker` rows need `model`.
  `modelPricing` rows need `input`, `output`, `cacheRead` and `cacheWrite`.
  `footerLinksRegexes` rows need `type`, `pattern` and `url`. `sshConfigs` rows need `id`, `name`
  and `sshHost`. `allowedChannelPlugins` rows are `{marketplace, plugin}`, or a
  `plugin@marketplace` string. `strictPluginOnlyCustomization` is `true` or an array of strings,
  because Claude Code ignores a name that it does not know. `policyHelper` needs `path`.
  `forceLoginOrgUUID` is a UUID or an array of UUIDs. `appendPlugins`, `prependPlugins` and the
  string rows of `allowedChannelPlugins` fit `plugin@marketplace`. `gatewayInternalNetworks` has
  at most four IPv4 CIDR blocks, each `/8` to `/32`.[^statusline][^picker][^pricing][^footer][^strict][^plugins][^gateway]
- **Forms.** `theme`, `timeFormat`, `minimumVersion`, `requiredMinimumVersion`,
  `requiredMaximumVersion`, `plansDirectory`, `prUrlTemplate`, `remote.defaultEnvironmentId`,
  `browserExternalPageTools`, `policyHelper.path`, `vimInsertModeRemaps` and the tips of
  `spinnerTipsOverride`. The message names the form.[^theme][^time][^plans][^policy][^policypath][^vim][^tips]

A version fits the form `N.N.N`, with an optional pre-release or build part. The rule accepts the
two spellings `disabled` and `disable` for `browserExternalPageTools`, in either case, as the
entry says.

### Reports left to other rules

One fault gets one report. The rule makes no report in these places.

- **Inside `permissions` or `sandbox`.** The rule reads neither key. The permissions group has
  the rules for them. `permissions-schema` and `sandbox-schema` are not built yet. The rule also
  makes no report on `autoMode`, `disableAutoMode` and `ignorePatterns`, or on anything inside
  them, whatever the type.
- **A scope fault.** `settings-key-scope` reports a key in a file that Claude Code does not read
  it from. This rule still checks the value of that key. A Global config key is the exception:
  the scope rule reports it in every settings file.
- **A key with a rule of its own.** The rule checks no value of `taskOutputMaxChars`,
  `keybindingFlavor`, `permissionExplainerEnabled` and `teammateDefaultModel`, which
  `settings-removed-key` reports for any value. It also skips `syncClaudeAiPlugins`, which
  `settings-sync-claude-ai-plugins` reports. It skips `autoContinueAtUsageLimit` too. The rule
  `settings-project-autocontinue-off` owns that key, and is not built yet.
- **The text of a model.** `settings-model-value` checks the alias or ID in `model` and
  `advisorModel`. `settings-model-list` checks the lists. This rule checks the types only.
- **A value of another group.** The inventory gives these keys to the group that owns them. This
  rule checks their names, and no more. `settings-env-value-format` checks `env`.
  `settings-enabled-plugins-schema` checks `enabledPlugins`. `settings-extra-known-marketplaces-schema`
  and `settings-known-marketplaces-policy-schema` check the marketplace keys. The rows for `hooks`,
  `pluginConfigs`, the MCP keys, `claudeMd`, `claudeMdExcludes` and `autoMemoryDirectory` are not
  built yet.

### What the rule does not check

- A hidden file in `managed-settings.d/`. Claude Code ignores it, so the rule reads no key in it.
- The name in `timeZone`. The docs say "an IANA time zone name". The names depend on the ICU data
  of the machine. The rule checks only that the value is a string.
- A backslash inside a segment of `plansDirectory`. Claude Code uses the default directory for it
  on macOS, Linux and WSL. The path works on Windows.
- The `{name}` placeholders of `footerLinksRegexes` against the named groups of `pattern`.
- The uniqueness of tip IDs. Claude Code uses the first of two.
- The normal form of a Windows `policyHelper.path`, apart from `.` and `..` segments.
- Overlap between the blocks of `gatewayInternalNetworks`, and overlap with private space.
- A model alias that a version of Claude Code does not know. See `settings-model-value`.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "modle": "opus",
  "DISABLE_TELEMETRY": "1",
  "fastMode": "true",
  "autoCompactWindow": 5,
  "worktree": { "base": "head" },
  "statusLine": { "type": "command" }
}
```

Pass:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "opus",
  "env": { "DISABLE_TELEMETRY": "1" },
  "fastMode": true,
  "autoCompactWindow": 200000,
  "worktree": { "baseRef": "head" },
  "statusLine": { "type": "command", "command": "~/.claude/status.sh" }
}
```

## Sources

[^index]: [All settings: Settings index](https://code.claude.com/docs/en/settings-reference#settings-index)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
[^privacy]: [All settings: Privacy and telemetry](https://code.claude.com/docs/en/settings-reference#privacy-and-telemetry)
[^channel]: [All settings: autoUpdatesChannel](https://code.claude.com/docs/en/settings-reference#autoupdateschannel)
[^statusline]: [All settings: statusLine](https://code.claude.com/docs/en/settings-reference#statusline)
[^picker]: [All settings: modelPicker](https://code.claude.com/docs/en/settings-reference#modelpicker)
[^pricing]: [All settings: modelPricing](https://code.claude.com/docs/en/settings-reference#modelpricing)
[^footer]: [All settings: footerLinksRegexes](https://code.claude.com/docs/en/settings-reference#footerlinksregexes)
[^strict]: [All settings: strictPluginOnlyCustomization](https://code.claude.com/docs/en/settings-reference#strictpluginonlycustomization)
[^theme]: [All settings: theme](https://code.claude.com/docs/en/settings-reference#theme)
[^time]: [All settings: timeFormat](https://code.claude.com/docs/en/settings-reference#timeformat)
[^plans]: [All settings: plansDirectory](https://code.claude.com/docs/en/settings-reference#plansdirectory)
[^policy]: [All settings: policyHelper](https://code.claude.com/docs/en/settings-reference#policyhelper)
[^policypath]: [All settings: policyHelper.path](https://code.claude.com/docs/en/settings-reference#policyhelper-path)
[^plugins]: [All settings: appendPlugins](https://code.claude.com/docs/en/settings-reference#appendplugins)
[^gateway]: [All settings: gatewayInternalNetworks](https://code.claude.com/docs/en/settings-reference#gatewayinternalnetworks)
[^vim]: [All settings: vimInsertModeRemaps](https://code.claude.com/docs/en/settings-reference#viminsertmoderemaps)
[^tips]: [All settings: spinnerTipsOverride](https://code.claude.com/docs/en/settings-reference#spinnertipsoverride)
