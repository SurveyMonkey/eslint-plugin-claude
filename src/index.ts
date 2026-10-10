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
import lspDuplicateServerName from './rules/lsp-duplicate-server-name.ts'
import lspExtensionConflict from './rules/lsp-extension-conflict.ts'
import lspJsonSchema from './rules/lsp-json-schema.ts'
import lspTransportSocket from './rules/lsp-transport-socket.ts'
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
import mcpAllowDenyOverlap from './rules/mcp-allow-deny-overlap.ts'
import mcpAllowlistEmpty from './rules/mcp-allowlist-empty.ts'
import mcpAllowlistServernameDead from './rules/mcp-allowlist-servername-dead.ts'
import mcpAnthropicHostedUrl from './rules/mcp-anthropic-hosted-url.ts'
import mcpApprovalCommitted from './rules/mcp-approval-committed.ts'
import mcpApprovalConflict from './rules/mcp-approval-conflict.ts'
import mcpApprovalNamesExist from './rules/mcp-approval-names-exist.ts'
import mcpAuthorizationHeaderWithOauth from './rules/mcp-authorization-header-with-oauth.ts'
import mcpCredentialVarRemote from './rules/mcp-credential-var-remote.ts'
import mcpDisableConnectorsFalse from './rules/mcp-disable-connectors-false.ts'
import mcpDuplicateServerName from './rules/mcp-duplicate-server-name.ts'
import mcpEnvClientSecret from './rules/mcp-env-client-secret.ts'
import mcpEnvExpansionField from './rules/mcp-env-expansion-field.ts'
import mcpHeadershelperCommitted from './rules/mcp-headershelper-committed.ts'
import mcpHeadershelperCredentialEnv from './rules/mcp-headershelper-credential-env.ts'
import mcpHeadershelperPath from './rules/mcp-headershelper-path.ts'
import mcpHiddenWhitespace from './rules/mcp-hidden-whitespace.ts'
import mcpInsecureUrl from './rules/mcp-insecure-url.ts'
import mcpJsonFileSize from './rules/mcp-json-file-size.ts'
import mcpJsonLocation from './rules/mcp-json-location.ts'
import mcpJsonServersKey from './rules/mcp-json-servers-key.ts'
import mcpManagedServersEntry from './rules/mcp-managed-servers-entry.ts'
import mcpNoSseTransport from './rules/mcp-no-sse-transport.ts'
import mcpOauthTransport from './rules/mcp-oauth-transport.ts'
import mcpOauthValues from './rules/mcp-oauth-values.ts'
import mcpPluginStdioReach from './rules/mcp-plugin-stdio-reach.ts'
import mcpPluginToolNameScoped from './rules/mcp-plugin-tool-name-scoped.ts'
import mcpPolicyEntrySchema from './rules/mcp-policy-entry-schema.ts'
import mcpPolicyLiteralValues from './rules/mcp-policy-literal-values.ts'
import mcpPolicyServernameWeak from './rules/mcp-policy-servername-weak.ts'
import mcpProjectDirDefault from './rules/mcp-project-dir-default.ts'
import mcpProjectPluginBundle from './rules/mcp-project-plugin-bundle.ts'
import mcpRemoteUrlEmpty from './rules/mcp-remote-url-empty.ts'
import mcpServerNameAnthropicSkills from './rules/mcp-server-name-anthropic-skills.ts'
import mcpServerNameFormat from './rules/mcp-server-name-format.ts'
import mcpServerNameReserved from './rules/mcp-server-name-reserved.ts'
import mcpSettingsMcpservers from './rules/mcp-settings-mcpservers.ts'
import mcpStdioRelativePath from './rules/mcp-stdio-relative-path.ts'
import mcpTimeoutMin from './rules/mcp-timeout-min.ts'
import mcpToolNameFormat from './rules/mcp-tool-name-format.ts'
import outputStyleFrontmatterSchema from './rules/output-style-frontmatter-schema.ts'
import outputStyleFrontmatterValid from './rules/output-style-frontmatter-valid.ts'
import permissionsMcpRuleParens from './rules/permissions-mcp-rule-parens.ts'
import permissionsParamRule from './rules/permissions-param-rule.ts'
import permissionsPathRuleTool from './rules/permissions-path-rule-tool.ts'
import permissionsRuleSyntax from './rules/permissions-rule-syntax.ts'
import permissionsSkillRule from './rules/permissions-skill-rule.ts'
import permissionsSpecifierUnsupported from './rules/permissions-specifier-unsupported.ts'
import permissionsToolNameGlob from './rules/permissions-tool-name-glob.ts'
import permissionsUnknownTool from './rules/permissions-unknown-tool.ts'
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
  mcpJsonLocation,
  mcpJsonServersKey,
  mcpJsonFileSize,
  mcpServerNameReserved,
  mcpRemoteUrlEmpty,
  mcpHiddenWhitespace,
  mcpTimeoutMin,
  mcpOauthTransport,
  mcpOauthValues,
  mcpAuthorizationHeaderWithOauth,
  mcpProjectDirDefault,
  mcpEnvExpansionField,
  mcpCredentialVarRemote,
  mcpHeadershelperCredentialEnv,
  mcpSettingsMcpservers,
  mcpAnthropicHostedUrl,
  mcpProjectPluginBundle,
  mcpToolNameFormat,
  mcpApprovalCommitted,
  mcpDisableConnectorsFalse,
  mcpPolicyEntrySchema,
  lspJsonSchema,
  lspTransportSocket,
  mcpAllowlistServernameDead,
  mcpEnvClientSecret,
  mcpManagedServersEntry,
  mcpDuplicateServerName,
  lspExtensionConflict,
  lspDuplicateServerName,
  mcpPluginToolNameScoped,
  mcpApprovalNamesExist,
  mcpApprovalConflict,
  mcpAllowDenyOverlap,
  mcpHeadershelperCommitted,
  mcpHeadershelperPath,
  mcpNoSseTransport,
  mcpServerNameAnthropicSkills,
  mcpServerNameFormat,
  mcpStdioRelativePath,
  mcpAllowlistEmpty,
  mcpInsecureUrl,
  mcpPluginStdioReach,
  mcpPolicyLiteralValues,
  mcpPolicyServernameWeak,
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
  'mcp-json-location': 'error',
  'mcp-json-servers-key': 'error',
  'mcp-json-file-size': 'error',
  'mcp-server-name-reserved': 'error',
  'mcp-remote-url-empty': 'error',
  'mcp-hidden-whitespace': 'error',
  'mcp-timeout-min': 'error',
  'mcp-oauth-transport': 'error',
  'mcp-oauth-values': 'error',
  'mcp-authorization-header-with-oauth': 'error',
  'mcp-project-dir-default': 'error',
  'mcp-env-expansion-field': 'error',
  'mcp-credential-var-remote': 'error',
  'mcp-headershelper-credential-env': 'error',
  'mcp-settings-mcpservers': 'error',
  'mcp-anthropic-hosted-url': 'error',
  'mcp-project-plugin-bundle': 'error',
  'mcp-tool-name-format': 'error',
  'mcp-approval-committed': 'error',
  'mcp-disable-connectors-false': 'error',
  'mcp-policy-entry-schema': 'error',
  'lsp-json-schema': 'error',
  'lsp-transport-socket': 'error',
  'mcp-allowlist-servername-dead': 'error',
  'mcp-env-client-secret': 'error',
  'mcp-managed-servers-entry': 'error',
  'mcp-duplicate-server-name': 'error',
  'lsp-extension-conflict': 'error',
  'lsp-duplicate-server-name': 'error',
  'mcp-plugin-tool-name-scoped': 'error',
  'mcp-approval-names-exist': 'error',
  'mcp-approval-conflict': 'error',
  'mcp-allow-deny-overlap': 'error',
  'mcp-allowlist-empty': 'warn',
  'mcp-headershelper-committed': 'warn',
  'mcp-headershelper-path': 'warn',
  'mcp-insecure-url': 'warn',
  'mcp-no-sse-transport': 'warn',
  'mcp-plugin-stdio-reach': 'warn',
  'mcp-policy-literal-values': 'warn',
  'mcp-policy-servername-weak': 'warn',
  'mcp-server-name-anthropic-skills': 'warn',
  'mcp-server-name-format': 'warn',
  'mcp-stdio-relative-path': 'warn',
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
