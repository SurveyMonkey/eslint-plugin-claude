import { createRequire } from 'node:module'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import type { ESLint, Linter } from 'eslint'
import * as agentBodyNonempty from './rules/agent-body-nonempty.ts'
import * as agentDescriptionProactive from './rules/agent-description-proactive.ts'
import * as agentDescriptionsBudget from './rules/agent-descriptions-budget.ts'
import * as agentDisallowedToolsScope from './rules/agent-disallowed-tools-scope.ts'
import * as agentFieldMinVersion from './rules/agent-field-min-version.ts'
import * as agentFrontmatterSchema from './rules/agent-frontmatter-schema.ts'
import * as agentFrontmatterValid from './rules/agent-frontmatter-valid.ts'
import * as agentInitialPromptMainOnly from './rules/agent-initial-prompt-main-only.ts'
import * as agentMcpServersInlineTrust from './rules/agent-mcp-servers-inline-trust.ts'
import * as agentMcpServersRefExists from './rules/agent-mcp-servers-ref-exists.ts'
import * as agentMcpServersSchema from './rules/agent-mcp-servers-schema.ts'
import * as agentMemoryAutoMemoryOff from './rules/agent-memory-auto-memory-off.ts'
import * as agentMemoryGrantsWrite from './rules/agent-memory-grants-write.ts'
import * as agentMemoryScopeProject from './rules/agent-memory-scope-project.ts'
import * as agentModelForced from './rules/agent-model-forced.ts'
import * as agentModelValue from './rules/agent-model-value.ts'
import * as agentNameKebabCase from './rules/agent-name-kebab-case.ts'
import * as agentNameShadowing from './rules/agent-name-shadowing.ts'
import * as agentNameShadowsBuiltin from './rules/agent-name-shadows-builtin.ts'
import * as agentNameUnique from './rules/agent-name-unique.ts'
import * as agentNoBom from './rules/agent-no-bom.ts'
import * as agentOmitClaudeMdMain from './rules/agent-omit-claude-md-main.ts'
import * as agentPermissionModeBypass from './rules/agent-permission-mode-bypass.ts'
import * as agentPermissionModeManual from './rules/agent-permission-mode-manual.ts'
import * as agentPluginIgnoredFields from './rules/agent-plugin-ignored-fields.ts'
import * as agentPluginScopedNameUnique from './rules/agent-plugin-scoped-name-unique.ts'
import * as agentSkillsExist from './rules/agent-skills-exist.ts'
import * as agentSkillsPreloadable from './rules/agent-skills-preloadable.ts'
import * as agentTeammateIgnoredFields from './rules/agent-teammate-ignored-fields.ts'
import * as agentTeamsNoProjectConfig from './rules/agent-teams-no-project-config.ts'
import * as agentToolsAgentTypeList from './rules/agent-tools-agent-type-list.ts'
import * as agentToolsConditional from './rules/agent-tools-conditional.ts'
import * as agentToolsKnown from './rules/agent-tools-known.ts'
import * as agentToolsSkillForPreload from './rules/agent-tools-skill-for-preload.ts'
import * as agentToolsTaskAlias from './rules/agent-tools-task-alias.ts'
import * as agentToolsUnavailable from './rules/agent-tools-unavailable.ts'
import * as claudeMdAgentsMdProsePointer from './rules/claude-md-agents-md-prose-pointer.ts'
import * as claudeMdAgentsMdShadowed from './rules/claude-md-agents-md-shadowed.ts'
import * as claudeMdAgentsMdVariant from './rules/claude-md-agents-md-variant.ts'
import * as claudeMdCombinedSize from './rules/claude-md-combined-size.ts'
import * as claudeMdDanglingReference from './rules/claude-md-dangling-reference.ts'
import * as claudeMdDerivableContent from './rules/claude-md-derivable-content.ts'
import * as claudeMdEmphasisOveruse from './rules/claude-md-emphasis-overuse.ts'
import * as claudeMdExcludesAbsoluteCommitted from './rules/claude-md-excludes-absolute-committed.ts'
import * as claudeMdExcludesPattern from './rules/claude-md-excludes-pattern.ts'
import * as claudeMdGitInstructions from './rules/claude-md-git-instructions.ts'
import * as claudeMdGuardrailToHook from './rules/claude-md-guardrail-to-hook.ts'
import * as claudeMdHtmlCommentContent from './rules/claude-md-html-comment-content.ts'
import * as claudeMdImportExists from './rules/claude-md-import-exists.ts'
import * as claudeMdImportExternal from './rules/claude-md-import-external.ts'
import * as claudeMdImportInCodeSpan from './rules/claude-md-import-in-code-span.ts'
import * as claudeMdImportMaxDepth from './rules/claude-md-import-max-depth.ts'
import * as claudeMdLocalUntracked from './rules/claude-md-local-untracked.ts'
import * as claudeMdLocation from './rules/claude-md-location.ts'
import * as claudeMdMaxBytes from './rules/claude-md-max-bytes.ts'
import * as claudeMdMaxLines from './rules/claude-md-max-lines.ts'
import * as claudeMdProcedureToSkill from './rules/claude-md-procedure-to-skill.ts'
import * as claudeMdSymlink from './rules/claude-md-symlink.ts'
import * as commandLegacyFormat from './rules/command-legacy-format.ts'
import * as hooksAgentStopEvent from './rules/hooks-agent-stop-event.ts'
import * as hooksAgentTypeExperimental from './rules/hooks-agent-type-experimental.ts'
import * as hooksAsyncOnBlockingEvent from './rules/hooks-async-on-blocking-event.ts'
import * as hooksBroadAutoApprove from './rules/hooks-broad-auto-approve.ts'
import * as hooksCommandDeprecatedCliFlag from './rules/hooks-command-deprecated-cli-flag.ts'
import * as hooksCommandPathVariable from './rules/hooks-command-path-variable.ts'
import * as hooksCommandRemovedCliFlag from './rules/hooks-command-removed-cli-flag.ts'
import * as hooksCommandShellSafety from './rules/hooks-command-shell-safety.ts'
import * as hooksCommittedCommandReview from './rules/hooks-committed-command-review.ts'
import * as hooksConfigSchema from './rules/hooks-config-schema.ts'
import * as hooksDisableAllOverride from './rules/hooks-disable-all-override.ts'
import * as hooksDisabledByDisableallhooks from './rules/hooks-disabled-by-disableallhooks.ts'
import * as hooksDuplicateHandler from './rules/hooks-duplicate-handler.ts'
import * as hooksEnvVarUnavailable from './rules/hooks-env-var-unavailable.ts'
import * as hooksEventNameKnown from './rules/hooks-event-name-known.ts'
import * as hooksExecFormCommandSpaces from './rules/hooks-exec-form-command-spaces.ts'
import * as hooksExecFormShellSyntax from './rules/hooks-exec-form-shell-syntax.ts'
import * as hooksExecFormWindowsShim from './rules/hooks-exec-form-windows-shim.ts'
import * as hooksFilechangedStarMatcher from './rules/hooks-filechanged-star-matcher.ts'
import * as hooksHandlerFieldIgnored from './rules/hooks-handler-field-ignored.ts'
import * as hooksHandlerFieldUnknown from './rules/hooks-handler-field-unknown.ts'
import * as hooksHandlerTypeEventSupport from './rules/hooks-handler-type-event-support.ts'
import * as hooksHttpEnvAllowlist from './rules/hooks-http-env-allowlist.ts'
import * as hooksHttpLiteralSecret from './rules/hooks-http-literal-secret.ts'
import * as hooksIfCondition from './rules/hooks-if-condition.ts'
import * as hooksIfDirGlobDepth from './rules/hooks-if-dir-glob-depth.ts'
import * as hooksMatcherBashWithoutPowershell from './rules/hooks-matcher-bash-without-powershell.ts'
import * as hooksMatcherDeprecatedValue from './rules/hooks-matcher-deprecated-value.ts'
import * as hooksMatcherEnum from './rules/hooks-matcher-enum.ts'
import * as hooksMatcherLegacyVersion from './rules/hooks-matcher-legacy-version.ts'
import * as hooksMatcherMcpName from './rules/hooks-matcher-mcp-name.ts'
import * as hooksMatcherNameUnresolved from './rules/hooks-matcher-name-unresolved.ts'
import * as hooksMatcherNeverMatches from './rules/hooks-matcher-never-matches.ts'
import * as hooksMatcherSubagentAnchor from './rules/hooks-matcher-subagent-anchor.ts'
import * as hooksMatcherSyntax from './rules/hooks-matcher-syntax.ts'
import * as hooksMatcherUnanchoredRegex from './rules/hooks-matcher-unanchored-regex.ts'
import * as hooksMatcherUnsupportedEvent from './rules/hooks-matcher-unsupported-event.ts'
import * as hooksMultipleUpdatedinput from './rules/hooks-multiple-updatedinput.ts'
import * as hooksNoStandaloneFile from './rules/hooks-no-standalone-file.ts'
import * as hooksOutputBlockingExitCode from './rules/hooks-output-blocking-exit-code.ts'
import * as hooksOutputDeprecatedFields from './rules/hooks-output-deprecated-fields.ts'
import * as hooksOutputSchema from './rules/hooks-output-schema.ts'
import * as hooksOutputSize from './rules/hooks-output-size.ts'
import * as hooksPlaceholderQuoted from './rules/hooks-placeholder-quoted.ts'
import * as hooksPowershellPlaceholder from './rules/hooks-powershell-placeholder.ts'
import * as hooksPreferExecForm from './rules/hooks-prefer-exec-form.ts'
import * as hooksPromptOnPermissionRequest from './rules/hooks-prompt-on-permission-request.ts'
import * as hooksPs1NeedsPowershellShell from './rules/hooks-ps1-needs-powershell-shell.ts'
import * as hooksScriptExecutable from './rules/hooks-script-executable.ts'
import * as hooksScriptExists from './rules/hooks-script-exists.ts'
import * as hooksScriptShebang from './rules/hooks-script-shebang.ts'
import * as hooksSessionendDefaultTimeout from './rules/hooks-sessionend-default-timeout.ts'
import * as hooksSessionstartStaticContext from './rules/hooks-sessionstart-static-context.ts'
import * as hooksStopLoopGuard from './rules/hooks-stop-loop-guard.ts'
import * as hooksTimeoutUnits from './rules/hooks-timeout-units.ts'
import * as hooksWorktreeCreateWithoutRemove from './rules/hooks-worktree-create-without-remove.ts'
import * as lspDuplicateServerName from './rules/lsp-duplicate-server-name.ts'
import * as lspExtensionConflict from './rules/lsp-extension-conflict.ts'
import * as lspJsonLocation from './rules/lsp-json-location.ts'
import * as lspJsonSchema from './rules/lsp-json-schema.ts'
import * as lspTransportSocket from './rules/lsp-transport-socket.ts'
import * as marketplaceArchiveSha256 from './rules/marketplace-archive-sha256.ts'
import * as marketplaceCommandLinkMode from './rules/marketplace-command-link-mode.ts'
import * as marketplaceCommandSource from './rules/marketplace-command-source.ts'
import * as marketplaceCommandVersionIgnored from './rules/marketplace-command-version-ignored.ts'
import * as marketplaceEntryComponentPaths from './rules/marketplace-entry-component-paths.ts'
import * as marketplaceEntryHooksInline from './rules/marketplace-entry-hooks-inline.ts'
import * as marketplaceEntryHooksOverride from './rules/marketplace-entry-hooks-override.ts'
import * as marketplaceEntryManifestOnlyFields from './rules/marketplace-entry-manifest-only-fields.ts'
import * as marketplaceEntryNameMatchesManifest from './rules/marketplace-entry-name-matches-manifest.ts'
import * as marketplaceEntryRootSkills from './rules/marketplace-entry-root-skills.ts'
import * as marketplaceHeadersHelperCommand from './rules/marketplace-headers-helper-command.ts'
import * as marketplaceHeadersLiteralCredential from './rules/marketplace-headers-literal-credential.ts'
import * as marketplaceLocation from './rules/marketplace-location.ts'
import * as marketplaceMinVersion from './rules/marketplace-min-version.ts'
import * as marketplaceNameReserved from './rules/marketplace-name-reserved.ts'
import * as marketplaceRelativeSourceBackslash from './rules/marketplace-relative-source-backslash.ts'
import * as marketplaceRelativeSourceEscapeSymlink from './rules/marketplace-relative-source-escape-symlink.ts'
import * as marketplaceRelativeSourceExists from './rules/marketplace-relative-source-exists.ts'
import * as marketplaceRelativeSourceFormat from './rules/marketplace-relative-source-format.ts'
import * as marketplaceRelativeSourceUrlHosted from './rules/marketplace-relative-source-url-hosted.ts'
import * as marketplaceSchema from './rules/marketplace-schema.ts'
import * as marketplaceSelfHostedRootSource from './rules/marketplace-self-hosted-root-source.ts'
import * as marketplaceSourceSchema from './rules/marketplace-source-schema.ts'
import * as marketplaceStrictFalseConflict from './rules/marketplace-strict-false-conflict.ts'
import * as marketplaceVersionDuplicate from './rules/marketplace-version-duplicate.ts'
import * as mcpAllowDenyOverlap from './rules/mcp-allow-deny-overlap.ts'
import * as mcpAllowlistEmpty from './rules/mcp-allowlist-empty.ts'
import * as mcpAllowlistServernameDead from './rules/mcp-allowlist-servername-dead.ts'
import * as mcpAlwaysLoadCount from './rules/mcp-always-load-count.ts'
import * as mcpAnthropicHostedUrl from './rules/mcp-anthropic-hosted-url.ts'
import * as mcpApprovalCommitted from './rules/mcp-approval-committed.ts'
import * as mcpApprovalConflict from './rules/mcp-approval-conflict.ts'
import * as mcpApprovalNamesExist from './rules/mcp-approval-names-exist.ts'
import * as mcpAuthorizationHeaderWithOauth from './rules/mcp-authorization-header-with-oauth.ts'
import * as mcpCredentialVarRemote from './rules/mcp-credential-var-remote.ts'
import * as mcpDisableConnectorsFalse from './rules/mcp-disable-connectors-false.ts'
import * as mcpDuplicateServerName from './rules/mcp-duplicate-server-name.ts'
import * as mcpEnvClientSecret from './rules/mcp-env-client-secret.ts'
import * as mcpEnvExpansionField from './rules/mcp-env-expansion-field.ts'
import * as mcpEnvVarDefault from './rules/mcp-env-var-default.ts'
import * as mcpEnvVarNumbers from './rules/mcp-env-var-numbers.ts'
import * as mcpEnvVarSyntax from './rules/mcp-env-var-syntax.ts'
import * as mcpHeadershelperCommitted from './rules/mcp-headershelper-committed.ts'
import * as mcpHeadershelperCredentialEnv from './rules/mcp-headershelper-credential-env.ts'
import * as mcpHeadershelperPath from './rules/mcp-headershelper-path.ts'
import * as mcpHiddenWhitespace from './rules/mcp-hidden-whitespace.ts'
import * as mcpInsecureUrl from './rules/mcp-insecure-url.ts'
import * as mcpJsonFileSize from './rules/mcp-json-file-size.ts'
import * as mcpJsonLocation from './rules/mcp-json-location.ts'
import * as mcpJsonServersKey from './rules/mcp-json-servers-key.ts'
import * as mcpManagedServersEntry from './rules/mcp-managed-servers-entry.ts'
import * as mcpNoLiteralSecrets from './rules/mcp-no-literal-secrets.ts'
import * as mcpNoSseTransport from './rules/mcp-no-sse-transport.ts'
import * as mcpOauthTransport from './rules/mcp-oauth-transport.ts'
import * as mcpOauthValues from './rules/mcp-oauth-values.ts'
import * as mcpPluginRootPaths from './rules/mcp-plugin-root-paths.ts'
import * as mcpPluginStdioReach from './rules/mcp-plugin-stdio-reach.ts'
import * as mcpPluginToolNameScoped from './rules/mcp-plugin-tool-name-scoped.ts'
import * as mcpPolicyEntrySchema from './rules/mcp-policy-entry-schema.ts'
import * as mcpPolicyLiteralValues from './rules/mcp-policy-literal-values.ts'
import * as mcpPolicyServernameWeak from './rules/mcp-policy-servername-weak.ts'
import * as mcpProjectDirDefault from './rules/mcp-project-dir-default.ts'
import * as mcpProjectPluginBundle from './rules/mcp-project-plugin-bundle.ts'
import * as mcpProjectToggleKeys from './rules/mcp-project-toggle-keys.ts'
import * as mcpRemoteUrlEmpty from './rules/mcp-remote-url-empty.ts'
import * as mcpServerNameAnthropicSkills from './rules/mcp-server-name-anthropic-skills.ts'
import * as mcpServerNameFormat from './rules/mcp-server-name-format.ts'
import * as mcpServerNameReserved from './rules/mcp-server-name-reserved.ts'
import * as mcpSettingsMcpservers from './rules/mcp-settings-mcpservers.ts'
import * as mcpStdioCommandHasArgs from './rules/mcp-stdio-command-has-args.ts'
import * as mcpStdioRelativePath from './rules/mcp-stdio-relative-path.ts'
import * as mcpTimeoutMin from './rules/mcp-timeout-min.ts'
import * as mcpToolNameFormat from './rules/mcp-tool-name-format.ts'
import * as mcpToolServerUnknown from './rules/mcp-tool-server-unknown.ts'
import * as mcpUnknownKeys from './rules/mcp-unknown-keys.ts'
import * as memoryAgentMemoryLocalUntracked from './rules/memory-agent-memory-local-untracked.ts'
import * as memoryAgentMemoryOrphan from './rules/memory-agent-memory-orphan.ts'
import * as memoryAutoMemoryDirectoryCommitted from './rules/memory-auto-memory-directory-committed.ts'
import * as memoryIndexEntryFormat from './rules/memory-index-entry-format.ts'
import * as memoryIndexMaxSize from './rules/memory-index-max-size.ts'
import * as memorySettingsSchema from './rules/memory-settings-schema.ts'
import * as memorySymlinkNetworkTarget from './rules/memory-symlink-network-target.ts'
import * as memoryTopicFrontmatter from './rules/memory-topic-frontmatter.ts'
import * as outputStyleForceForPlugin from './rules/output-style-force-for-plugin.ts'
import * as outputStyleFrontmatterSchema from './rules/output-style-frontmatter-schema.ts'
import * as outputStyleFrontmatterValid from './rules/output-style-frontmatter-valid.ts'
import * as outputStyleNameUnique from './rules/output-style-name-unique.ts'
import * as outputStylePluginNameDescription from './rules/output-style-plugin-name-description.ts'
import * as permissionsAdditionalDirectoriesNoConfig from './rules/permissions-additional-directories-no-config.ts'
import * as permissionsAdditionalDirectoriesPath from './rules/permissions-additional-directories-path.ts'
import * as permissionsAgentRuleExists from './rules/permissions-agent-rule-exists.ts'
import * as permissionsAllowDirDepth from './rules/permissions-allow-dir-depth.ts'
import * as permissionsAllowUnrestricted from './rules/permissions-allow-unrestricted.ts'
import * as permissionsAutoModeDefaults from './rules/permissions-auto-mode-defaults.ts'
import * as permissionsAutoModeDroppedAllow from './rules/permissions-auto-mode-dropped-allow.ts'
import * as permissionsAutoModePushAsk from './rules/permissions-auto-mode-push-ask.ts'
import * as permissionsAutoModeRuleSyntax from './rules/permissions-auto-mode-rule-syntax.ts'
import * as permissionsAutoModeSchema from './rules/permissions-auto-mode-schema.ts'
import * as permissionsBashArgumentConstraint from './rules/permissions-bash-argument-constraint.ts'
import * as permissionsBashColonStarMid from './rules/permissions-bash-colon-star-mid.ts'
import * as permissionsBashColonStarSuffix from './rules/permissions-bash-colon-star-suffix.ts'
import * as permissionsBashDenyNotBoundary from './rules/permissions-bash-deny-not-boundary.ts'
import * as permissionsBashExecWrapperPrefix from './rules/permissions-bash-exec-wrapper-prefix.ts'
import * as permissionsBashGluedWildcard from './rules/permissions-bash-glued-wildcard.ts'
import * as permissionsBashReadonlyRedundant from './rules/permissions-bash-readonly-redundant.ts'
import * as permissionsBashRunnerWildcard from './rules/permissions-bash-runner-wildcard.ts'
import * as permissionsBashStrippedWrapper from './rules/permissions-bash-stripped-wrapper.ts'
import * as permissionsBashWildcardBeforeSubcommand from './rules/permissions-bash-wildcard-before-subcommand.ts'
import * as permissionsBlockReadsFalse from './rules/permissions-block-reads-false.ts'
import * as permissionsBypassModeCommitted from './rules/permissions-bypass-mode-committed.ts'
import * as permissionsCdAllowlist from './rules/permissions-cd-allowlist.ts'
import * as permissionsDeadAllow from './rules/permissions-dead-allow.ts'
import * as permissionsDefaultModeConflict from './rules/permissions-default-mode-conflict.ts'
import * as permissionsDefaultModeManualAlias from './rules/permissions-default-mode-manual-alias.ts'
import * as permissionsDefaultModeProjectIgnored from './rules/permissions-default-mode-project-ignored.ts'
import * as permissionsDefaultModeSurface from './rules/permissions-default-mode-surface.ts'
import * as permissionsDefaultModeValue from './rules/permissions-default-mode-value.ts'
import * as permissionsDenyAllTools from './rules/permissions-deny-all-tools.ts'
import * as permissionsDenyDirListable from './rules/permissions-deny-dir-listable.ts'
import * as permissionsDenySecretFiles from './rules/permissions-deny-secret-files.ts'
import * as permissionsDisableModeValue from './rules/permissions-disable-mode-value.ts'
import * as permissionsDuplicateRule from './rules/permissions-duplicate-rule.ts'
import * as permissionsEndConversation from './rules/permissions-end-conversation.ts'
import * as permissionsGlobGrepAllow from './rules/permissions-glob-grep-allow.ts'
import * as permissionsIgnorePatterns from './rules/permissions-ignore-patterns.ts'
import * as permissionsInvalidPathPattern from './rules/permissions-invalid-path-pattern.ts'
import * as permissionsLegacyToolName from './rules/permissions-legacy-tool-name.ts'
import * as permissionsMcpRuleParens from './rules/permissions-mcp-rule-parens.ts'
import * as permissionsMcpServerExists from './rules/permissions-mcp-server-exists.ts'
import * as permissionsNegation from './rules/permissions-negation.ts'
import * as permissionsParamRule from './rules/permissions-param-rule.ts'
import * as permissionsParamRuleIntent from './rules/permissions-param-rule-intent.ts'
import * as permissionsPathAnchor from './rules/permissions-path-anchor.ts'
import * as permissionsPathRuleTool from './rules/permissions-path-rule-tool.ts'
import * as permissionsProtectedPathAllow from './rules/permissions-protected-path-allow.ts'
import * as permissionsReadDenyNotebook from './rules/permissions-read-deny-notebook.ts'
import * as permissionsRuleSyntax from './rules/permissions-rule-syntax.ts'
import * as permissionsSandboxBashAsk from './rules/permissions-sandbox-bash-ask.ts'
import * as permissionsSchema from './rules/permissions-schema.ts'
import * as permissionsSkillRule from './rules/permissions-skill-rule.ts'
import * as permissionsSpecifierUnsupported from './rules/permissions-specifier-unsupported.ts'
import * as permissionsToolNameGlob from './rules/permissions-tool-name-glob.ts'
import * as permissionsUnknownTool from './rules/permissions-unknown-tool.ts'
import * as permissionsWebfetchApex from './rules/permissions-webfetch-apex.ts'
import * as permissionsWebfetchDomainSyntax from './rules/permissions-webfetch-domain-syntax.ts'
import * as permissionsWebfetchMidWildcard from './rules/permissions-webfetch-mid-wildcard.ts'
import * as permissionsWindowsPath from './rules/permissions-windows-path.ts'
import * as pluginBinClaudeAi from './rules/plugin-bin-claude-ai.ts'
import * as pluginBinExecutable from './rules/plugin-bin-executable.ts'
import * as pluginBinShadowsSystemCommand from './rules/plugin-bin-shadows-system-command.ts'
import * as pluginChannelServerStdio from './rules/plugin-channel-server-stdio.ts'
import * as pluginCommandsDirNonempty from './rules/plugin-commands-dir-nonempty.ts'
import * as pluginCommandsMapFields from './rules/plugin-commands-map-fields.ts'
import * as pluginDefaultDirShadowed from './rules/plugin-default-dir-shadowed.ts'
import * as pluginDependenciesNotAutoInstalled from './rules/plugin-dependencies-not-auto-installed.ts'
import * as pluginDependenciesPrereleaseRange from './rules/plugin-dependencies-prerelease-range.ts'
import * as pluginDependenciesResolve from './rules/plugin-dependencies-resolve.ts'
import * as pluginDirNotMarketplaceRoot from './rules/plugin-dir-not-marketplace-root.ts'
import * as pluginEvalsCaseYaml from './rules/plugin-evals-case-yaml.ts'
import * as pluginEvalsDir from './rules/plugin-evals-dir.ts'
import * as pluginEvalsGrader from './rules/plugin-evals-grader.ts'
import * as pluginEvalsMockSchema from './rules/plugin-evals-mock-schema.ts'
import * as pluginEvalsMockServerExists from './rules/plugin-evals-mock-server-exists.ts'
import * as pluginEvalsPromptFrontmatter from './rules/plugin-evals-prompt-frontmatter.ts'
import * as pluginEvalsPromptNoAtMentions from './rules/plugin-evals-prompt-no-at-mentions.ts'
import * as pluginEvalsReplayCommitted from './rules/plugin-evals-replay-committed.ts'
import * as pluginEvalsResultsGitignored from './rules/plugin-evals-results-gitignored.ts'
import * as pluginFeatureMinVersion from './rules/plugin-feature-min-version.ts'
import * as pluginManifestLocation from './rules/plugin-manifest-location.ts'
import * as pluginManifestMetadataFormat from './rules/plugin-manifest-metadata-format.ts'
import * as pluginManifestNoBom from './rules/plugin-manifest-no-bom.ts'
import * as pluginManifestPublishMetadata from './rules/plugin-manifest-publish-metadata.ts'
import * as pluginManifestVersionSemver from './rules/plugin-manifest-version-semver.ts'
import * as pluginMonitorsCommandEnv from './rules/plugin-monitors-command-env.ts'
import * as pluginMonitorsCommandQuote from './rules/plugin-monitors-command-quote.ts'
import * as pluginMonitorsSkillExists from './rules/plugin-monitors-skill-exists.ts'
import * as pluginNoGitLfs from './rules/plugin-no-git-lfs.ts'
import * as pluginNoParentPathEscape from './rules/plugin-no-parent-path-escape.ts'
import * as pluginNoProjectPluginsDir from './rules/plugin-no-project-plugins-dir.ts'
import * as pluginNoStateInPluginRoot from './rules/plugin-no-state-in-plugin-root.ts'
import * as pluginNpmSourceShrinkwrap from './rules/plugin-npm-source-shrinkwrap.ts'
import * as pluginPackageLifecycleScripts from './rules/plugin-package-lifecycle-scripts.ts'
import * as pluginPackageLockfile from './rules/plugin-package-lockfile.ts'
import * as pluginPackageLockfileChoice from './rules/plugin-package-lockfile-choice.ts'
import * as pluginPathNoBackslash from './rules/plugin-path-no-backslash.ts'
import * as pluginPathUsesPluginRoot from './rules/plugin-path-uses-plugin-root.ts'
import * as pluginPathVarBraced from './rules/plugin-path-var-braced.ts'
import * as pluginProjectSkillsDirLimits from './rules/plugin-project-skills-dir-limits.ts'
import * as pluginRelevanceSignalHints from './rules/plugin-relevance-signal-hints.ts'
import * as pluginSettingsAgentExists from './rules/plugin-settings-agent-exists.ts'
import * as pluginSettingsSingleSource from './rules/plugin-settings-single-source.ts'
import * as pluginSkillDirLayout from './rules/plugin-skill-dir-layout.ts'
import * as pluginSkillsKeyRedundantDefault from './rules/plugin-skills-key-redundant-default.ts'
import * as pluginSymlinkEscapesMarketplace from './rules/plugin-symlink-escapes-marketplace.ts'
import * as pluginSymlinkEscapesPlugin from './rules/plugin-symlink-escapes-plugin.ts'
import * as pluginThemesLayout from './rules/plugin-themes-layout.ts'
import * as pluginUserConfigFieldApplicability from './rules/plugin-user-config-field-applicability.ts'
import * as pluginUserConfigNoShellFields from './rules/plugin-user-config-no-shell-fields.ts'
import * as pluginUserConfigSensitive from './rules/plugin-user-config-sensitive.ts'
import * as pluginUserConfigSensitiveInContent from './rules/plugin-user-config-sensitive-in-content.ts'
import * as rulesFrontmatterSchema from './rules/rules-frontmatter-schema.ts'
import * as rulesMaxLines from './rules/rules-max-lines.ts'
import * as rulesMdExtension from './rules/rules-md-extension.ts'
import * as rulesPathsGlobValid from './rules/rules-paths-glob-valid.ts'
import * as rulesPathsNoMatch from './rules/rules-paths-no-match.ts'
import * as rulesSymlinkExternal from './rules/rules-symlink-external.ts'
import * as rulesSymlinkExternalScoped from './rules/rules-symlink-external-scoped.ts'
import * as sandboxAllowWriteEscalation from './rules/sandbox-allow-write-escalation.ts'
import * as sandboxCredentialsAws from './rules/sandbox-credentials-aws.ts'
import * as sandboxCredentialsMask from './rules/sandbox-credentials-mask.ts'
import * as sandboxCredentialsMaskFallback from './rules/sandbox-credentials-mask-fallback.ts'
import * as sandboxCredentialsRecommended from './rules/sandbox-credentials-recommended.ts'
import * as sandboxDockerExcluded from './rules/sandbox-docker-excluded.ts'
import * as sandboxDomainBroad from './rules/sandbox-domain-broad.ts'
import * as sandboxDomainDuplicate from './rules/sandbox-domain-duplicate.ts'
import * as sandboxDomainOverlap from './rules/sandbox-domain-overlap.ts'
import * as sandboxDomainSyntax from './rules/sandbox-domain-syntax.ts'
import * as sandboxExcludedCommandsBroad from './rules/sandbox-excluded-commands-broad.ts'
import * as sandboxExcludedCommandsSyntax from './rules/sandbox-excluded-commands-syntax.ts'
import * as sandboxFilesystemDisabledConflict from './rules/sandbox-filesystem-disabled-conflict.ts'
import * as sandboxPlatformLimits from './rules/sandbox-platform-limits.ts'
import * as sandboxProxyEnv from './rules/sandbox-proxy-env.ts'
import * as sandboxSchema from './rules/sandbox-schema.ts'
import * as sandboxScope from './rules/sandbox-scope.ts'
import * as sandboxSettingsWithoutEnabled from './rules/sandbox-settings-without-enabled.ts'
import * as sandboxUnsandboxedRetry from './rules/sandbox-unsandboxed-retry.ts'
import * as sandboxWeakeningOptions from './rules/sandbox-weakening-options.ts'
import * as settingsAgentExists from './rules/settings-agent-exists.ts'
import * as settingsAttributionFalse from './rules/settings-attribution-false.ts'
import * as settingsCommittedHelperCommand from './rules/settings-committed-helper-command.ts'
import * as settingsConflictingKeys from './rules/settings-conflicting-keys.ts'
import * as settingsDefaultshellPowershellTool from './rules/settings-defaultshell-powershell-tool.ts'
import * as settingsDeprecatedKey from './rules/settings-deprecated-key.ts'
import * as settingsEnabledPluginsEntryExists from './rules/settings-enabled-plugins-entry-exists.ts'
import * as settingsEnabledPluginsExternalSource from './rules/settings-enabled-plugins-external-source.ts'
import * as settingsEnabledPluginsMarketplaceDeclared from './rules/settings-enabled-plugins-marketplace-declared.ts'
import * as settingsEnabledPluginsSchema from './rules/settings-enabled-plugins-schema.ts'
import * as settingsEnvContextCost from './rules/settings-env-context-cost.ts'
import * as settingsEnvCredential from './rules/settings-env-credential.ts'
import * as settingsEnvDeprecatedVar from './rules/settings-env-deprecated-var.ts'
import * as settingsEnvFormatHeuristic from './rules/settings-env-format-heuristic.ts'
import * as settingsEnvIgnoredVar from './rules/settings-env-ignored-var.ts'
import * as settingsEnvNumericSpelling from './rules/settings-env-numeric-spelling.ts'
import * as settingsEnvPromptCachingOff from './rules/settings-env-prompt-caching-off.ts'
import * as settingsEnvRouting from './rules/settings-env-routing.ts'
import * as settingsEnvSecretHeuristic from './rules/settings-env-secret-heuristic.ts'
import * as settingsEnvShadowed from './rules/settings-env-shadowed.ts'
import * as settingsEnvValueFormat from './rules/settings-env-value-format.ts'
import * as settingsExtraKnownMarketplacesDirectory from './rules/settings-extra-known-marketplaces-directory.ts'
import * as settingsExtraKnownMarketplacesKeyMatchesName from './rules/settings-extra-known-marketplaces-key-matches-name.ts'
import * as settingsExtraKnownMarketplacesSchema from './rules/settings-extra-known-marketplaces-schema.ts'
import * as settingsFileSize from './rules/settings-file-size.ts'
import * as settingsFooterlinksPattern from './rules/settings-footerlinks-pattern.ts'
import * as settingsGlobalOnlyFile from './rules/settings-global-only-file.ts'
import * as settingsKeyScope from './rules/settings-key-scope.ts'
import * as settingsKnownMarketplacesPatternAnchored from './rules/settings-known-marketplaces-pattern-anchored.ts'
import * as settingsKnownMarketplacesPolicySchema from './rules/settings-known-marketplaces-policy-schema.ts'
import * as settingsLocalGitignored from './rules/settings-local-gitignored.ts'
import * as settingsLocalLocation from './rules/settings-local-location.ts'
import * as settingsLocalUntracked from './rules/settings-local-untracked.ts'
import * as settingsManagedEffortCap from './rules/settings-managed-effort-cap.ts'
import * as settingsManagedFile from './rules/settings-managed-file.ts'
import * as settingsManagedMerge from './rules/settings-managed-merge.ts'
import * as settingsManagedValueForm from './rules/settings-managed-value-form.ts'
import * as settingsManagedVersionFloor from './rules/settings-managed-version-floor.ts'
import * as settingsMarketplaceHeadersHelperHttps from './rules/settings-marketplace-headers-helper-https.ts'
import * as settingsMarketplaceKeyAlias from './rules/settings-marketplace-key-alias.ts'
import * as settingsMarketplaceKeyAliasConflict from './rules/settings-marketplace-key-alias-conflict.ts'
import * as settingsMarketplaceSkipLfs from './rules/settings-marketplace-skip-lfs.ts'
import * as settingsModelCapability from './rules/settings-model-capability.ts'
import * as settingsModelList from './rules/settings-model-list.ts'
import * as settingsModelPinVersion from './rules/settings-model-pin-version.ts'
import * as settingsModelValue from './rules/settings-model-value.ts'
import * as settingsNestedProjectFile from './rules/settings-nested-project-file.ts'
import * as settingsOutputstyleResolves from './rules/settings-outputstyle-resolves.ts'
import * as settingsPluginSuggestionMarketplacesSource from './rules/settings-plugin-suggestion-marketplaces-source.ts'
import * as settingsProjectAutocontinueOff from './rules/settings-project-autocontinue-off.ts'
import * as settingsProjectValueIgnored from './rules/settings-project-value-ignored.ts'
import * as settingsRedundantValue from './rules/settings-redundant-value.ts'
import * as settingsRemovedKey from './rules/settings-removed-key.ts'
import * as settingsSchema from './rules/settings-schema.ts'
import * as settingsSchemaUrl from './rules/settings-schema-url.ts'
import * as settingsSkilloverridesKey from './rules/settings-skilloverrides-key.ts'
import * as settingsSkilloverridesUnknownSkill from './rules/settings-skilloverrides-unknown-skill.ts'
import * as settingsStrictKnownMarketplacesSkillsDir from './rules/settings-strict-known-marketplaces-skills-dir.ts'
import * as settingsSyncClaudeAiPlugins from './rules/settings-sync-claude-ai-plugins.ts'
import * as settingsValidJson from './rules/settings-valid-json.ts'
import * as settingsWebfetchPreflightSkip from './rules/settings-webfetch-preflight-skip.ts'
import * as settingsWorktreePaths from './rules/settings-worktree-paths.ts'
import * as settingsWorktreeSparseClaudeDir from './rules/settings-worktree-sparse-claude-dir.ts'
import * as skillAgentExists from './rules/skill-agent-exists.ts'
import * as skillAllowedToolsBroad from './rules/skill-allowed-tools-broad.ts'
import * as skillAllowedToolsIneffective from './rules/skill-allowed-tools-ineffective.ts'
import * as skillArgumentEscape from './rules/skill-argument-escape.ts'
import * as skillBodyTokenBudget from './rules/skill-body-token-budget.ts'
import * as skillBooleanLiteral from './rules/skill-boolean-literal.ts'
import * as skillDescriptionMaxLength from './rules/skill-description-max-length.ts'
import * as skillDescriptionPresent from './rules/skill-description-present.ts'
import * as skillFileLayout from './rules/skill-file-layout.ts'
import * as skillForkFieldsRequireContext from './rules/skill-fork-fields-require-context.ts'
import * as skillFrontmatterPosition from './rules/skill-frontmatter-position.ts'
import * as skillFrontmatterSchema from './rules/skill-frontmatter-schema.ts'
import * as skillInjectBangPosition from './rules/skill-inject-bang-position.ts'
import * as skillInjectRobustness from './rules/skill-inject-robustness.ts'
import * as skillInvocationRedundantFields from './rules/skill-invocation-redundant-fields.ts'
import * as skillInvocationUnreachable from './rules/skill-invocation-unreachable.ts'
import * as skillListingBudget from './rules/skill-listing-budget.ts'
import * as skillLiteralDollar from './rules/skill-literal-dollar.ts'
import * as skillLoopReferenceInvocable from './rules/skill-loop-reference-invocable.ts'
import * as skillMaxLines from './rules/skill-max-lines.ts'
import * as skillMetadataReservedKeys from './rules/skill-metadata-reserved-keys.ts'
import * as skillModelOverride from './rules/skill-model-override.ts'
import * as skillNameShadowsBuiltin from './rules/skill-name-shadows-builtin.ts'
import * as skillNameUnique from './rules/skill-name-unique.ts'
import * as skillNoBom from './rules/skill-no-bom.ts'
import * as skillPathsGlobValid from './rules/skill-paths-glob-valid.ts'
import * as skillPluginNamePrefix from './rules/skill-plugin-name-prefix.ts'
import * as skillPluginPathVars from './rules/skill-plugin-path-vars.ts'
import * as skillPluginRootName from './rules/skill-plugin-root-name.ts'
import * as skillPluginRootShadowed from './rules/skill-plugin-root-shadowed.ts'
import * as skillPluginVarsOutsidePlugin from './rules/skill-plugin-vars-outside-plugin.ts'
import * as skillPrecedenceShadowing from './rules/skill-precedence-shadowing.ts'
import * as skillReferenceExists from './rules/skill-reference-exists.ts'
import * as skillReservedName from './rules/skill-reserved-name.ts'
import * as skillShellPlatform from './rules/skill-shell-platform.ts'
import * as skillSideEffectsManualOnly from './rules/skill-side-effects-manual-only.ts'
import * as statuslineHomePathShared from './rules/statusline-home-path-shared.ts'
import * as statuslineScriptExists from './rules/statusline-script-exists.ts'
import * as statuslineScriptTerminalSize from './rules/statusline-script-terminal-size.ts'
import * as statuslineWindowsPath from './rules/statusline-windows-path.ts'

