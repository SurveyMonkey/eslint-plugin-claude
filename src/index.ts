import { createRequire } from 'node:module'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import type { ESLint, Linter } from 'eslint'
import agentFrontmatterSchema from './rules/agent-frontmatter-schema.ts'
import agentFrontmatterValid from './rules/agent-frontmatter-valid.ts'
import agentMcpServersSchema from './rules/agent-mcp-servers-schema.ts'
import agentMemoryAutoMemoryOff from './rules/agent-memory-auto-memory-off.ts'
import agentMemoryGrantsWrite from './rules/agent-memory-grants-write.ts'
import agentModelForced from './rules/agent-model-forced.ts'
import agentNameUnique from './rules/agent-name-unique.ts'
import agentOmitClaudeMdMain from './rules/agent-omit-claude-md-main.ts'
import agentPermissionModeBypass from './rules/agent-permission-mode-bypass.ts'
import agentPluginIgnoredFields from './rules/agent-plugin-ignored-fields.ts'
import agentSkillsPreloadable from './rules/agent-skills-preloadable.ts'
import agentTeamsNoProjectConfig from './rules/agent-teams-no-project-config.ts'
import agentToolsKnown from './rules/agent-tools-known.ts'
import agentToolsUnavailable from './rules/agent-tools-unavailable.ts'
import commandLegacyFormat from './rules/command-legacy-format.ts'
import hooksEventNameKnown from './rules/hooks-event-name-known.ts'
import marketplaceCommandVersionIgnored from './rules/marketplace-command-version-ignored.ts'
import marketplaceEntryComponentPaths from './rules/marketplace-entry-component-paths.ts'
import marketplaceEntryHooksInline from './rules/marketplace-entry-hooks-inline.ts'
import marketplaceEntryHooksOverride from './rules/marketplace-entry-hooks-override.ts'
import marketplaceEntryManifestOnlyFields from './rules/marketplace-entry-manifest-only-fields.ts'
import marketplaceEntryNameMatchesManifest from './rules/marketplace-entry-name-matches-manifest.ts'
import marketplaceEntryRootSkills from './rules/marketplace-entry-root-skills.ts'
import marketplaceHeadersHelperCommand from './rules/marketplace-headers-helper-command.ts'
import marketplaceNameReserved from './rules/marketplace-name-reserved.ts'
import marketplaceRelativeSourceEscapeSymlink from './rules/marketplace-relative-source-escape-symlink.ts'
import marketplaceRelativeSourceExists from './rules/marketplace-relative-source-exists.ts'
import marketplaceRelativeSourceFormat from './rules/marketplace-relative-source-format.ts'
import marketplaceSchema from './rules/marketplace-schema.ts'
import marketplaceSourceSchema from './rules/marketplace-source-schema.ts'
import marketplaceStrictFalseConflict from './rules/marketplace-strict-false-conflict.ts'
import marketplaceVersionDuplicate from './rules/marketplace-version-duplicate.ts'
import outputStyleFrontmatterSchema from './rules/output-style-frontmatter-schema.ts'
import outputStyleFrontmatterValid from './rules/output-style-frontmatter-valid.ts'
import permissionsAdditionalDirectoriesPath from './rules/permissions-additional-directories-path.ts'
import permissionsAllowUnrestricted from './rules/permissions-allow-unrestricted.ts'
import permissionsAutoModeDroppedAllow from './rules/permissions-auto-mode-dropped-allow.ts'
import permissionsAutoModeSchema from './rules/permissions-auto-mode-schema.ts'
import permissionsBashColonStarMid from './rules/permissions-bash-colon-star-mid.ts'
import permissionsBashColonStarSuffix from './rules/permissions-bash-colon-star-suffix.ts'
import permissionsBashExecWrapperPrefix from './rules/permissions-bash-exec-wrapper-prefix.ts'
import permissionsBashRunnerWildcard from './rules/permissions-bash-runner-wildcard.ts'
import permissionsBashWildcardBeforeSubcommand from './rules/permissions-bash-wildcard-before-subcommand.ts'
import permissionsBlockReadsFalse from './rules/permissions-block-reads-false.ts'
import permissionsBypassModeCommitted from './rules/permissions-bypass-mode-committed.ts'
import permissionsDeadAllow from './rules/permissions-dead-allow.ts'
import permissionsDefaultModeConflict from './rules/permissions-default-mode-conflict.ts'
import permissionsDefaultModeManualAlias from './rules/permissions-default-mode-manual-alias.ts'
import permissionsDefaultModeProjectIgnored from './rules/permissions-default-mode-project-ignored.ts'
import permissionsDefaultModeSurface from './rules/permissions-default-mode-surface.ts'
import permissionsDefaultModeValue from './rules/permissions-default-mode-value.ts'
import permissionsDenyAllTools from './rules/permissions-deny-all-tools.ts'
import permissionsDisableModeValue from './rules/permissions-disable-mode-value.ts'
import permissionsDuplicateRule from './rules/permissions-duplicate-rule.ts'
import permissionsEndConversation from './rules/permissions-end-conversation.ts'
import permissionsInvalidPathPattern from './rules/permissions-invalid-path-pattern.ts'
import permissionsMcpRuleParens from './rules/permissions-mcp-rule-parens.ts'
import permissionsNegation from './rules/permissions-negation.ts'
import permissionsParamRule from './rules/permissions-param-rule.ts'
import permissionsPathRuleTool from './rules/permissions-path-rule-tool.ts'
import permissionsProtectedPathAllow from './rules/permissions-protected-path-allow.ts'
import permissionsRuleSyntax from './rules/permissions-rule-syntax.ts'
import permissionsSandboxBashAsk from './rules/permissions-sandbox-bash-ask.ts'
import permissionsSchema from './rules/permissions-schema.ts'
import permissionsSkillRule from './rules/permissions-skill-rule.ts'
import permissionsSpecifierUnsupported from './rules/permissions-specifier-unsupported.ts'
import permissionsToolNameGlob from './rules/permissions-tool-name-glob.ts'
import permissionsUnknownTool from './rules/permissions-unknown-tool.ts'
import permissionsWebfetchDomainSyntax from './rules/permissions-webfetch-domain-syntax.ts'
import permissionsWindowsPath from './rules/permissions-windows-path.ts'
import sandboxCredentialsAws from './rules/sandbox-credentials-aws.ts'
import sandboxCredentialsMask from './rules/sandbox-credentials-mask.ts'
import sandboxDomainOverlap from './rules/sandbox-domain-overlap.ts'
import sandboxDomainSyntax from './rules/sandbox-domain-syntax.ts'
import sandboxExcludedCommandsSyntax from './rules/sandbox-excluded-commands-syntax.ts'
import sandboxFilesystemDisabledConflict from './rules/sandbox-filesystem-disabled-conflict.ts'
import sandboxSchema from './rules/sandbox-schema.ts'
import sandboxScope from './rules/sandbox-scope.ts'
import settingsConflictingKeys from './rules/settings-conflicting-keys.ts'
import settingsEnabledPluginsEntryExists from './rules/settings-enabled-plugins-entry-exists.ts'
import settingsEnabledPluginsSchema from './rules/settings-enabled-plugins-schema.ts'
import settingsEnvCredential from './rules/settings-env-credential.ts'
import settingsEnvIgnoredVar from './rules/settings-env-ignored-var.ts'
import settingsEnvShadowed from './rules/settings-env-shadowed.ts'
import settingsEnvValueFormat from './rules/settings-env-value-format.ts'
import settingsExtraKnownMarketplacesKeyMatchesName from './rules/settings-extra-known-marketplaces-key-matches-name.ts'
import settingsExtraKnownMarketplacesSchema from './rules/settings-extra-known-marketplaces-schema.ts'
import settingsFileSize from './rules/settings-file-size.ts'
import settingsKeyScope from './rules/settings-key-scope.ts'
import settingsKnownMarketplacesPolicySchema from './rules/settings-known-marketplaces-policy-schema.ts'
import settingsManagedFile from './rules/settings-managed-file.ts'
import settingsMarketplaceHeadersHelperHttps from './rules/settings-marketplace-headers-helper-https.ts'
import settingsMarketplaceKeyAliasConflict from './rules/settings-marketplace-key-alias-conflict.ts'
import settingsModelList from './rules/settings-model-list.ts'
import settingsModelValue from './rules/settings-model-value.ts'
import settingsPluginSuggestionMarketplacesSource from './rules/settings-plugin-suggestion-marketplaces-source.ts'
import settingsProjectValueIgnored from './rules/settings-project-value-ignored.ts'
import settingsRemovedKey from './rules/settings-removed-key.ts'
import settingsSkilloverridesKey from './rules/settings-skilloverrides-key.ts'
import settingsSyncClaudeAiPlugins from './rules/settings-sync-claude-ai-plugins.ts'
import settingsValidJson from './rules/settings-valid-json.ts'
import skillAgentExists from './rules/skill-agent-exists.ts'
import skillAllowedToolsBroad from './rules/skill-allowed-tools-broad.ts'
import skillAllowedToolsIneffective from './rules/skill-allowed-tools-ineffective.ts'
import skillDescriptionMaxLength from './rules/skill-description-max-length.ts'
import skillFileLayout from './rules/skill-file-layout.ts'
import skillForkFieldsRequireContext from './rules/skill-fork-fields-require-context.ts'
import skillFrontmatterPosition from './rules/skill-frontmatter-position.ts'
import skillFrontmatterSchema from './rules/skill-frontmatter-schema.ts'
import skillInjectBangPosition from './rules/skill-inject-bang-position.ts'
import skillInvocationUnreachable from './rules/skill-invocation-unreachable.ts'
import skillNameUnique from './rules/skill-name-unique.ts'
import skillPathsGlobValid from './rules/skill-paths-glob-valid.ts'
import skillPluginRootShadowed from './rules/skill-plugin-root-shadowed.ts'
import skillPluginVarsOutsidePlugin from './rules/skill-plugin-vars-outside-plugin.ts'
import skillReferenceExists from './rules/skill-reference-exists.ts'
import skillReservedName from './rules/skill-reserved-name.ts'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

