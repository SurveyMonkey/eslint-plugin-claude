// The scope of each settings key: the files that Claude Code reads the key
// from. Source: the Scope column of the settings index in the settings
// reference (https://code.claude.com/docs/en/settings-reference#settings-index),
// checked on Claude Code 2.1.295 on 2026-10-08. Review these lists on or
// before 2027-04-08, the `stale_after` date of docs/rules/settings-key-scope.md.
// A nested key is dotted, as in the index.
//
// The index has four keys that Appendix A.1 of docs/rules-inventory.md lacks:
// `allowClaudeInChromeWithManagedMcp` and `allowedProviders` (Managed), and
// `appendPlugins` and `prependPlugins` (User or managed).

/** Where Claude Code reads a key. "user-or-managed" means user and managed
 *  settings, and a `--settings` file. */
type Scope = 'managed' | 'user-or-managed' | 'user-local-or-managed' | 'global' | 'any'

/** What a rule needs to know about a key. */
export interface KeyScope {
  scope: Scope
  /** A key that a repository file can still set. Claude Code ignores only this
   *  Boolean value there. The settings reference says that a `false` in
   *  `bashEditDiffEnabled` in a project file still counts. */
  flaggedValue?: boolean
  /** The rule that reports this key in a repository file, when it is not the
   *  scope rule. The scope rule makes no report on the key. */
  reportedBy?: string
}

/** Scope "Managed": Claude Code reads the key from managed settings only. */
const MANAGED_ONLY: readonly string[] = [
  'allowAllClaudeAiMcps',
  'allowClaudeInChromeWithManagedMcp',
  'allowedChannelPlugins',
  'allowedProviders',
  'allowManagedHooksOnly',
  'allowManagedMcpServersOnly',
  'allowManagedPermissionRulesOnly',
  'availableModelsMatch',
  'blockedMarketplaces',
  'browserExternalPageTools',
  'channelsEnabled',
  'claudeMd',
  'deniedModels',
  'disableBrowserExternalNavigation',
  'disableCommandPluginSources',
  'disableDesktopLocalSessions',
  'disableMobileSimulatorTools',
  'disableSideloadFlags',
  'forceLoginGatewayUrl',
  'forceRemoteSettingsRefresh',
  'gatewayInternalNetworks',
  'managedMcpServers',
  'managedSourcesBehavior',
  'modelPricing',
  'parentSettingsBehavior',
  'pluginSuggestionMarketplaces',
  'pluginTrustMessage',
  'policyHelper',
  'policyHelper.path',
  'policyHelper.refreshIntervalMs',
  'policyHelper.timeoutMs',
  'requiredMaximumVersion',
  'requiredMinimumVersion',
  'sandbox.bwrapPath',
  'sandbox.filesystem.allowManagedReadPathsOnly',
  'sandbox.network.allowManagedDomainsOnly',
  'sandbox.socatPath',
  'sshHostAllowlist',
  'strictKnownMarketplaces',
  'strictPluginOnlyCustomization',
  'strictPluginOnlyCustomization.agents',
  'strictPluginOnlyCustomization.hooks',
  'strictPluginOnlyCustomization.mcp',
  'strictPluginOnlyCustomization.skills',
  'wslInheritsWindowsSettings',
]

/** Scope "User or managed": Claude Code ignores the key in project and local settings. */
const USER_OR_MANAGED: readonly string[] = [
  'askUserQuestionTimeout',
  'appendPlugins',
  'autoContinueAtUsageLimit',
  'autoMode',
  'autoMode.classifyAllShell',
  'bashEditDiffEnabled',
  'desktopSessionCleanupPeriodDays',
  'dialogExpiry',
  'feedbackDrafts',
  'footerLinksRegexes',
  'modelPicker',
  'pluginConfigs',
  'prependPlugins',
  'processWrapper',
  'sandbox.allowAppleEvents',
  'sandbox.credentials.allowPlaintextInject',
  'sandbox.credentials.awsPairs',
  'sandbox.credentials.sigv4',
  'sandbox.filesystem.disabled',
  'sandbox.network.strictAllowlist',
  'sandbox.network.tlsTerminate',
  'sandbox.ripgrep',
  'skipAutoPermissionPrompt',
  'spellcheck',
  'sshConfigs',
  'vimInsertModeRemaps',
]

/** Scope "User, local, or managed": Claude Code ignores the key in `.claude/settings.json`. */
const USER_LOCAL_OR_MANAGED: readonly string[] = [
  'skipDangerousModePermissionPrompt',
  'syncClaudeAiPlugins',
  'syncClaudeAiSkills',
  'useAutoModeDuringPlan',
]