// Read at run time, not imported, so `dist/` does not need its own copy.
// `../package.json` resolves from both `src/` and `dist/`.
const { name, version } = createRequire(import.meta.url)('../package.json') as {
  name: string
  version: string
}

// A call lets Knip count the members of each namespace import as used. Knip
// does not follow a namespace that sits bare in an array.
const entry = <T>(module: T) => module

// Each rule module names its own files and language, so a new rule adds no
// entry to a central glob list.
const modules = [
  entry(skillDescriptionMaxLength),
  entry(commandLegacyFormat),
  entry(hooksEventNameKnown),
  entry(hooksAgentStopEvent),
  entry(hooksAgentTypeExperimental),
  entry(hooksAsyncOnBlockingEvent),
  entry(hooksBroadAutoApprove),
  entry(hooksCommandDeprecatedCliFlag),
  entry(hooksCommandPathVariable),
  entry(hooksCommandRemovedCliFlag),
  entry(hooksCommandShellSafety),
  entry(hooksCommittedCommandReview),
  entry(hooksConfigSchema),
  entry(hooksDisableAllOverride),
  entry(hooksDisabledByDisableallhooks),
  entry(hooksDuplicateHandler),
  entry(hooksEnvVarUnavailable),
  entry(hooksExecFormCommandSpaces),
  entry(hooksExecFormShellSyntax),
  entry(hooksExecFormWindowsShim),
  entry(hooksFilechangedStarMatcher),
  entry(hooksHandlerFieldIgnored),
  entry(hooksHandlerFieldUnknown),
  entry(hooksHandlerTypeEventSupport),
  entry(hooksHttpEnvAllowlist),
  entry(hooksHttpLiteralSecret),
  entry(hooksIfCondition),
  entry(hooksIfDirGlobDepth),
  entry(hooksMatcherBashWithoutPowershell),
  entry(hooksMatcherDeprecatedValue),
  entry(hooksMatcherEnum),
  entry(hooksMatcherLegacyVersion),
  entry(hooksMatcherMcpName),
  entry(hooksMatcherNameUnresolved),
  entry(hooksMatcherNeverMatches),
  entry(hooksMatcherSubagentAnchor),
  entry(hooksMatcherSyntax),
  entry(hooksMatcherUnanchoredRegex),
  entry(hooksMatcherUnsupportedEvent),
  entry(hooksMultipleUpdatedinput),
  entry(hooksNoStandaloneFile),
  entry(hooksOutputBlockingExitCode),
  entry(hooksOutputDeprecatedFields),
  entry(hooksOutputSchema),
  entry(hooksOutputSize),
  entry(hooksPlaceholderQuoted),
  entry(hooksPowershellPlaceholder),
  entry(hooksPreferExecForm),
  entry(hooksPromptOnPermissionRequest),
  entry(hooksPs1NeedsPowershellShell),
  entry(hooksScriptShebang),
  entry(hooksSessionendDefaultTimeout),
  entry(hooksSessionstartStaticContext),
  entry(hooksStopLoopGuard),
  entry(hooksTimeoutUnits),
  entry(hooksWorktreeCreateWithoutRemove),
  entry(skillFrontmatterPosition),
  entry(skillFrontmatterSchema),
  entry(skillForkFieldsRequireContext),
  entry(skillInvocationUnreachable),
  entry(skillReservedName),
  entry(skillPluginVarsOutsidePlugin),
  entry(skillInjectBangPosition),
  entry(skillAllowedToolsIneffective),
  entry(skillAllowedToolsBroad),
  entry(skillPluginRootShadowed),
  entry(skillFileLayout),
  entry(skillReferenceExists),
  entry(skillAgentExists),
  entry(skillNameUnique),
  entry(skillPathsGlobValid),
  entry(skillBooleanLiteral),
  entry(skillDescriptionPresent),
  entry(skillInvocationRedundantFields),
  entry(skillMetadataReservedKeys),
  entry(skillNameShadowsBuiltin),
  entry(skillNoBom),
  entry(skillArgumentEscape),
  entry(skillMaxLines),
  entry(skillPluginNamePrefix),
  entry(skillPluginRootName),
  entry(skillShellPlatform),
  entry(skillBodyTokenBudget),
  entry(skillInjectRobustness),
  entry(skillListingBudget),
  entry(skillLiteralDollar),
  entry(skillLoopReferenceInvocable),
  entry(skillModelOverride),
  entry(skillPluginPathVars),
  entry(skillPrecedenceShadowing),
  entry(skillSideEffectsManualOnly),
  entry(agentFrontmatterValid),
  entry(agentFrontmatterSchema),
  entry(agentPluginIgnoredFields),
  entry(agentMcpServersSchema),
  entry(agentPermissionModeBypass),
  entry(agentMemoryGrantsWrite),
  entry(agentToolsKnown),
  entry(agentToolsUnavailable),
  entry(agentNameUnique),
  entry(agentSkillsPreloadable),
  entry(agentMemoryAutoMemoryOff),
  entry(agentOmitClaudeMdMain),
  entry(agentModelForced),
  entry(agentTeamsNoProjectConfig),
  entry(outputStyleFrontmatterValid),
  entry(outputStyleFrontmatterSchema),
  entry(agentDisallowedToolsScope),
  entry(agentFieldMinVersion),
  entry(agentMcpServersInlineTrust),
  entry(agentMemoryScopeProject),
  entry(agentNameShadowing),
  entry(agentNameShadowsBuiltin),
  entry(agentNoBom),
  entry(agentPermissionModeManual),
  entry(agentPluginScopedNameUnique),
  entry(agentToolsConditional),
  entry(agentToolsTaskAlias),
  entry(outputStyleForceForPlugin),
  entry(outputStyleNameUnique),
  entry(outputStylePluginNameDescription),
  entry(agentInitialPromptMainOnly),
  entry(agentMcpServersRefExists),
  entry(agentModelValue),
  entry(agentSkillsExist),
  entry(agentToolsAgentTypeList),
  entry(agentToolsSkillForPreload),
  entry(agentBodyNonempty),
  entry(agentDescriptionProactive),
  entry(agentDescriptionsBudget),
  entry(agentNameKebabCase),
  entry(agentTeammateIgnoredFields),
  entry(permissionsRuleSyntax),
  entry(permissionsUnknownTool),
  entry(permissionsToolNameGlob),
  entry(permissionsSpecifierUnsupported),
  entry(permissionsPathRuleTool),
  entry(permissionsMcpRuleParens),
  entry(permissionsParamRule),
  entry(permissionsSkillRule),
  entry(permissionsBypassModeCommitted),
  entry(permissionsDefaultModeConflict),
  entry(permissionsDefaultModeProjectIgnored),
  entry(permissionsDefaultModeValue),
  entry(permissionsDisableModeValue),
  entry(permissionsSchema),
  entry(permissionsAllowUnrestricted),
  entry(permissionsBashExecWrapperPrefix),
  entry(permissionsBashRunnerWildcard),
  entry(permissionsBashWildcardBeforeSubcommand),
  entry(permissionsEndConversation),
  entry(permissionsProtectedPathAllow),
  entry(permissionsAdditionalDirectoriesPath),
  entry(permissionsBlockReadsFalse),
  entry(permissionsInvalidPathPattern),
  entry(permissionsNegation),
  entry(permissionsWebfetchDomainSyntax),
  entry(permissionsWindowsPath),
  entry(permissionsAutoModeSchema),
  entry(sandboxDomainSyntax),
  entry(sandboxExcludedCommandsSyntax),
  entry(sandboxFilesystemDisabledConflict),
  entry(sandboxSchema),
  entry(sandboxScope),
  entry(sandboxCredentialsAws),
  entry(sandboxCredentialsMask),
  entry(sandboxDomainOverlap),
  entry(permissionsSandboxBashAsk),
  entry(permissionsDeadAllow),
  entry(permissionsAutoModeDroppedAllow),
  entry(permissionsBashColonStarMid),
  entry(permissionsBashColonStarSuffix),
  entry(permissionsDefaultModeManualAlias),
  entry(permissionsDefaultModeSurface),
  entry(permissionsDenyAllTools),
  entry(permissionsDuplicateRule),
  entry(permissionsAllowDirDepth),
  entry(permissionsCdAllowlist),
  entry(permissionsGlobGrepAllow),
  entry(permissionsLegacyToolName),
  entry(permissionsReadDenyNotebook),
  entry(permissionsWebfetchApex),
  entry(permissionsWebfetchMidWildcard),
  entry(permissionsAutoModeDefaults),
  entry(permissionsIgnorePatterns),
  entry(sandboxCredentialsMaskFallback),
  entry(sandboxDomainDuplicate),
  entry(sandboxPlatformLimits),
  entry(sandboxWeakeningOptions),
  entry(permissionsBashGluedWildcard),
  entry(permissionsBashStrippedWrapper),
  entry(permissionsBashDenyNotBoundary),
  entry(permissionsBashArgumentConstraint),
  entry(permissionsBashReadonlyRedundant),
  entry(permissionsPathAnchor),
  entry(permissionsParamRuleIntent),
  entry(permissionsMcpServerExists),
  entry(permissionsAgentRuleExists),
  entry(permissionsAdditionalDirectoriesNoConfig),
  entry(permissionsDenyDirListable),
  entry(permissionsDenySecretFiles),
  entry(permissionsAutoModePushAsk),
  entry(permissionsAutoModeRuleSyntax),
  entry(marketplaceNameReserved),
  entry(marketplaceCommandVersionIgnored),
  entry(marketplaceHeadersHelperCommand),
  entry(marketplaceEntryHooksInline),
  entry(marketplaceSourceSchema),
  entry(marketplaceRelativeSourceFormat),
  entry(marketplaceSchema),
  entry(marketplaceEntryNameMatchesManifest),
  entry(marketplaceRelativeSourceExists),
  entry(marketplaceRelativeSourceEscapeSymlink),
  entry(marketplaceVersionDuplicate),
  entry(marketplaceEntryManifestOnlyFields),
  entry(marketplaceStrictFalseConflict),
  entry(marketplaceEntryHooksOverride),
  entry(marketplaceEntryRootSkills),
  entry(marketplaceEntryComponentPaths),
  entry(marketplaceArchiveSha256),
  entry(marketplaceCommandLinkMode),
  entry(marketplaceCommandSource),
  entry(marketplaceLocation),
  entry(marketplaceMinVersion),
  entry(marketplaceRelativeSourceBackslash),
  entry(marketplaceSelfHostedRootSource),
  entry(marketplaceRelativeSourceUrlHosted),
  entry(marketplaceHeadersLiteralCredential),
  entry(settingsEnabledPluginsSchema),
  entry(settingsEnabledPluginsEntryExists),
  entry(settingsExtraKnownMarketplacesSchema),
  entry(settingsExtraKnownMarketplacesKeyMatchesName),
  entry(settingsMarketplaceHeadersHelperHttps),
  entry(settingsMarketplaceKeyAliasConflict),
  entry(settingsSyncClaudeAiPlugins),
  entry(settingsValidJson),
  entry(settingsFileSize),
  entry(settingsKeyScope),
  entry(settingsManagedFile),
  entry(settingsRemovedKey),
  entry(settingsEnvCredential),
  entry(settingsEnvValueFormat),
  entry(settingsEnvIgnoredVar),
  entry(settingsProjectValueIgnored),
  entry(settingsKnownMarketplacesPolicySchema),
  entry(settingsPluginSuggestionMarketplacesSource),
  entry(settingsConflictingKeys),
  entry(settingsModelValue),
  entry(settingsModelList),
  entry(settingsSkilloverridesKey),
  entry(settingsEnvShadowed),
  entry(settingsSchema),
  entry(settingsAttributionFalse),
  entry(settingsDeprecatedKey),
  entry(settingsGlobalOnlyFile),
  entry(settingsOutputstyleResolves),
  entry(settingsProjectAutocontinueOff),
  entry(settingsRedundantValue),
  entry(settingsSchemaUrl),
  entry(settingsCommittedHelperCommand),
  entry(settingsEnvDeprecatedVar),
  entry(settingsEnvPromptCachingOff),
  entry(settingsEnvRouting),
  entry(settingsLocalLocation),
  entry(settingsWebfetchPreflightSkip),
  entry(settingsEnvNumericSpelling),
  entry(settingsFooterlinksPattern),
  entry(settingsManagedValueForm),
  entry(settingsManagedVersionFloor),
  entry(settingsWorktreeSparseClaudeDir),
  entry(statuslineWindowsPath),
  entry(hooksScriptExists),
  entry(hooksScriptExecutable),
  entry(pluginBinExecutable),
  entry(statuslineScriptExists),
  entry(claudeMdLocalUntracked),
  entry(memoryAgentMemoryLocalUntracked),
  entry(pluginEvalsReplayCommitted),
  entry(pluginEvalsResultsGitignored),
  entry(settingsLocalGitignored),
  entry(settingsLocalUntracked),
  entry(settingsEnabledPluginsExternalSource),
  entry(settingsEnabledPluginsMarketplaceDeclared),
  entry(settingsExtraKnownMarketplacesDirectory),
  entry(settingsKnownMarketplacesPatternAnchored),
  entry(settingsMarketplaceKeyAlias),
  entry(settingsMarketplaceSkipLfs),
  entry(settingsStrictKnownMarketplacesSkillsDir),
  entry(claudeMdAgentsMdShadowed),
  entry(claudeMdAgentsMdVariant),
  entry(claudeMdExcludesPattern),
  entry(claudeMdImportExists),
  entry(claudeMdImportMaxDepth),
  entry(claudeMdMaxBytes),
  entry(memorySettingsSchema),
  entry(memorySymlinkNetworkTarget),
  entry(rulesFrontmatterSchema),
  entry(rulesMdExtension),
  entry(rulesPathsGlobValid),
  entry(rulesSymlinkExternalScoped),
  entry(claudeMdImportExternal),
  entry(claudeMdMaxLines),
  entry(claudeMdSymlink),
  entry(memoryAutoMemoryDirectoryCommitted),
  entry(memoryIndexMaxSize),
  entry(rulesMaxLines),
  entry(rulesSymlinkExternal),
  entry(claudeMdAgentsMdProsePointer),
  entry(claudeMdCombinedSize),
  entry(claudeMdDanglingReference),
  entry(claudeMdDerivableContent),
  entry(claudeMdEmphasisOveruse),
  entry(claudeMdExcludesAbsoluteCommitted),
  entry(claudeMdGitInstructions),
  entry(claudeMdGuardrailToHook),
  entry(claudeMdHtmlCommentContent),
  entry(claudeMdImportInCodeSpan),
  entry(claudeMdLocation),
  entry(claudeMdProcedureToSkill),
  entry(memoryAgentMemoryOrphan),
  entry(memoryIndexEntryFormat),
  entry(memoryTopicFrontmatter),
  entry(rulesPathsNoMatch),
  entry(settingsAgentExists),
  entry(settingsDefaultshellPowershellTool),
  entry(settingsEnvContextCost),
  entry(settingsEnvFormatHeuristic),
  entry(settingsEnvSecretHeuristic),
  entry(settingsManagedEffortCap),
  entry(settingsManagedMerge),
  entry(settingsModelCapability),
  entry(settingsModelPinVersion),
  entry(settingsNestedProjectFile),
  entry(settingsSkilloverridesUnknownSkill),
  entry(settingsWorktreePaths),
  entry(statuslineHomePathShared),
  entry(statuslineScriptTerminalSize),
  entry(mcpJsonLocation),
  entry(mcpJsonServersKey),
  entry(mcpJsonFileSize),
  entry(mcpServerNameReserved),
  entry(mcpRemoteUrlEmpty),
  entry(mcpHiddenWhitespace),
  entry(mcpTimeoutMin),
  entry(mcpOauthTransport),
  entry(mcpOauthValues),
  entry(mcpAuthorizationHeaderWithOauth),
  entry(mcpProjectDirDefault),
  entry(mcpEnvExpansionField),
  entry(mcpCredentialVarRemote),
  entry(mcpHeadershelperCredentialEnv),
  entry(mcpSettingsMcpservers),
  entry(mcpAnthropicHostedUrl),
  entry(mcpProjectPluginBundle),
  entry(mcpToolNameFormat),
  entry(mcpApprovalCommitted),
  entry(mcpDisableConnectorsFalse),
  entry(mcpPolicyEntrySchema),
  entry(lspJsonSchema),
  entry(lspTransportSocket),
  entry(mcpAllowlistServernameDead),
  entry(mcpEnvClientSecret),
  entry(mcpManagedServersEntry),
  entry(mcpDuplicateServerName),
  entry(lspExtensionConflict),
  entry(lspDuplicateServerName),
  entry(mcpPluginToolNameScoped),
  entry(mcpApprovalNamesExist),
  entry(mcpApprovalConflict),
  entry(mcpAllowDenyOverlap),
  entry(mcpHeadershelperCommitted),
  entry(mcpHeadershelperPath),
  entry(mcpNoSseTransport),
  entry(mcpServerNameAnthropicSkills),
  entry(mcpServerNameFormat),
  entry(mcpStdioRelativePath),
  entry(mcpAllowlistEmpty),
  entry(mcpInsecureUrl),
  entry(mcpPluginStdioReach),
  entry(mcpPolicyLiteralValues),
  entry(mcpPolicyServernameWeak),
  entry(mcpAlwaysLoadCount),
  entry(mcpEnvVarNumbers),
  entry(mcpEnvVarSyntax),
  entry(mcpNoLiteralSecrets),
  entry(mcpProjectToggleKeys),
  entry(mcpToolServerUnknown),
  entry(lspJsonLocation),
  entry(mcpEnvVarDefault),
  entry(mcpPluginRootPaths),
  entry(mcpStdioCommandHasArgs),
  entry(mcpUnknownKeys),
  entry(pluginManifestLocation),
  entry(pluginSkillDirLayout),
  entry(pluginNoProjectPluginsDir),
  entry(pluginProjectSkillsDirLimits),
  entry(pluginCommandsDirNonempty),
  entry(pluginDefaultDirShadowed),
  entry(pluginMonitorsCommandEnv),
  entry(pluginNoGitLfs),
  entry(pluginPackageLockfile),
  entry(pluginPathVarBraced),
  entry(pluginUserConfigNoShellFields),
  entry(pluginSymlinkEscapesMarketplace),
  entry(pluginSymlinkEscapesPlugin),
  entry(pluginDependenciesResolve),
  entry(pluginMonitorsSkillExists),
  entry(pluginNpmSourceShrinkwrap),
  entry(pluginSettingsSingleSource),
  entry(pluginUserConfigSensitiveInContent),
  entry(pluginFeatureMinVersion),
  entry(pluginManifestMetadataFormat),
  entry(pluginManifestNoBom),
  entry(pluginManifestPublishMetadata),
  entry(pluginManifestVersionSemver),
  entry(pluginCommandsMapFields),
  entry(pluginDependenciesNotAutoInstalled),
  entry(pluginPathNoBackslash),
  entry(pluginSettingsAgentExists),
  entry(pluginSkillsKeyRedundantDefault),
  entry(pluginUserConfigFieldApplicability),
  entry(pluginBinClaudeAi),
  entry(pluginMonitorsCommandQuote),
  entry(pluginPackageLifecycleScripts),
  entry(pluginPackageLockfileChoice),
  entry(pluginThemesLayout),
  entry(pluginEvalsCaseYaml),
  entry(pluginEvalsDir),
  entry(pluginEvalsGrader),
  entry(pluginEvalsMockSchema),
  entry(pluginEvalsMockServerExists),
  entry(pluginEvalsPromptFrontmatter),
  entry(pluginEvalsPromptNoAtMentions),
  entry(pluginUserConfigSensitive),
  entry(pluginChannelServerStdio),
  entry(pluginBinShadowsSystemCommand),
  entry(pluginDependenciesPrereleaseRange),
  entry(pluginRelevanceSignalHints),
  entry(pluginDirNotMarketplaceRoot),
  entry(pluginNoStateInPluginRoot),
  entry(pluginNoParentPathEscape),
  entry(pluginPathUsesPluginRoot),
  entry(sandboxAllowWriteEscalation),
  entry(sandboxCredentialsRecommended),
  entry(sandboxDockerExcluded),
  entry(sandboxDomainBroad),
  entry(sandboxExcludedCommandsBroad),
  entry(sandboxProxyEnv),
  entry(sandboxSettingsWithoutEnabled),
  entry(sandboxUnsandboxedRetry),
]