// Each rule module names its own files and language, so a new rule adds no
// entry to a central glob list.
const modules = [
  skillDescriptionMaxLength,
  commandLegacyFormat,
  hooksEventNameKnown,
  skillFrontmatterPosition,
  skillFrontmatterSchema,
  skillForkFieldsRequireContext,
  skillInvocationUnreachable,
  skillReservedName,
  skillPluginVarsOutsidePlugin,
  skillInjectBangPosition,
  skillAllowedToolsIneffective,
  skillAllowedToolsBroad,
  skillPluginRootShadowed,
  skillFileLayout,
  skillReferenceExists,
  skillAgentExists,
  skillNameUnique,
  skillPathsGlobValid,
  agentFrontmatterValid,
  agentFrontmatterSchema,
  agentPluginIgnoredFields,
  agentMcpServersSchema,
  agentPermissionModeBypass,
  agentMemoryGrantsWrite,
  agentToolsKnown,
  agentToolsUnavailable,
  agentNameUnique,
  agentSkillsPreloadable,
  agentMemoryAutoMemoryOff,
  agentOmitClaudeMdMain,
  agentModelForced,
  agentTeamsNoProjectConfig,
  outputStyleFrontmatterValid,
  outputStyleFrontmatterSchema,
  permissionsRuleSyntax,
  permissionsUnknownTool,
  permissionsToolNameGlob,
  permissionsSpecifierUnsupported,
  permissionsPathRuleTool,
  permissionsMcpRuleParens,
  permissionsParamRule,
  permissionsSkillRule,
  permissionsBypassModeCommitted,
  permissionsDefaultModeConflict,
  permissionsDefaultModeProjectIgnored,
  permissionsDefaultModeValue,
  permissionsDisableModeValue,
  permissionsSchema,
  permissionsAllowUnrestricted,
  permissionsBashExecWrapperPrefix,
  permissionsBashRunnerWildcard,
  permissionsBashWildcardBeforeSubcommand,
  permissionsEndConversation,
  permissionsProtectedPathAllow,
  permissionsAdditionalDirectoriesPath,
  permissionsBlockReadsFalse,
  permissionsInvalidPathPattern,
  permissionsNegation,
  permissionsWebfetchDomainSyntax,
  permissionsWindowsPath,
  permissionsAutoModeSchema,
  sandboxDomainSyntax,
  sandboxExcludedCommandsSyntax,
  sandboxFilesystemDisabledConflict,
  sandboxSchema,
  sandboxScope,
  sandboxCredentialsAws,
  sandboxCredentialsMask,
  sandboxDomainOverlap,
  permissionsSandboxBashAsk,
  permissionsDeadAllow,
  permissionsAutoModeDroppedAllow,
  permissionsBashColonStarMid,
  permissionsBashColonStarSuffix,
  permissionsDefaultModeManualAlias,
  permissionsDefaultModeSurface,
  permissionsDenyAllTools,
  permissionsDuplicateRule,
  marketplaceNameReserved,
  marketplaceCommandVersionIgnored,
  marketplaceHeadersHelperCommand,
  marketplaceEntryHooksInline,
  marketplaceSourceSchema,
  marketplaceRelativeSourceFormat,
  marketplaceSchema,
  marketplaceEntryNameMatchesManifest,
  marketplaceRelativeSourceExists,
  marketplaceRelativeSourceEscapeSymlink,
  marketplaceVersionDuplicate,
  marketplaceEntryManifestOnlyFields,
  marketplaceStrictFalseConflict,
  marketplaceEntryHooksOverride,
  marketplaceEntryRootSkills,
  marketplaceEntryComponentPaths,
  settingsEnabledPluginsSchema,
  settingsEnabledPluginsEntryExists,
  settingsExtraKnownMarketplacesSchema,
  settingsExtraKnownMarketplacesKeyMatchesName,
  settingsMarketplaceHeadersHelperHttps,
  settingsMarketplaceKeyAliasConflict,
  settingsSyncClaudeAiPlugins,
  settingsValidJson,
  settingsFileSize,
  settingsKeyScope,
  settingsManagedFile,
  settingsRemovedKey,
  settingsEnvCredential,
  settingsEnvValueFormat,
  settingsEnvIgnoredVar,
  settingsProjectValueIgnored,
  settingsKnownMarketplacesPolicySchema,
  settingsPluginSuggestionMarketplacesSource,
  settingsConflictingKeys,
  settingsModelValue,
  settingsModelList,
  settingsSkilloverridesKey,
  settingsEnvShadowed,
]