/** Scope "Global config": Claude Code reads the key from `~/.claude.json` only. */
const GLOBAL_CONFIG: readonly string[] = [
  'autoConnectIde',
  'autoInstallIdeExtension',
  'claudeInChromeDefaultEnabled',
  'copyFullResponse',
  'copyOnSelect',
  'defaultToAgentsView',
  'diffTool',
  'externalEditorContext',
  'leftArrowOpensAgents',
  'permissionExplainerEnabled',
  'prStatusFooterEnabled',
  'teammateDefaultModel',
]

/** Scope "Any file": Claude Code reads the key from every settings file. */
const ANY_FILE: readonly string[] = [
  'advisorModel',
  'agent',
  'agentPushNotifEnabled',
  'allowedHttpHookUrls',
  'allowedMcpServers',
  'alwaysThinkingEnabled',
  'apiKeyHelper',
  'attribution',
  'attribution.commit',
  'attribution.pr',
  'attribution.sessionUrl',
  'autoCompactEnabled',
  'autoCompactWindow',
  'autoMemoryDirectory',
  'autoMemoryEnabled',
  'autoScrollEnabled',
  'autoUpdatesChannel',
  'availableModels',
  'awaySummaryEnabled',
  'awsAuthRefresh',
  'awsCredentialExport',
  'axScreenReader',
  'bashOutputMaxChars',
  'claudeMdExcludes',
  'cleanupPeriodDays',
  'companyAnnouncements',
  'crossSessionInbound',
  'defaultShell',
  'deniedMcpServers',
  'disableAgentView',
  'disableAllHooks',
  'disableArtifact',
  'disableAutoMode',
  'disableBundledSkills',
  'disableClaudeAiConnectors',
  'disableDeepLinkRegistration',
  'disabledMcpjsonServers',
  'disableRemoteControl',
  'disableSkillShellExecution',
  'disableWorkflows',
  'editorMode',
  'effortLevel',
  'emojiCompletionEnabled',
  'enableAllProjectMcpServers',
  'enableArtifact',
  'enabledMcpjsonServers',
  'enabledPlugins',
  'enableWorkflows',
  'enforceAvailableModels',
  'env',
  'extraKnownMarketplaces',
  'fallbackModel',
  'fastMode',
  'fastModePerSessionOptIn',
  'feedbackSurveyRate',
  'fileCheckpointingEnabled',
  'fileSuggestion',
  'forceLoginMethod',
  'forceLoginOrgUUID',
  'gcpAuthRefresh',
  'hooks',
  'httpHookAllowedEnvVars',
  'includeCoAuthoredBy',
  'includeGitInstructions',
  'inputNeededNotifEnabled',
  'isolatePeerMachines',
  'keybindingFlavor',
  'language',
  'maxEffortLevel',
  'maxProseWidth',
  'minimumVersion',
  'model',
  'modelOverrides',
  'modelSettings',
  'otelHeadersHelper',
  'outputStyle',
  'permissions',
  'permissions.additionalDirectories',
  'permissions.allow',
  'permissions.ask',
  'permissions.blockReadsOutsideWorkingDirectories',
  'permissions.defaultMode',
  'permissions.deny',
  'permissions.disableBypassPermissionsMode',
  'plansDirectory',
  'preferredNotifChannel',
  'prefersReducedMotion',
  'promptCacheTtl',
  'promptSuggestionEnabled',
  'prUrlTemplate',
  'remote.defaultEnvironmentId',
  'remoteControlAtStartup',
  'respectGitignore',
  'respondToBashCommands',
  'sandbox',
  'sandbox.allowUnsandboxedCommands',
  'sandbox.autoAllowBashIfSandboxed',
  'sandbox.credentials',
  'sandbox.credentials.envVars',
  'sandbox.credentials.files',
  'sandbox.enabled',
  'sandbox.enableWeakerNestedSandbox',
  'sandbox.enableWeakerNetworkIsolation',
  'sandbox.excludedCommands',
  'sandbox.failIfUnavailable',
  'sandbox.filesystem',
  'sandbox.filesystem.allowRead',
  'sandbox.filesystem.allowWrite',
  'sandbox.filesystem.denyRead',
  'sandbox.filesystem.denyWrite',
  'sandbox.ignoreViolations',
  'sandbox.network',
  'sandbox.network.allowAllUnixSockets',
  'sandbox.network.allowedDomains',
  'sandbox.network.allowLocalBinding',
  'sandbox.network.allowMachLookup',
  'sandbox.network.allowUnixSockets',
  'sandbox.network.deniedDomains',
  'sandbox.network.httpProxyPort',
  'sandbox.network.socksProxyPort',
  'showClearContextOnPlanAccept',
  'showThinkingSummaries',
  'showTurnDuration',
  'skillListingBudgetFraction',
  'skillListingMaxDescChars',
  'skillOverrides',
  'skipWebFetchPreflight',
  'spinnerTipsEnabled',
  'spinnerTipsOverride',
  'spinnerVerbs',
  'statusLine',
  'subagentPromptCacheTtl',
  'subagentStatusLine',
  'switchModelsOnFlag',
  'syntaxHighlightingDisabled',
  'taskOutputMaxChars',
  'teammateMode',
  'terminalProgressBarEnabled',
  'terminalTitleFromRename',
  'theme',
  'timeFormat',
  'timeZone',
  'tui',
  'ultracode',
  'verbose',
  'viewMode',
  'voice',
  'voiceEnabled',
  'wheelScrollAccelerationEnabled',
  'workflowKeywordTriggerEnabled',
  'workflowSizeGuideline',
  'worktree',
  'worktree.baseRef',
  'worktree.bgIsolation',
  'worktree.sparsePaths',
  'worktree.symlinkDirectories',
]

