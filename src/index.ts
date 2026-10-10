import { createRequire } from 'node:module'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import type { ESLint, Linter } from 'eslint'
import agentBodyNonempty from './rules/agent-body-nonempty.ts'
import agentDescriptionProactive from './rules/agent-description-proactive.ts'
import agentDescriptionsBudget from './rules/agent-descriptions-budget.ts'
import agentDisallowedToolsScope from './rules/agent-disallowed-tools-scope.ts'
import agentFieldMinVersion from './rules/agent-field-min-version.ts'
import agentFrontmatterSchema from './rules/agent-frontmatter-schema.ts'
import agentFrontmatterValid from './rules/agent-frontmatter-valid.ts'
import agentInitialPromptMainOnly from './rules/agent-initial-prompt-main-only.ts'
import agentMcpServersInlineTrust from './rules/agent-mcp-servers-inline-trust.ts'
import agentMcpServersRefExists from './rules/agent-mcp-servers-ref-exists.ts'
import agentMcpServersSchema from './rules/agent-mcp-servers-schema.ts'
import agentMemoryAutoMemoryOff from './rules/agent-memory-auto-memory-off.ts'
import agentMemoryGrantsWrite from './rules/agent-memory-grants-write.ts'
import agentMemoryScopeProject from './rules/agent-memory-scope-project.ts'
import agentModelForced from './rules/agent-model-forced.ts'
import agentModelValue from './rules/agent-model-value.ts'
import agentNameKebabCase from './rules/agent-name-kebab-case.ts'
import agentNameShadowing from './rules/agent-name-shadowing.ts'
import agentNameShadowsBuiltin from './rules/agent-name-shadows-builtin.ts'
import agentNameUnique from './rules/agent-name-unique.ts'
import agentNoBom from './rules/agent-no-bom.ts'
import agentOmitClaudeMdMain from './rules/agent-omit-claude-md-main.ts'
import agentPermissionModeBypass from './rules/agent-permission-mode-bypass.ts'
import agentPermissionModeManual from './rules/agent-permission-mode-manual.ts'
import agentPluginIgnoredFields from './rules/agent-plugin-ignored-fields.ts'
import agentPluginScopedNameUnique from './rules/agent-plugin-scoped-name-unique.ts'
import agentSkillsExist from './rules/agent-skills-exist.ts'
import agentSkillsPreloadable from './rules/agent-skills-preloadable.ts'
import agentTeammateIgnoredFields from './rules/agent-teammate-ignored-fields.ts'
import agentTeamsNoProjectConfig from './rules/agent-teams-no-project-config.ts'
import agentToolsAgentTypeList from './rules/agent-tools-agent-type-list.ts'
import agentToolsConditional from './rules/agent-tools-conditional.ts'
import agentToolsKnown from './rules/agent-tools-known.ts'
import agentToolsSkillForPreload from './rules/agent-tools-skill-for-preload.ts'
import agentToolsTaskAlias from './rules/agent-tools-task-alias.ts'
import agentToolsUnavailable from './rules/agent-tools-unavailable.ts'
import claudeMdAgentsMdProsePointer from './rules/claude-md-agents-md-prose-pointer.ts'
import claudeMdAgentsMdShadowed from './rules/claude-md-agents-md-shadowed.ts'
import claudeMdAgentsMdVariant from './rules/claude-md-agents-md-variant.ts'
import claudeMdCombinedSize from './rules/claude-md-combined-size.ts'
import claudeMdDanglingReference from './rules/claude-md-dangling-reference.ts'
import claudeMdDerivableContent from './rules/claude-md-derivable-content.ts'
import claudeMdEmphasisOveruse from './rules/claude-md-emphasis-overuse.ts'
import claudeMdExcludesAbsoluteCommitted from './rules/claude-md-excludes-absolute-committed.ts'
import claudeMdExcludesPattern from './rules/claude-md-excludes-pattern.ts'
import claudeMdGitInstructions from './rules/claude-md-git-instructions.ts'
import claudeMdGuardrailToHook from './rules/claude-md-guardrail-to-hook.ts'
import claudeMdHtmlCommentContent from './rules/claude-md-html-comment-content.ts'
import claudeMdImportExists from './rules/claude-md-import-exists.ts'
import claudeMdImportExternal from './rules/claude-md-import-external.ts'
import claudeMdImportInCodeSpan from './rules/claude-md-import-in-code-span.ts'
import claudeMdImportMaxDepth from './rules/claude-md-import-max-depth.ts'
import claudeMdLocalUntracked from './rules/claude-md-local-untracked.ts'
import claudeMdLocation from './rules/claude-md-location.ts'
import claudeMdMaxBytes from './rules/claude-md-max-bytes.ts'
import claudeMdMaxLines from './rules/claude-md-max-lines.ts'
import claudeMdProcedureToSkill from './rules/claude-md-procedure-to-skill.ts'
import claudeMdSymlink from './rules/claude-md-symlink.ts'
import commandLegacyFormat from './rules/command-legacy-format.ts'
import hooksAgentStopEvent from './rules/hooks-agent-stop-event.ts'
import hooksAgentTypeExperimental from './rules/hooks-agent-type-experimental.ts'
import hooksAsyncOnBlockingEvent from './rules/hooks-async-on-blocking-event.ts'
import hooksBroadAutoApprove from './rules/hooks-broad-auto-approve.ts'
import hooksCommandDeprecatedCliFlag from './rules/hooks-command-deprecated-cli-flag.ts'
import hooksCommandPathVariable from './rules/hooks-command-path-variable.ts'
import hooksCommandRemovedCliFlag from './rules/hooks-command-removed-cli-flag.ts'
import hooksCommandShellSafety from './rules/hooks-command-shell-safety.ts'
import hooksCommittedCommandReview from './rules/hooks-committed-command-review.ts'
import hooksConfigSchema from './rules/hooks-config-schema.ts'
import hooksDisableAllOverride from './rules/hooks-disable-all-override.ts'
import hooksDisabledByDisableallhooks from './rules/hooks-disabled-by-disableallhooks.ts'
import hooksDuplicateHandler from './rules/hooks-duplicate-handler.ts'
import hooksEnvVarUnavailable from './rules/hooks-env-var-unavailable.ts'
import hooksEventNameKnown from './rules/hooks-event-name-known.ts'
import hooksExecFormCommandSpaces from './rules/hooks-exec-form-command-spaces.ts'
import hooksExecFormShellSyntax from './rules/hooks-exec-form-shell-syntax.ts'
import hooksExecFormWindowsShim from './rules/hooks-exec-form-windows-shim.ts'
import hooksFilechangedStarMatcher from './rules/hooks-filechanged-star-matcher.ts'
import hooksHandlerFieldIgnored from './rules/hooks-handler-field-ignored.ts'
import hooksHandlerFieldUnknown from './rules/hooks-handler-field-unknown.ts'
import hooksHandlerTypeEventSupport from './rules/hooks-handler-type-event-support.ts'
import hooksHttpEnvAllowlist from './rules/hooks-http-env-allowlist.ts'
import hooksHttpLiteralSecret from './rules/hooks-http-literal-secret.ts'
import hooksIfCondition from './rules/hooks-if-condition.ts'
import hooksIfDirGlobDepth from './rules/hooks-if-dir-glob-depth.ts'
import hooksMatcherBashWithoutPowershell from './rules/hooks-matcher-bash-without-powershell.ts'
import hooksMatcherDeprecatedValue from './rules/hooks-matcher-deprecated-value.ts'
import hooksMatcherEnum from './rules/hooks-matcher-enum.ts'
import hooksMatcherLegacyVersion from './rules/hooks-matcher-legacy-version.ts'
import hooksMatcherMcpName from './rules/hooks-matcher-mcp-name.ts'
import hooksMatcherNameUnresolved from './rules/hooks-matcher-name-unresolved.ts'
import hooksMatcherNeverMatches from './rules/hooks-matcher-never-matches.ts'
import hooksMatcherSubagentAnchor from './rules/hooks-matcher-subagent-anchor.ts'
import hooksMatcherSyntax from './rules/hooks-matcher-syntax.ts'
import hooksMatcherUnanchoredRegex from './rules/hooks-matcher-unanchored-regex.ts'
import hooksMatcherUnsupportedEvent from './rules/hooks-matcher-unsupported-event.ts'
import hooksMultipleUpdatedinput from './rules/hooks-multiple-updatedinput.ts'
import hooksNoStandaloneFile from './rules/hooks-no-standalone-file.ts'
import hooksOutputBlockingExitCode from './rules/hooks-output-blocking-exit-code.ts'
import hooksOutputDeprecatedFields from './rules/hooks-output-deprecated-fields.ts'
import hooksOutputSchema from './rules/hooks-output-schema.ts'
import hooksOutputSize from './rules/hooks-output-size.ts'
import hooksPlaceholderQuoted from './rules/hooks-placeholder-quoted.ts'
import hooksPowershellPlaceholder from './rules/hooks-powershell-placeholder.ts'
import hooksPreferExecForm from './rules/hooks-prefer-exec-form.ts'
import hooksPromptOnPermissionRequest from './rules/hooks-prompt-on-permission-request.ts'
import hooksPs1NeedsPowershellShell from './rules/hooks-ps1-needs-powershell-shell.ts'
import hooksScriptExecutable from './rules/hooks-script-executable.ts'
import hooksScriptExists from './rules/hooks-script-exists.ts'
import hooksScriptShebang from './rules/hooks-script-shebang.ts'
import hooksSessionendDefaultTimeout from './rules/hooks-sessionend-default-timeout.ts'
import hooksSessionstartStaticContext from './rules/hooks-sessionstart-static-context.ts'
import hooksStopLoopGuard from './rules/hooks-stop-loop-guard.ts'
import hooksTimeoutUnits from './rules/hooks-timeout-units.ts'
import hooksWorktreeCreateWithoutRemove from './rules/hooks-worktree-create-without-remove.ts'
import lspDuplicateServerName from './rules/lsp-duplicate-server-name.ts'
import lspExtensionConflict from './rules/lsp-extension-conflict.ts'
import lspJsonLocation from './rules/lsp-json-location.ts'
import lspJsonSchema from './rules/lsp-json-schema.ts'
import lspTransportSocket from './rules/lsp-transport-socket.ts'
import marketplaceArchiveSha256 from './rules/marketplace-archive-sha256.ts'
import marketplaceCommandLinkMode from './rules/marketplace-command-link-mode.ts'
import marketplaceCommandSource from './rules/marketplace-command-source.ts'
import marketplaceCommandVersionIgnored from './rules/marketplace-command-version-ignored.ts'
import marketplaceEntryComponentPaths from './rules/marketplace-entry-component-paths.ts'
import marketplaceEntryHooksInline from './rules/marketplace-entry-hooks-inline.ts'
import marketplaceEntryHooksOverride from './rules/marketplace-entry-hooks-override.ts'
import marketplaceEntryManifestOnlyFields from './rules/marketplace-entry-manifest-only-fields.ts'
import marketplaceEntryNameMatchesManifest from './rules/marketplace-entry-name-matches-manifest.ts'
import marketplaceEntryRootSkills from './rules/marketplace-entry-root-skills.ts'
import marketplaceHeadersHelperCommand from './rules/marketplace-headers-helper-command.ts'
import marketplaceHeadersLiteralCredential from './rules/marketplace-headers-literal-credential.ts'
import marketplaceLocation from './rules/marketplace-location.ts'
import marketplaceMinVersion from './rules/marketplace-min-version.ts'
import marketplaceNameReserved from './rules/marketplace-name-reserved.ts'
import marketplaceRelativeSourceBackslash from './rules/marketplace-relative-source-backslash.ts'
import marketplaceRelativeSourceEscapeSymlink from './rules/marketplace-relative-source-escape-symlink.ts'
import marketplaceRelativeSourceExists from './rules/marketplace-relative-source-exists.ts'
import marketplaceRelativeSourceFormat from './rules/marketplace-relative-source-format.ts'
import marketplaceRelativeSourceUrlHosted from './rules/marketplace-relative-source-url-hosted.ts'
import marketplaceSchema from './rules/marketplace-schema.ts'
import marketplaceSelfHostedRootSource from './rules/marketplace-self-hosted-root-source.ts'
import marketplaceSourceSchema from './rules/marketplace-source-schema.ts'
import marketplaceStrictFalseConflict from './rules/marketplace-strict-false-conflict.ts'
import marketplaceVersionDuplicate from './rules/marketplace-version-duplicate.ts'
import mcpAllowDenyOverlap from './rules/mcp-allow-deny-overlap.ts'
import mcpAllowlistEmpty from './rules/mcp-allowlist-empty.ts'
import mcpAllowlistServernameDead from './rules/mcp-allowlist-servername-dead.ts'
import mcpAlwaysLoadCount from './rules/mcp-always-load-count.ts'
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
import mcpEnvVarDefault from './rules/mcp-env-var-default.ts'
import mcpEnvVarNumbers from './rules/mcp-env-var-numbers.ts'
import mcpEnvVarSyntax from './rules/mcp-env-var-syntax.ts'
import mcpHeadershelperCommitted from './rules/mcp-headershelper-committed.ts'
import mcpHeadershelperCredentialEnv from './rules/mcp-headershelper-credential-env.ts'
import mcpHeadershelperPath from './rules/mcp-headershelper-path.ts'
import mcpHiddenWhitespace from './rules/mcp-hidden-whitespace.ts'
import mcpInsecureUrl from './rules/mcp-insecure-url.ts'
import mcpJsonFileSize from './rules/mcp-json-file-size.ts'
import mcpJsonLocation from './rules/mcp-json-location.ts'
import mcpJsonServersKey from './rules/mcp-json-servers-key.ts'
import mcpManagedServersEntry from './rules/mcp-managed-servers-entry.ts'
import mcpNoLiteralSecrets from './rules/mcp-no-literal-secrets.ts'
import mcpNoSseTransport from './rules/mcp-no-sse-transport.ts'
import mcpOauthTransport from './rules/mcp-oauth-transport.ts'
import mcpOauthValues from './rules/mcp-oauth-values.ts'
import mcpPluginRootPaths from './rules/mcp-plugin-root-paths.ts'
import mcpPluginStdioReach from './rules/mcp-plugin-stdio-reach.ts'
import mcpPluginToolNameScoped from './rules/mcp-plugin-tool-name-scoped.ts'
import mcpPolicyEntrySchema from './rules/mcp-policy-entry-schema.ts'
import mcpPolicyLiteralValues from './rules/mcp-policy-literal-values.ts'
import mcpPolicyServernameWeak from './rules/mcp-policy-servername-weak.ts'
import mcpProjectDirDefault from './rules/mcp-project-dir-default.ts'
import mcpProjectPluginBundle from './rules/mcp-project-plugin-bundle.ts'
import mcpProjectToggleKeys from './rules/mcp-project-toggle-keys.ts'
import mcpRemoteUrlEmpty from './rules/mcp-remote-url-empty.ts'
import mcpServerNameAnthropicSkills from './rules/mcp-server-name-anthropic-skills.ts'
import mcpServerNameFormat from './rules/mcp-server-name-format.ts'
import mcpServerNameReserved from './rules/mcp-server-name-reserved.ts'
import mcpSettingsMcpservers from './rules/mcp-settings-mcpservers.ts'
import mcpStdioCommandHasArgs from './rules/mcp-stdio-command-has-args.ts'
import mcpStdioRelativePath from './rules/mcp-stdio-relative-path.ts'
import mcpTimeoutMin from './rules/mcp-timeout-min.ts'
import mcpToolNameFormat from './rules/mcp-tool-name-format.ts'
import mcpToolServerUnknown from './rules/mcp-tool-server-unknown.ts'
import mcpUnknownKeys from './rules/mcp-unknown-keys.ts'
import memoryAgentMemoryLocalUntracked from './rules/memory-agent-memory-local-untracked.ts'
import memoryAgentMemoryOrphan from './rules/memory-agent-memory-orphan.ts'
import memoryAutoMemoryDirectoryCommitted from './rules/memory-auto-memory-directory-committed.ts'
import memoryIndexEntryFormat from './rules/memory-index-entry-format.ts'
import memoryIndexMaxSize from './rules/memory-index-max-size.ts'
import memorySettingsSchema from './rules/memory-settings-schema.ts'
import memorySymlinkNetworkTarget from './rules/memory-symlink-network-target.ts'
import memoryTopicFrontmatter from './rules/memory-topic-frontmatter.ts'
import outputStyleForceForPlugin from './rules/output-style-force-for-plugin.ts'
import outputStyleFrontmatterSchema from './rules/output-style-frontmatter-schema.ts'
import outputStyleFrontmatterValid from './rules/output-style-frontmatter-valid.ts'
import outputStyleNameUnique from './rules/output-style-name-unique.ts'
import outputStylePluginNameDescription from './rules/output-style-plugin-name-description.ts'
import permissionsMcpRuleParens from './rules/permissions-mcp-rule-parens.ts'
import permissionsParamRule from './rules/permissions-param-rule.ts'
import permissionsPathRuleTool from './rules/permissions-path-rule-tool.ts'
import permissionsRuleSyntax from './rules/permissions-rule-syntax.ts'
import permissionsSkillRule from './rules/permissions-skill-rule.ts'
import permissionsSpecifierUnsupported from './rules/permissions-specifier-unsupported.ts'
import permissionsToolNameGlob from './rules/permissions-tool-name-glob.ts'
import permissionsUnknownTool from './rules/permissions-unknown-tool.ts'
import pluginBinExecutable from './rules/plugin-bin-executable.ts'
import pluginCommandsDirNonempty from './rules/plugin-commands-dir-nonempty.ts'
import pluginDefaultDirShadowed from './rules/plugin-default-dir-shadowed.ts'
import pluginDependenciesResolve from './rules/plugin-dependencies-resolve.ts'
import pluginEvalsReplayCommitted from './rules/plugin-evals-replay-committed.ts'
import pluginEvalsResultsGitignored from './rules/plugin-evals-results-gitignored.ts'
import pluginFeatureMinVersion from './rules/plugin-feature-min-version.ts'
import pluginManifestLocation from './rules/plugin-manifest-location.ts'
import pluginManifestMetadataFormat from './rules/plugin-manifest-metadata-format.ts'
import pluginManifestNoBom from './rules/plugin-manifest-no-bom.ts'
import pluginManifestPublishMetadata from './rules/plugin-manifest-publish-metadata.ts'
import pluginManifestVersionSemver from './rules/plugin-manifest-version-semver.ts'
import pluginMonitorsCommandEnv from './rules/plugin-monitors-command-env.ts'
import pluginMonitorsSkillExists from './rules/plugin-monitors-skill-exists.ts'
import pluginNoGitLfs from './rules/plugin-no-git-lfs.ts'
import pluginNoProjectPluginsDir from './rules/plugin-no-project-plugins-dir.ts'
import pluginNpmSourceShrinkwrap from './rules/plugin-npm-source-shrinkwrap.ts'
import pluginPackageLockfile from './rules/plugin-package-lockfile.ts'
import pluginPathNoBackslash from './rules/plugin-path-no-backslash.ts'
import pluginPathVarBraced from './rules/plugin-path-var-braced.ts'
import pluginProjectSkillsDirLimits from './rules/plugin-project-skills-dir-limits.ts'
import pluginSettingsSingleSource from './rules/plugin-settings-single-source.ts'
import pluginSkillDirLayout from './rules/plugin-skill-dir-layout.ts'
import pluginSkillsKeyRedundantDefault from './rules/plugin-skills-key-redundant-default.ts'
import pluginSymlinkEscapesMarketplace from './rules/plugin-symlink-escapes-marketplace.ts'
import pluginSymlinkEscapesPlugin from './rules/plugin-symlink-escapes-plugin.ts'
import pluginUserConfigNoShellFields from './rules/plugin-user-config-no-shell-fields.ts'
import pluginUserConfigSensitiveInContent from './rules/plugin-user-config-sensitive-in-content.ts'
import rulesFrontmatterSchema from './rules/rules-frontmatter-schema.ts'
import rulesMaxLines from './rules/rules-max-lines.ts'
import rulesMdExtension from './rules/rules-md-extension.ts'
import rulesPathsGlobValid from './rules/rules-paths-glob-valid.ts'
import rulesPathsNoMatch from './rules/rules-paths-no-match.ts'
import rulesSymlinkExternal from './rules/rules-symlink-external.ts'
import rulesSymlinkExternalScoped from './rules/rules-symlink-external-scoped.ts'
import settingsAgentExists from './rules/settings-agent-exists.ts'
import settingsAttributionFalse from './rules/settings-attribution-false.ts'
import settingsCommittedHelperCommand from './rules/settings-committed-helper-command.ts'
import settingsConflictingKeys from './rules/settings-conflicting-keys.ts'
import settingsDefaultshellPowershellTool from './rules/settings-defaultshell-powershell-tool.ts'
import settingsDeprecatedKey from './rules/settings-deprecated-key.ts'
import settingsEnabledPluginsEntryExists from './rules/settings-enabled-plugins-entry-exists.ts'
import settingsEnabledPluginsExternalSource from './rules/settings-enabled-plugins-external-source.ts'
import settingsEnabledPluginsMarketplaceDeclared from './rules/settings-enabled-plugins-marketplace-declared.ts'
import settingsEnabledPluginsSchema from './rules/settings-enabled-plugins-schema.ts'
import settingsEnvContextCost from './rules/settings-env-context-cost.ts'
import settingsEnvCredential from './rules/settings-env-credential.ts'
import settingsEnvDeprecatedVar from './rules/settings-env-deprecated-var.ts'
import settingsEnvFormatHeuristic from './rules/settings-env-format-heuristic.ts'
import settingsEnvIgnoredVar from './rules/settings-env-ignored-var.ts'
import settingsEnvNumericSpelling from './rules/settings-env-numeric-spelling.ts'
import settingsEnvPromptCachingOff from './rules/settings-env-prompt-caching-off.ts'
import settingsEnvRouting from './rules/settings-env-routing.ts'
import settingsEnvSecretHeuristic from './rules/settings-env-secret-heuristic.ts'
import settingsEnvShadowed from './rules/settings-env-shadowed.ts'
import settingsEnvValueFormat from './rules/settings-env-value-format.ts'
import settingsExtraKnownMarketplacesDirectory from './rules/settings-extra-known-marketplaces-directory.ts'
import settingsExtraKnownMarketplacesKeyMatchesName from './rules/settings-extra-known-marketplaces-key-matches-name.ts'
import settingsExtraKnownMarketplacesSchema from './rules/settings-extra-known-marketplaces-schema.ts'
import settingsFileSize from './rules/settings-file-size.ts'
import settingsFooterlinksPattern from './rules/settings-footerlinks-pattern.ts'
import settingsGlobalOnlyFile from './rules/settings-global-only-file.ts'
import settingsKeyScope from './rules/settings-key-scope.ts'
import settingsKnownMarketplacesPatternAnchored from './rules/settings-known-marketplaces-pattern-anchored.ts'
import settingsKnownMarketplacesPolicySchema from './rules/settings-known-marketplaces-policy-schema.ts'
import settingsLocalGitignored from './rules/settings-local-gitignored.ts'
import settingsLocalLocation from './rules/settings-local-location.ts'
import settingsLocalUntracked from './rules/settings-local-untracked.ts'
import settingsManagedEffortCap from './rules/settings-managed-effort-cap.ts'
import settingsManagedFile from './rules/settings-managed-file.ts'
import settingsManagedMerge from './rules/settings-managed-merge.ts'
import settingsManagedValueForm from './rules/settings-managed-value-form.ts'
import settingsManagedVersionFloor from './rules/settings-managed-version-floor.ts'
import settingsMarketplaceHeadersHelperHttps from './rules/settings-marketplace-headers-helper-https.ts'
import settingsMarketplaceKeyAlias from './rules/settings-marketplace-key-alias.ts'
import settingsMarketplaceKeyAliasConflict from './rules/settings-marketplace-key-alias-conflict.ts'
import settingsMarketplaceSkipLfs from './rules/settings-marketplace-skip-lfs.ts'
import settingsModelCapability from './rules/settings-model-capability.ts'
import settingsModelList from './rules/settings-model-list.ts'
import settingsModelPinVersion from './rules/settings-model-pin-version.ts'
import settingsModelValue from './rules/settings-model-value.ts'
import settingsNestedProjectFile from './rules/settings-nested-project-file.ts'
import settingsOutputstyleResolves from './rules/settings-outputstyle-resolves.ts'
import settingsPluginSuggestionMarketplacesSource from './rules/settings-plugin-suggestion-marketplaces-source.ts'
import settingsProjectAutocontinueOff from './rules/settings-project-autocontinue-off.ts'
import settingsProjectValueIgnored from './rules/settings-project-value-ignored.ts'
import settingsRedundantValue from './rules/settings-redundant-value.ts'
import settingsRemovedKey from './rules/settings-removed-key.ts'
import settingsSchema from './rules/settings-schema.ts'
import settingsSchemaUrl from './rules/settings-schema-url.ts'
import settingsSkilloverridesKey from './rules/settings-skilloverrides-key.ts'
import settingsSkilloverridesUnknownSkill from './rules/settings-skilloverrides-unknown-skill.ts'
import settingsStrictKnownMarketplacesSkillsDir from './rules/settings-strict-known-marketplaces-skills-dir.ts'
import settingsSyncClaudeAiPlugins from './rules/settings-sync-claude-ai-plugins.ts'
import settingsValidJson from './rules/settings-valid-json.ts'
import settingsWebfetchPreflightSkip from './rules/settings-webfetch-preflight-skip.ts'
import settingsWorktreePaths from './rules/settings-worktree-paths.ts'
import settingsWorktreeSparseClaudeDir from './rules/settings-worktree-sparse-claude-dir.ts'
import skillAgentExists from './rules/skill-agent-exists.ts'
import skillAllowedToolsBroad from './rules/skill-allowed-tools-broad.ts'
import skillAllowedToolsIneffective from './rules/skill-allowed-tools-ineffective.ts'
import skillArgumentEscape from './rules/skill-argument-escape.ts'
import skillBodyTokenBudget from './rules/skill-body-token-budget.ts'
import skillBooleanLiteral from './rules/skill-boolean-literal.ts'
import skillDescriptionMaxLength from './rules/skill-description-max-length.ts'
import skillDescriptionPresent from './rules/skill-description-present.ts'
import skillFileLayout from './rules/skill-file-layout.ts'
import skillForkFieldsRequireContext from './rules/skill-fork-fields-require-context.ts'
import skillFrontmatterPosition from './rules/skill-frontmatter-position.ts'
import skillFrontmatterSchema from './rules/skill-frontmatter-schema.ts'
import skillInjectBangPosition from './rules/skill-inject-bang-position.ts'
import skillInjectRobustness from './rules/skill-inject-robustness.ts'
import skillInvocationRedundantFields from './rules/skill-invocation-redundant-fields.ts'
import skillInvocationUnreachable from './rules/skill-invocation-unreachable.ts'
import skillListingBudget from './rules/skill-listing-budget.ts'
import skillLiteralDollar from './rules/skill-literal-dollar.ts'
import skillLoopReferenceInvocable from './rules/skill-loop-reference-invocable.ts'
import skillMaxLines from './rules/skill-max-lines.ts'
import skillMetadataReservedKeys from './rules/skill-metadata-reserved-keys.ts'
import skillModelOverride from './rules/skill-model-override.ts'
import skillNameShadowsBuiltin from './rules/skill-name-shadows-builtin.ts'
import skillNameUnique from './rules/skill-name-unique.ts'
import skillNoBom from './rules/skill-no-bom.ts'
import skillPathsGlobValid from './rules/skill-paths-glob-valid.ts'
import skillPluginNamePrefix from './rules/skill-plugin-name-prefix.ts'
import skillPluginPathVars from './rules/skill-plugin-path-vars.ts'
import skillPluginRootName from './rules/skill-plugin-root-name.ts'
import skillPluginRootShadowed from './rules/skill-plugin-root-shadowed.ts'
import skillPluginVarsOutsidePlugin from './rules/skill-plugin-vars-outside-plugin.ts'
import skillPrecedenceShadowing from './rules/skill-precedence-shadowing.ts'
import skillReferenceExists from './rules/skill-reference-exists.ts'
import skillReservedName from './rules/skill-reserved-name.ts'
import skillShellPlatform from './rules/skill-shell-platform.ts'
import skillSideEffectsManualOnly from './rules/skill-side-effects-manual-only.ts'
import statuslineHomePathShared from './rules/statusline-home-path-shared.ts'
import statuslineScriptExists from './rules/statusline-script-exists.ts'
import statuslineScriptTerminalSize from './rules/statusline-script-terminal-size.ts'
import statuslineWindowsPath from './rules/statusline-windows-path.ts'

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
  hooksAgentStopEvent,
  hooksAgentTypeExperimental,
  hooksAsyncOnBlockingEvent,
  hooksBroadAutoApprove,
  hooksCommandDeprecatedCliFlag,
  hooksCommandPathVariable,
  hooksCommandRemovedCliFlag,
  hooksCommandShellSafety,
  hooksCommittedCommandReview,
  hooksConfigSchema,
  hooksDisableAllOverride,
  hooksDisabledByDisableallhooks,
  hooksDuplicateHandler,
  hooksEnvVarUnavailable,
  hooksExecFormCommandSpaces,
  hooksExecFormShellSyntax,
  hooksExecFormWindowsShim,
  hooksFilechangedStarMatcher,
  hooksHandlerFieldIgnored,
  hooksHandlerFieldUnknown,
  hooksHandlerTypeEventSupport,
  hooksHttpEnvAllowlist,
  hooksHttpLiteralSecret,
  hooksIfCondition,
  hooksIfDirGlobDepth,
  hooksMatcherBashWithoutPowershell,
  hooksMatcherDeprecatedValue,
  hooksMatcherEnum,
  hooksMatcherLegacyVersion,
  hooksMatcherMcpName,
  hooksMatcherNameUnresolved,
  hooksMatcherNeverMatches,
  hooksMatcherSubagentAnchor,
  hooksMatcherSyntax,
  hooksMatcherUnanchoredRegex,
  hooksMatcherUnsupportedEvent,
  hooksMultipleUpdatedinput,
  hooksNoStandaloneFile,
  hooksOutputBlockingExitCode,
  hooksOutputDeprecatedFields,
  hooksOutputSchema,
  hooksOutputSize,
  hooksPlaceholderQuoted,
  hooksPowershellPlaceholder,
  hooksPreferExecForm,
  hooksPromptOnPermissionRequest,
  hooksPs1NeedsPowershellShell,
  hooksScriptShebang,
  hooksSessionendDefaultTimeout,
  hooksSessionstartStaticContext,
  hooksStopLoopGuard,
  hooksTimeoutUnits,
  hooksWorktreeCreateWithoutRemove,
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
  skillBooleanLiteral,
  skillDescriptionPresent,
  skillInvocationRedundantFields,
  skillMetadataReservedKeys,
  skillNameShadowsBuiltin,
  skillNoBom,
  skillArgumentEscape,
  skillMaxLines,
  skillPluginNamePrefix,
  skillPluginRootName,
  skillShellPlatform,
  skillBodyTokenBudget,
  skillInjectRobustness,
  skillListingBudget,
  skillLiteralDollar,
  skillLoopReferenceInvocable,
  skillModelOverride,
  skillPluginPathVars,
  skillPrecedenceShadowing,
  skillSideEffectsManualOnly,
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
  agentDisallowedToolsScope,
  agentFieldMinVersion,
  agentMcpServersInlineTrust,
  agentMemoryScopeProject,
  agentNameShadowing,
  agentNameShadowsBuiltin,
  agentNoBom,
  agentPermissionModeManual,
  agentPluginScopedNameUnique,
  agentToolsConditional,
  agentToolsTaskAlias,
  outputStyleForceForPlugin,
  outputStyleNameUnique,
  outputStylePluginNameDescription,
  agentInitialPromptMainOnly,
  agentMcpServersRefExists,
  agentModelValue,
  agentSkillsExist,
  agentToolsAgentTypeList,
  agentToolsSkillForPreload,
  agentBodyNonempty,
  agentDescriptionProactive,
  agentDescriptionsBudget,
  agentNameKebabCase,
  agentTeammateIgnoredFields,
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
  marketplaceArchiveSha256,
  marketplaceCommandLinkMode,
  marketplaceCommandSource,
  marketplaceLocation,
  marketplaceMinVersion,
  marketplaceRelativeSourceBackslash,
  marketplaceSelfHostedRootSource,
  marketplaceRelativeSourceUrlHosted,
  marketplaceHeadersLiteralCredential,
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
  settingsSchema,
  settingsAttributionFalse,
  settingsDeprecatedKey,
  settingsGlobalOnlyFile,
  settingsOutputstyleResolves,
  settingsProjectAutocontinueOff,
  settingsRedundantValue,
  settingsSchemaUrl,
  settingsCommittedHelperCommand,
  settingsEnvDeprecatedVar,
  settingsEnvPromptCachingOff,
  settingsEnvRouting,
  settingsLocalLocation,
  settingsWebfetchPreflightSkip,
  settingsEnvNumericSpelling,
  settingsFooterlinksPattern,
  settingsManagedValueForm,
  settingsManagedVersionFloor,
  settingsWorktreeSparseClaudeDir,
  statuslineWindowsPath,
  hooksScriptExists,
  hooksScriptExecutable,
  pluginBinExecutable,
  statuslineScriptExists,
  claudeMdLocalUntracked,
  memoryAgentMemoryLocalUntracked,
  pluginEvalsReplayCommitted,
  pluginEvalsResultsGitignored,
  settingsLocalGitignored,
  settingsLocalUntracked,
  settingsEnabledPluginsExternalSource,
  settingsEnabledPluginsMarketplaceDeclared,
  settingsExtraKnownMarketplacesDirectory,
  settingsKnownMarketplacesPatternAnchored,
  settingsMarketplaceKeyAlias,
  settingsMarketplaceSkipLfs,
  settingsStrictKnownMarketplacesSkillsDir,
  claudeMdAgentsMdShadowed,
  claudeMdAgentsMdVariant,
  claudeMdExcludesPattern,
  claudeMdImportExists,
  claudeMdImportMaxDepth,
  claudeMdMaxBytes,
  memorySettingsSchema,
  memorySymlinkNetworkTarget,
  rulesFrontmatterSchema,
  rulesMdExtension,
  rulesPathsGlobValid,
  rulesSymlinkExternalScoped,
  claudeMdImportExternal,
  claudeMdMaxLines,
  claudeMdSymlink,
  memoryAutoMemoryDirectoryCommitted,
  memoryIndexMaxSize,
  rulesMaxLines,
  rulesSymlinkExternal,
  claudeMdAgentsMdProsePointer,
  claudeMdCombinedSize,
  claudeMdDanglingReference,
  claudeMdDerivableContent,
  claudeMdEmphasisOveruse,
  claudeMdExcludesAbsoluteCommitted,
  claudeMdGitInstructions,
  claudeMdGuardrailToHook,
  claudeMdHtmlCommentContent,
  claudeMdImportInCodeSpan,
  claudeMdLocation,
  claudeMdProcedureToSkill,
  memoryAgentMemoryOrphan,
  memoryIndexEntryFormat,
  memoryTopicFrontmatter,
  rulesPathsNoMatch,
  settingsAgentExists,
  settingsDefaultshellPowershellTool,
  settingsEnvContextCost,
  settingsEnvFormatHeuristic,
  settingsEnvSecretHeuristic,
  settingsManagedEffortCap,
  settingsManagedMerge,
  settingsModelCapability,
  settingsModelPinVersion,
  settingsNestedProjectFile,
  settingsSkilloverridesUnknownSkill,
  settingsWorktreePaths,
  statuslineHomePathShared,
  statuslineScriptTerminalSize,
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
  mcpAlwaysLoadCount,
  mcpEnvVarNumbers,
  mcpEnvVarSyntax,
  mcpNoLiteralSecrets,
  mcpProjectToggleKeys,
  mcpToolServerUnknown,
  lspJsonLocation,
  mcpEnvVarDefault,
  mcpPluginRootPaths,
  mcpStdioCommandHasArgs,
  mcpUnknownKeys,
  pluginManifestLocation,
  pluginSkillDirLayout,
  pluginNoProjectPluginsDir,
  pluginProjectSkillsDirLimits,
  pluginCommandsDirNonempty,
  pluginDefaultDirShadowed,
  pluginMonitorsCommandEnv,
  pluginNoGitLfs,
  pluginPackageLockfile,
  pluginPathVarBraced,
  pluginUserConfigNoShellFields,
  pluginSymlinkEscapesMarketplace,
  pluginSymlinkEscapesPlugin,
  pluginDependenciesResolve,
  pluginMonitorsSkillExists,
  pluginNpmSourceShrinkwrap,
  pluginSettingsSingleSource,
  pluginUserConfigSensitiveInContent,
  pluginFeatureMinVersion,
  pluginManifestMetadataFormat,
  pluginManifestNoBom,
  pluginManifestPublishMetadata,
  pluginManifestVersionSemver,
  pluginSkillsKeyRedundantDefault,
  pluginPathNoBackslash,
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
  'hooks-agent-stop-event': 'off',
  'hooks-agent-type-experimental': 'warn',
  'hooks-async-on-blocking-event': 'off',
  'hooks-broad-auto-approve': 'off',
  'hooks-command-deprecated-cli-flag': 'warn',
  'hooks-command-path-variable': 'off',
  'hooks-command-removed-cli-flag': 'error',
  'hooks-command-shell-safety': 'off',
  'hooks-committed-command-review': 'off',
  'hooks-config-schema': 'error',
  'hooks-disable-all-override': 'warn',
  'hooks-disabled-by-disableallhooks': 'error',
  'hooks-duplicate-handler': 'warn',
  'hooks-env-var-unavailable': 'error',
  'hooks-exec-form-command-spaces': 'error',
  'hooks-exec-form-shell-syntax': 'off',
  'hooks-exec-form-windows-shim': 'off',
  'hooks-filechanged-star-matcher': 'warn',
  'hooks-handler-field-ignored': 'error',
  'hooks-handler-field-unknown': 'warn',
  'hooks-handler-type-event-support': 'error',
  'hooks-http-env-allowlist': 'error',
  'hooks-http-literal-secret': 'off',
  'hooks-if-condition': 'error',
  'hooks-if-dir-glob-depth': 'off',
  'hooks-matcher-bash-without-powershell': 'warn',
  'hooks-matcher-deprecated-value': 'warn',
  'hooks-matcher-enum': 'error',
  'hooks-matcher-legacy-version': 'warn',
  'hooks-matcher-mcp-name': 'error',
  'hooks-matcher-name-unresolved': 'off',
  'hooks-matcher-never-matches': 'error',
  'hooks-matcher-subagent-anchor': 'warn',
  'hooks-matcher-syntax': 'error',
  'hooks-matcher-unanchored-regex': 'off',
  'hooks-matcher-unsupported-event': 'error',
  'hooks-multiple-updatedinput': 'off',
  'hooks-no-standalone-file': 'error',
  'hooks-output-blocking-exit-code': 'off',
  'hooks-output-deprecated-fields': 'off',
  'hooks-output-schema': 'off',
  'hooks-output-size': 'off',
  'hooks-placeholder-quoted': 'warn',
  'hooks-powershell-placeholder': 'error',
  'hooks-prefer-exec-form': 'warn',
  'hooks-prompt-on-permission-request': 'warn',
  'hooks-ps1-needs-powershell-shell': 'warn',
  'hooks-script-shebang': 'off',
  'hooks-sessionend-default-timeout': 'warn',
  'hooks-sessionstart-static-context': 'off',
  'hooks-stop-loop-guard': 'off',
  'hooks-timeout-units': 'off',
  'hooks-worktree-create-without-remove': 'warn',
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
  'skill-boolean-literal': 'warn',
  'skill-description-present': 'warn',
  'skill-invocation-redundant-fields': 'warn',
  'skill-metadata-reserved-keys': 'warn',
  'skill-name-shadows-builtin': 'warn',
  'skill-no-bom': 'warn',
  'skill-argument-escape': 'warn',
  'skill-max-lines': 'warn',
  'skill-plugin-name-prefix': 'warn',
  'skill-plugin-root-name': 'warn',
  'skill-shell-platform': 'warn',
  'skill-body-token-budget': 'off',
  'skill-inject-robustness': 'off',
  'skill-listing-budget': 'off',
  'skill-literal-dollar': 'off',
  'skill-loop-reference-invocable': 'off',
  'skill-model-override': 'off',
  'skill-plugin-path-vars': 'off',
  'skill-precedence-shadowing': 'off',
  'skill-side-effects-manual-only': 'off',
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
  'agent-disallowed-tools-scope': 'warn',
  'agent-field-min-version': 'warn',
  'agent-mcp-servers-inline-trust': 'warn',
  'agent-memory-scope-project': 'warn',
  'agent-name-shadowing': 'warn',
  'agent-name-shadows-builtin': 'warn',
  'agent-no-bom': 'warn',
  'agent-permission-mode-manual': 'warn',
  'agent-plugin-scoped-name-unique': 'warn',
  'agent-tools-conditional': 'warn',
  'agent-tools-task-alias': 'warn',
  'output-style-force-for-plugin': 'warn',
  'output-style-name-unique': 'warn',
  'output-style-plugin-name-description': 'warn',
  'agent-initial-prompt-main-only': 'off',
  'agent-mcp-servers-ref-exists': 'off',
  'agent-model-value': 'off',
  'agent-skills-exist': 'off',
  'agent-tools-agent-type-list': 'off',
  'agent-tools-skill-for-preload': 'off',
  'agent-body-nonempty': 'off',
  'agent-description-proactive': 'off',
  'agent-descriptions-budget': 'off',
  'agent-name-kebab-case': 'off',
  'agent-teammate-ignored-fields': 'off',
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
  'marketplace-archive-sha256': 'warn',
  'marketplace-command-link-mode': 'warn',
  'marketplace-command-source': 'warn',
  'marketplace-location': 'warn',
  'marketplace-min-version': 'warn',
  'marketplace-relative-source-backslash': 'warn',
  'marketplace-self-hosted-root-source': 'warn',
  'marketplace-relative-source-url-hosted': 'off',
  'marketplace-headers-literal-credential': 'off',
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
  'settings-schema': 'error',
  'settings-attribution-false': 'warn',
  'settings-deprecated-key': 'warn',
  'settings-global-only-file': 'error',
  'settings-outputstyle-resolves': 'error',
  'settings-project-autocontinue-off': 'warn',
  'settings-redundant-value': 'warn',
  'settings-schema-url': 'warn',
  'settings-committed-helper-command': 'warn',
  'settings-env-deprecated-var': 'warn',
  'settings-env-prompt-caching-off': 'warn',
  'settings-env-routing': 'warn',
  'settings-local-location': 'warn',
  'settings-webfetch-preflight-skip': 'warn',
  'settings-env-numeric-spelling': 'warn',
  'settings-footerlinks-pattern': 'warn',
  'settings-managed-value-form': 'warn',
  'settings-managed-version-floor': 'warn',
  'settings-worktree-sparse-claude-dir': 'warn',
  'statusline-windows-path': 'warn',
  'hooks-script-exists': 'error',
  'hooks-script-executable': 'error',
  'plugin-bin-executable': 'error',
  'statusline-script-exists': 'error',
  'claude-md-local-untracked': 'warn',
  'memory-agent-memory-local-untracked': 'warn',
  'plugin-evals-replay-committed': 'warn',
  'plugin-evals-results-gitignored': 'warn',
  'settings-local-gitignored': 'warn',
  'settings-local-untracked': 'warn',
  'settings-enabled-plugins-external-source': 'warn',
  'settings-enabled-plugins-marketplace-declared': 'off',
  'settings-extra-known-marketplaces-directory': 'warn',
  'settings-known-marketplaces-pattern-anchored': 'warn',
  'settings-marketplace-key-alias': 'warn',
  'settings-marketplace-skip-lfs': 'warn',
  'settings-strict-known-marketplaces-skills-dir': 'warn',
  'claude-md-agents-md-shadowed': 'error',
  'claude-md-agents-md-variant': 'error',
  'claude-md-excludes-pattern': 'error',
  'claude-md-import-exists': 'error',
  'claude-md-import-max-depth': 'error',
  'claude-md-max-bytes': 'error',
  'memory-settings-schema': 'error',
  'memory-symlink-network-target': 'error',
  'rules-frontmatter-schema': 'error',
  'rules-md-extension': 'error',
  'rules-paths-glob-valid': 'error',
  'rules-symlink-external-scoped': 'error',
  'claude-md-import-external': 'warn',
  'claude-md-max-lines': 'warn',
  'claude-md-symlink': 'warn',
  'memory-auto-memory-directory-committed': 'warn',
  'memory-index-max-size': 'warn',
  'rules-max-lines': 'warn',
  'rules-symlink-external': 'warn',
  'claude-md-agents-md-prose-pointer': 'off',
  'claude-md-combined-size': 'off',
  'claude-md-dangling-reference': 'off',
  'claude-md-derivable-content': 'off',
  'claude-md-emphasis-overuse': 'off',
  'claude-md-excludes-absolute-committed': 'off',
  'claude-md-git-instructions': 'off',
  'claude-md-guardrail-to-hook': 'off',
  'claude-md-html-comment-content': 'off',
  'claude-md-import-in-code-span': 'off',
  'claude-md-location': 'off',
  'claude-md-procedure-to-skill': 'off',
  'memory-agent-memory-orphan': 'off',
  'memory-index-entry-format': 'off',
  'memory-topic-frontmatter': 'off',
  'rules-paths-no-match': 'off',
  'settings-agent-exists': 'off',
  'settings-defaultshell-powershell-tool': 'off',
  'settings-env-context-cost': 'off',
  'settings-env-format-heuristic': 'off',
  'settings-env-secret-heuristic': 'off',
  'settings-managed-effort-cap': 'off',
  'settings-managed-merge': 'off',
  'settings-model-capability': 'off',
  'settings-model-pin-version': 'off',
  'settings-nested-project-file': 'off',
  'settings-skilloverrides-unknown-skill': 'off',
  'settings-worktree-paths': 'off',
  'statusline-home-path-shared': 'off',
  'statusline-script-terminal-size': 'off',
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
  'mcp-always-load-count': 'off',
  'mcp-env-var-numbers': 'off',
  'mcp-env-var-syntax': 'off',
  'mcp-no-literal-secrets': 'off',
  'mcp-project-toggle-keys': 'off',
  'mcp-tool-server-unknown': 'off',
  'lsp-json-location': 'off',
  'mcp-env-var-default': 'off',
  'mcp-plugin-root-paths': 'off',
  'mcp-stdio-command-has-args': 'off',
  'mcp-unknown-keys': 'off',
  'plugin-manifest-location': 'error',
  'plugin-skill-dir-layout': 'error',
  'plugin-no-project-plugins-dir': 'error',
  'plugin-project-skills-dir-limits': 'error',
  'plugin-commands-dir-nonempty': 'error',
  'plugin-default-dir-shadowed': 'error',
  'plugin-monitors-command-env': 'error',
  'plugin-no-git-lfs': 'error',
  'plugin-package-lockfile': 'error',
  'plugin-path-var-braced': 'error',
  'plugin-user-config-no-shell-fields': 'error',
  'plugin-symlink-escapes-marketplace': 'error',
  'plugin-symlink-escapes-plugin': 'warn',
  'plugin-dependencies-resolve': 'error',
  'plugin-monitors-skill-exists': 'error',
  'plugin-npm-source-shrinkwrap': 'error',
  'plugin-settings-single-source': 'error',
  'plugin-user-config-sensitive-in-content': 'error',
  'plugin-feature-min-version': 'warn',
  'plugin-manifest-metadata-format': 'warn',
  'plugin-manifest-no-bom': 'warn',
  'plugin-manifest-publish-metadata': 'warn',
  'plugin-manifest-version-semver': 'warn',
  'plugin-skills-key-redundant-default': 'warn',
  'plugin-path-no-backslash': 'warn',
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