type RuleName = (typeof modules)[number]['name']
type Language = (typeof modules)[number]['language'] | 'json'
// A rule for files of two languages adds its second language and files in
// `also`. The config then has one block for each.
interface Module {
  name: string
  language: Language
  files: string[]
  also?: { language: Language; files: string[] }
}
type Severity = 'off' | 'warn' | 'error'

// Language settings only, so the spread in `configFor` cannot replace a
// block's `files` or `plugins`.
const LANGUAGES: Record<
  (typeof modules)[number]['language'],
  Pick<Linter.Config, 'language' | 'languageOptions'>
> = {
  markdown: { language: 'markdown/gfm', languageOptions: { frontmatter: 'yaml' } },
  json: { language: 'json/json' },
}

// Each rule at its `recommended` severity. A rule whose source is not the
// Claude Code docs is `off` here.
const recommended: Record<RuleName, Severity> = {
  'skill-description-max-length': 'warn',
  'command-legacy-format': 'warn',
  'hooks-event-name-known': 'error',
  'skill-frontmatter-position': 'error',
  'skill-frontmatter-schema': 'error',
  'skill-fork-fields-require-context': 'error',
  'skill-invocation-unreachable': 'error',
  'skill-reserved-name': 'error',
  'skill-plugin-vars-outside-plugin': 'error',
  'skill-inject-bang-position': 'error',
  'skill-allowed-tools-ineffective': 'error',
  'skill-allowed-tools-broad': 'error',
  'skill-plugin-root-shadowed': 'error',
  'skill-file-layout': 'error',
  'skill-reference-exists': 'error',
  'skill-agent-exists': 'error',
  'skill-name-unique': 'error',
  'skill-paths-glob-valid': 'error',
  'agent-frontmatter-valid': 'error',
  'agent-frontmatter-schema': 'error',
  'agent-plugin-ignored-fields': 'error',
  'agent-mcp-servers-schema': 'error',
  'agent-permission-mode-bypass': 'error',
  'agent-memory-grants-write': 'error',
  'agent-tools-known': 'error',
  'agent-tools-unavailable': 'error',
  'agent-name-unique': 'error',
  'agent-skills-preloadable': 'error',
  'agent-memory-auto-memory-off': 'error',
  'agent-omit-claude-md-main': 'error',
  'agent-model-forced': 'error',
  'agent-teams-no-project-config': 'error',
  'output-style-frontmatter-valid': 'error',
  'output-style-frontmatter-schema': 'error',
  'permissions-rule-syntax': 'error',
  'permissions-unknown-tool': 'error',
  'permissions-tool-name-glob': 'error',
  'permissions-specifier-unsupported': 'error',
  'permissions-path-rule-tool': 'error',
  'permissions-mcp-rule-parens': 'error',
  'permissions-param-rule': 'error',
  'permissions-skill-rule': 'error',
  'permissions-bypass-mode-committed': 'error',
  'permissions-default-mode-conflict': 'error',
  'permissions-default-mode-project-ignored': 'error',
  'permissions-default-mode-value': 'error',
  'permissions-disable-mode-value': 'error',
  'permissions-schema': 'error',
  'permissions-allow-unrestricted': 'error',
  'permissions-bash-exec-wrapper-prefix': 'error',
  'permissions-bash-runner-wildcard': 'error',
  'permissions-bash-wildcard-before-subcommand': 'error',
  'permissions-end-conversation': 'error',
  'permissions-protected-path-allow': 'error',
  'permissions-additional-directories-path': 'error',
  'permissions-block-reads-false': 'error',
  'permissions-invalid-path-pattern': 'error',
  'permissions-negation': 'error',
  'permissions-webfetch-domain-syntax': 'error',
  'permissions-windows-path': 'error',
  'permissions-auto-mode-schema': 'error',
  'sandbox-domain-syntax': 'error',
  'sandbox-excluded-commands-syntax': 'error',
  'sandbox-filesystem-disabled-conflict': 'error',
  'sandbox-schema': 'error',
  'sandbox-scope': 'error',
  'sandbox-credentials-aws': 'error',
  'sandbox-credentials-mask': 'error',
  'sandbox-domain-overlap': 'error',
  'permissions-sandbox-bash-ask': 'error',
  'permissions-dead-allow': 'error',
  'permissions-auto-mode-dropped-allow': 'warn',
  'permissions-bash-colon-star-mid': 'warn',
  'permissions-bash-colon-star-suffix': 'warn',
  'permissions-default-mode-manual-alias': 'warn',
  'permissions-default-mode-surface': 'warn',
  'permissions-deny-all-tools': 'warn',
  'permissions-duplicate-rule': 'warn',
  'marketplace-name-reserved': 'error',
  'marketplace-command-version-ignored': 'error',
  'marketplace-headers-helper-command': 'error',
  'marketplace-entry-hooks-inline': 'error',
  'marketplace-source-schema': 'error',
  'marketplace-relative-source-format': 'error',
  'marketplace-schema': 'error',
  'marketplace-entry-name-matches-manifest': 'error',
  'marketplace-relative-source-exists': 'error',
  'marketplace-relative-source-escape-symlink': 'error',
  'marketplace-version-duplicate': 'error',
  'marketplace-entry-manifest-only-fields': 'error',
  'marketplace-strict-false-conflict': 'error',
  'marketplace-entry-hooks-override': 'error',
  'marketplace-entry-root-skills': 'error',
  'marketplace-entry-component-paths': 'error',
  'settings-enabled-plugins-schema': 'error',
  'settings-enabled-plugins-entry-exists': 'error',
  'settings-extra-known-marketplaces-schema': 'error',
  'settings-extra-known-marketplaces-key-matches-name': 'error',
  'settings-marketplace-headers-helper-https': 'error',
  'settings-marketplace-key-alias-conflict': 'error',
  'settings-sync-claude-ai-plugins': 'error',
  'settings-valid-json': 'error',
  'settings-file-size': 'error',
  'settings-key-scope': 'error',
  'settings-managed-file': 'error',
  'settings-removed-key': 'error',
  'settings-env-credential': 'error',
  'settings-env-value-format': 'error',
  'settings-env-ignored-var': 'error',
  'settings-project-value-ignored': 'error',
  'settings-known-marketplaces-policy-schema': 'error',
  'settings-plugin-suggestion-marketplaces-source': 'error',
  'settings-conflicting-keys': 'error',
  'settings-model-value': 'error',
  'settings-model-list': 'error',
  'settings-skilloverrides-key': 'error',
  'settings-env-shadowed': 'error',
}