/** The key with a rule of its own for a repository file, and the rule. The
 *  settings reference gives the scope of `syncClaudeAiPlugins` as "User,
 *  local, or managed", and `settings-sync-claude-ai-plugins` already reports
 *  it in `.claude/settings.json`. A project value of
 *  `autoContinueAtUsageLimit` turns the feature off, and is not ignored, so
 *  `settings-project-autocontinue-off` owns it. */
const REPORTED_BY: Record<string, string> = {
  syncClaudeAiPlugins: 'settings-sync-claude-ai-plugins',
  autoContinueAtUsageLimit: 'settings-project-autocontinue-off',
}

/** The Boolean value that Claude Code ignores in a repository file, for a key
 *  that it reads there for the other value. */
const FLAGGED_VALUE: Record<string, boolean> = { bashEditDiffEnabled: true }

/** An alias and the key it stands for. Claude Code reads an alias in each file
 *  that accepts the canonical key, as it reads the canonical key
 *  (https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases
 *  and the entry for `disableAutoMode`). */
const ALIASES: Record<string, string> = {
  additionalMarketplaces: 'extraKnownMarketplaces',
  allowedMarketplaces: 'strictKnownMarketplaces',
  'permissions.disableAutoMode': 'disableAutoMode',
}

// A path joins its keys with a character that a key name does not hold, so a
// top-level key "sandbox.bwrapPath" is not the nested key `sandbox.bwrapPath`.
const SEPARATOR = ' '
const idOf = (path: readonly string[]) => path.join(SEPARATOR)
const idOfDotted = (dotted: string) => idOf(dotted.split('.'))

const SCOPES = new Map<string, KeyScope>()
const PARENTS = new Set<string>()
for (const [scope, keys] of [
  ['managed', MANAGED_ONLY],
  ['user-or-managed', USER_OR_MANAGED],
  ['user-local-or-managed', USER_LOCAL_OR_MANAGED],
  ['global', GLOBAL_CONFIG],
  ['any', ANY_FILE],
] as const) {
  for (const key of keys) {
    const parts = key.split('.')
    SCOPES.set(idOf(parts), {
      scope,
      ...(key in FLAGGED_VALUE && { flaggedValue: FLAGGED_VALUE[key] }),
      ...(key in REPORTED_BY && { reportedBy: REPORTED_BY[key] }),
    })
    for (let end = 1; end < parts.length; end++) {
      PARENTS.add(idOf(parts.slice(0, end)))
    }
  }
}

const ALIAS_IDS = new Map(
  Object.entries(ALIASES).map(([alias, key]) => [idOfDotted(alias), idOfDotted(key)]),
)

/** The scope of the key at `path`, from the top level down. It is undefined for
 *  a key that the settings reference does not list. */
export function settingsKeyScope(path: readonly string[]): KeyScope | undefined {
  const id = idOf(path)
  return SCOPES.get(ALIAS_IDS.get(id) ?? id)
}

/** True when a listed key lies below `path`, so a rule has to read the object
 *  at `path`. */
export function hasListedChildren(path: readonly string[]): boolean {
  return PARENTS.has(idOf(path))
}