type RuleName = (typeof modules)[number]['target']['name']
type Language = (typeof modules)[number]['target']['language'] | 'json'
// A rule for files of two languages adds its second language and files in
// `also`. The config then has one block for each.
interface Module {
  target: {
    name: string
    language: Language
    files: string[]
    also?: { language: Language; files: string[] }
  }
  default: unknown
}
type Severity = 'off' | 'warn' | 'error'

// Language settings only, so the spread in `configFor` cannot replace a
// block's `files` or `plugins`.
const LANGUAGES: Record<
  (typeof modules)[number]['target']['language'],
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
  'permissions-allow-dir-depth': 'warn',
  'permissions-cd-allowlist': 'warn',
  'permissions-glob-grep-allow': 'warn',
  'permissions-legacy-tool-name': 'warn',
  'permissions-read-deny-notebook': 'warn',
  'permissions-webfetch-apex': 'warn',
  'permissions-webfetch-mid-wildcard': 'warn',
  'permissions-auto-mode-defaults': 'warn',
  'permissions-ignore-patterns': 'warn',
  'sandbox-credentials-mask-fallback': 'warn',
  'sandbox-domain-duplicate': 'warn',
  'sandbox-platform-limits': 'warn',
  'sandbox-weakening-options': 'warn',
  'permissions-bash-glued-wildcard': 'off',
  'permissions-bash-stripped-wrapper': 'off',
  'permissions-bash-deny-not-boundary': 'off',
  'permissions-bash-argument-constraint': 'off',
  'permissions-bash-readonly-redundant': 'off',
  'permissions-path-anchor': 'off',
  'permissions-param-rule-intent': 'off',
  'permissions-mcp-server-exists': 'off',
  'permissions-agent-rule-exists': 'off',
  'permissions-additional-directories-no-config': 'off',
  'permissions-deny-dir-listable': 'off',
  'permissions-deny-secret-files': 'off',
  'permissions-auto-mode-push-ask': 'off',
  'permissions-auto-mode-rule-syntax': 'off',
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
  'plugin-evals-case-yaml': 'error',
  'plugin-evals-dir': 'error',
  'plugin-evals-grader': 'error',
  'plugin-evals-mock-schema': 'error',
  'plugin-evals-mock-server-exists': 'error',
  'plugin-evals-prompt-frontmatter': 'error',
  'plugin-evals-prompt-no-at-mentions': 'error',
  'plugin-feature-min-version': 'warn',
  'plugin-manifest-metadata-format': 'warn',
  'plugin-manifest-no-bom': 'warn',
  'plugin-manifest-publish-metadata': 'warn',
  'plugin-manifest-version-semver': 'warn',
  'plugin-commands-map-fields': 'warn',
  'plugin-dependencies-not-auto-installed': 'warn',
  'plugin-path-no-backslash': 'warn',
  'plugin-settings-agent-exists': 'warn',
  'plugin-skills-key-redundant-default': 'warn',
  'plugin-user-config-field-applicability': 'warn',
  'plugin-bin-claude-ai': 'warn',
  'plugin-monitors-command-quote': 'warn',
  'plugin-package-lifecycle-scripts': 'warn',
  'plugin-package-lockfile-choice': 'warn',
  'plugin-themes-layout': 'warn',
  'plugin-user-config-sensitive': 'off',
  'plugin-channel-server-stdio': 'off',
  'plugin-bin-shadows-system-command': 'off',
  'plugin-dependencies-prerelease-range': 'off',
  'plugin-relevance-signal-hints': 'off',
  'plugin-dir-not-marketplace-root': 'off',
  'plugin-no-state-in-plugin-root': 'off',
  'plugin-no-parent-path-escape': 'off',
  'plugin-path-uses-plugin-root': 'off',
  'sandbox-allow-write-escalation': 'off',
  'sandbox-credentials-recommended': 'off',
  'sandbox-docker-excluded': 'off',
  'sandbox-domain-broad': 'off',
  'sandbox-excluded-commands-broad': 'off',
  'sandbox-proxy-env': 'off',
  'sandbox-settings-without-enabled': 'off',
  'sandbox-unsandboxed-retry': 'off',
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
  rules: Object.fromEntries(modules.map((m) => [m.target.name, m.default])),
  // Filled in below, once `plugin` exists to reference itself.
  configs: { recommended: [], strict: [] },
}

/** One block for each rule that `severity` turns on, with the rule's own
 *  files and language. The block also registers the language plugins, so a
 *  consumer needs no other setup. */
function configFor(config: string, severity: (rule: RuleName) => Severity): Linter.Config[] {
  return modules
    .filter((m) => severity(m.target.name) !== 'off')
    .flatMap((m: Module) =>
      [
        { language: m.target.language, files: m.target.files },
        ...(m.target.also ? [m.target.also] : []),
      ].map((block) => ({
        name: `claude/${config}/${m.target.name}`,
        files: block.files,
        plugins: { claude: plugin, markdown, json },
        ...LANGUAGES[block.language],
        rules: { [`claude/${m.target.name}`]: severity(m.target.name as RuleName) },
      })),
    )
}

plugin.configs.recommended = configFor('recommended', (rule) => recommended[rule])
plugin.configs.strict = configFor('strict', (rule) => STRICT[recommended[rule]])

export default plugin