// `strict` keeps each `recommended` severity, and turns `off` into `warn`.
const STRICT: Record<Severity, Exclude<Severity, 'off'>> = {
  off: 'warn',
  warn: 'warn',
  error: 'error',
}

// Annotated, not inferred: the inferred type reaches into @eslint/core, which
// the declaration emit cannot name. `meta` and each config key are required
// here, because `ESLint.Plugin` makes them optional and consumers would have
// to check for `undefined`. `configs` drops the string index of
// `ESLint.Plugin`, so a config name with a typo does not type-check.
// `ESLint.Plugin['rules']` rather than `Rule.RuleModule`, which types
// JavaScript rules only. Each config is an array of one block per rule that
// it turns on. Add a key for a new config.
type Plugin = Omit<ESLint.Plugin, 'meta' | 'configs'> & {
  meta: { name: string; version: string; namespace: 'claude' }
  rules: NonNullable<ESLint.Plugin['rules']>
  configs: { recommended: Linter.Config[]; strict: Linter.Config[] }
}

const plugin: Plugin = {
  meta: { name, version, namespace: 'claude' },
  rules: Object.fromEntries(modules.map((m) => [m.name, m.rule])),
  // Filled in below, once `plugin` exists to reference itself.
  configs: { recommended: [], strict: [] },
}

/** One block for each rule that `severity` turns on, with the rule's own
 *  files and language. The block also registers the language plugins, so a
 *  consumer needs no other setup. */
function configFor(config: string, severity: (rule: RuleName) => Severity): Linter.Config[] {
  return modules
    .filter((m) => severity(m.name) !== 'off')
    .flatMap((m: Module) =>
      [{ language: m.language, files: m.files }, ...(m.also ? [m.also] : [])].map((target) => ({
        name: `claude/${config}/${m.name}`,
        files: target.files,
        plugins: { claude: plugin, markdown, json },
        ...LANGUAGES[target.language],
        rules: { [`claude/${m.name}`]: severity(m.name as RuleName) },
      })),
    )
}

plugin.configs.recommended = configFor('recommended', (rule) => recommended[rule])
plugin.configs.strict = configFor('strict', (rule) => STRICT[recommended[rule]])

export default plugin
