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
import * as agentPermissionModeAutoUnavailable from './rules/agent-permission-mode-auto-unavailable.ts'
import * as agentPermissionModeBypass from './rules/agent-permission-mode-bypass.ts'
import * as agentPermissionModeManual from './rules/agent-permission-mode-manual.ts'
import * as agentPluginIgnoredFields from './rules/agent-plugin-ignored-fields.ts'
import * as agentPluginScopedNameUnique from './rules/agent-plugin-scoped-name-unique.ts'
import * as agentSkillsExist from './rules/agent-skills-exist.ts'
import * as agentSkillsPreloadLimit from './rules/agent-skills-preload-limit.ts'
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
import * as skillNameCharacters from './rules/skill-name-characters.ts'
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

// Each rule module exports `target`, which names its files and language, and
// `default`, which is the rule. A new rule adds no entry to a central glob
// list. Each entry names the two members, so Knip still checks the other
// exports of the module.
const modules = [
  { target: skillDescriptionMaxLength.target, default: skillDescriptionMaxLength.default },
  { target: commandLegacyFormat.target, default: commandLegacyFormat.default },
  { target: hooksEventNameKnown.target, default: hooksEventNameKnown.default },
  { target: hooksAgentStopEvent.target, default: hooksAgentStopEvent.default },
  { target: hooksAgentTypeExperimental.target, default: hooksAgentTypeExperimental.default },
  { target: hooksAsyncOnBlockingEvent.target, default: hooksAsyncOnBlockingEvent.default },
  { target: hooksBroadAutoApprove.target, default: hooksBroadAutoApprove.default },
  { target: hooksCommandDeprecatedCliFlag.target, default: hooksCommandDeprecatedCliFlag.default },
  { target: hooksCommandPathVariable.target, default: hooksCommandPathVariable.default },
  { target: hooksCommandRemovedCliFlag.target, default: hooksCommandRemovedCliFlag.default },
  { target: hooksCommandShellSafety.target, default: hooksCommandShellSafety.default },
  { target: hooksCommittedCommandReview.target, default: hooksCommittedCommandReview.default },
  { target: hooksConfigSchema.target, default: hooksConfigSchema.default },
  { target: hooksDisableAllOverride.target, default: hooksDisableAllOverride.default },
  {
    target: hooksDisabledByDisableallhooks.target,
    default: hooksDisabledByDisableallhooks.default,
  },
  { target: hooksDuplicateHandler.target, default: hooksDuplicateHandler.default },
  { target: hooksEnvVarUnavailable.target, default: hooksEnvVarUnavailable.default },
  { target: hooksExecFormCommandSpaces.target, default: hooksExecFormCommandSpaces.default },
  { target: hooksExecFormShellSyntax.target, default: hooksExecFormShellSyntax.default },
  { target: hooksExecFormWindowsShim.target, default: hooksExecFormWindowsShim.default },
  { target: hooksFilechangedStarMatcher.target, default: hooksFilechangedStarMatcher.default },
  { target: hooksHandlerFieldIgnored.target, default: hooksHandlerFieldIgnored.default },
  { target: hooksHandlerFieldUnknown.target, default: hooksHandlerFieldUnknown.default },
  { target: hooksHandlerTypeEventSupport.target, default: hooksHandlerTypeEventSupport.default },
  { target: hooksHttpEnvAllowlist.target, default: hooksHttpEnvAllowlist.default },
  { target: hooksHttpLiteralSecret.target, default: hooksHttpLiteralSecret.default },
  { target: hooksIfCondition.target, default: hooksIfCondition.default },
  { target: hooksIfDirGlobDepth.target, default: hooksIfDirGlobDepth.default },
  {
    target: hooksMatcherBashWithoutPowershell.target,
    default: hooksMatcherBashWithoutPowershell.default,
  },
  { target: hooksMatcherDeprecatedValue.target, default: hooksMatcherDeprecatedValue.default },
  { target: hooksMatcherEnum.target, default: hooksMatcherEnum.default },
  { target: hooksMatcherLegacyVersion.target, default: hooksMatcherLegacyVersion.default },
  { target: hooksMatcherMcpName.target, default: hooksMatcherMcpName.default },
  { target: hooksMatcherNameUnresolved.target, default: hooksMatcherNameUnresolved.default },
  { target: hooksMatcherNeverMatches.target, default: hooksMatcherNeverMatches.default },
  { target: hooksMatcherSubagentAnchor.target, default: hooksMatcherSubagentAnchor.default },
  { target: hooksMatcherSyntax.target, default: hooksMatcherSyntax.default },
  { target: hooksMatcherUnanchoredRegex.target, default: hooksMatcherUnanchoredRegex.default },
  { target: hooksMatcherUnsupportedEvent.target, default: hooksMatcherUnsupportedEvent.default },
  { target: hooksMultipleUpdatedinput.target, default: hooksMultipleUpdatedinput.default },
  { target: hooksNoStandaloneFile.target, default: hooksNoStandaloneFile.default },
  { target: hooksOutputBlockingExitCode.target, default: hooksOutputBlockingExitCode.default },
  { target: hooksOutputDeprecatedFields.target, default: hooksOutputDeprecatedFields.default },
  { target: hooksOutputSchema.target, default: hooksOutputSchema.default },
  { target: hooksOutputSize.target, default: hooksOutputSize.default },
  { target: hooksPlaceholderQuoted.target, default: hooksPlaceholderQuoted.default },
  { target: hooksPowershellPlaceholder.target, default: hooksPowershellPlaceholder.default },
  { target: hooksPreferExecForm.target, default: hooksPreferExecForm.default },
  {
    target: hooksPromptOnPermissionRequest.target,
    default: hooksPromptOnPermissionRequest.default,
  },
  { target: hooksPs1NeedsPowershellShell.target, default: hooksPs1NeedsPowershellShell.default },
  { target: hooksScriptShebang.target, default: hooksScriptShebang.default },
  { target: hooksSessionendDefaultTimeout.target, default: hooksSessionendDefaultTimeout.default },
  {
    target: hooksSessionstartStaticContext.target,
    default: hooksSessionstartStaticContext.default,
  },
  { target: hooksStopLoopGuard.target, default: hooksStopLoopGuard.default },
  { target: hooksTimeoutUnits.target, default: hooksTimeoutUnits.default },
  {
    target: hooksWorktreeCreateWithoutRemove.target,
    default: hooksWorktreeCreateWithoutRemove.default,
  },
  { target: skillFrontmatterPosition.target, default: skillFrontmatterPosition.default },
  { target: skillFrontmatterSchema.target, default: skillFrontmatterSchema.default },
  { target: skillForkFieldsRequireContext.target, default: skillForkFieldsRequireContext.default },
  { target: skillInvocationUnreachable.target, default: skillInvocationUnreachable.default },
  { target: skillReservedName.target, default: skillReservedName.default },
  { target: skillPluginVarsOutsidePlugin.target, default: skillPluginVarsOutsidePlugin.default },
  { target: skillInjectBangPosition.target, default: skillInjectBangPosition.default },
  { target: skillAllowedToolsIneffective.target, default: skillAllowedToolsIneffective.default },
  { target: skillAllowedToolsBroad.target, default: skillAllowedToolsBroad.default },
  { target: skillPluginRootShadowed.target, default: skillPluginRootShadowed.default },
  { target: skillFileLayout.target, default: skillFileLayout.default },
  { target: skillReferenceExists.target, default: skillReferenceExists.default },
  { target: skillAgentExists.target, default: skillAgentExists.default },
  { target: skillNameUnique.target, default: skillNameUnique.default },
  { target: skillPathsGlobValid.target, default: skillPathsGlobValid.default },
  { target: skillNameCharacters.target, default: skillNameCharacters.default },
  { target: skillBooleanLiteral.target, default: skillBooleanLiteral.default },
  { target: skillDescriptionPresent.target, default: skillDescriptionPresent.default },
  {
    target: skillInvocationRedundantFields.target,
    default: skillInvocationRedundantFields.default,
  },
  { target: skillMetadataReservedKeys.target, default: skillMetadataReservedKeys.default },
  { target: skillNameShadowsBuiltin.target, default: skillNameShadowsBuiltin.default },
  { target: skillNoBom.target, default: skillNoBom.default },
  { target: skillArgumentEscape.target, default: skillArgumentEscape.default },
  { target: skillMaxLines.target, default: skillMaxLines.default },
  { target: skillPluginNamePrefix.target, default: skillPluginNamePrefix.default },
  { target: skillPluginRootName.target, default: skillPluginRootName.default },
  { target: skillShellPlatform.target, default: skillShellPlatform.default },
  { target: skillBodyTokenBudget.target, default: skillBodyTokenBudget.default },
  { target: skillInjectRobustness.target, default: skillInjectRobustness.default },
  { target: skillListingBudget.target, default: skillListingBudget.default },
  { target: skillLiteralDollar.target, default: skillLiteralDollar.default },
  { target: skillLoopReferenceInvocable.target, default: skillLoopReferenceInvocable.default },
  { target: skillModelOverride.target, default: skillModelOverride.default },
  { target: skillPluginPathVars.target, default: skillPluginPathVars.default },
  { target: skillPrecedenceShadowing.target, default: skillPrecedenceShadowing.default },
  { target: skillSideEffectsManualOnly.target, default: skillSideEffectsManualOnly.default },
  { target: agentFrontmatterValid.target, default: agentFrontmatterValid.default },
  { target: agentFrontmatterSchema.target, default: agentFrontmatterSchema.default },
  { target: agentPluginIgnoredFields.target, default: agentPluginIgnoredFields.default },
  { target: agentMcpServersSchema.target, default: agentMcpServersSchema.default },
  { target: agentPermissionModeBypass.target, default: agentPermissionModeBypass.default },
  { target: agentMemoryGrantsWrite.target, default: agentMemoryGrantsWrite.default },
  { target: agentToolsKnown.target, default: agentToolsKnown.default },
  { target: agentToolsUnavailable.target, default: agentToolsUnavailable.default },
  { target: agentNameUnique.target, default: agentNameUnique.default },
  { target: agentSkillsPreloadable.target, default: agentSkillsPreloadable.default },
  { target: agentMemoryAutoMemoryOff.target, default: agentMemoryAutoMemoryOff.default },
  { target: agentOmitClaudeMdMain.target, default: agentOmitClaudeMdMain.default },
  { target: agentModelForced.target, default: agentModelForced.default },
  { target: agentTeamsNoProjectConfig.target, default: agentTeamsNoProjectConfig.default },
  {
    target: agentPermissionModeAutoUnavailable.target,
    default: agentPermissionModeAutoUnavailable.default,
  },
  { target: outputStyleFrontmatterValid.target, default: outputStyleFrontmatterValid.default },
  { target: outputStyleFrontmatterSchema.target, default: outputStyleFrontmatterSchema.default },
  { target: agentDisallowedToolsScope.target, default: agentDisallowedToolsScope.default },
  { target: agentFieldMinVersion.target, default: agentFieldMinVersion.default },
  { target: agentMcpServersInlineTrust.target, default: agentMcpServersInlineTrust.default },
  { target: agentMemoryScopeProject.target, default: agentMemoryScopeProject.default },
  { target: agentNameShadowing.target, default: agentNameShadowing.default },
  { target: agentNameShadowsBuiltin.target, default: agentNameShadowsBuiltin.default },
  { target: agentNoBom.target, default: agentNoBom.default },
  { target: agentPermissionModeManual.target, default: agentPermissionModeManual.default },
  { target: agentPluginScopedNameUnique.target, default: agentPluginScopedNameUnique.default },
  { target: agentSkillsPreloadLimit.target, default: agentSkillsPreloadLimit.default },
  { target: agentToolsConditional.target, default: agentToolsConditional.default },
  { target: agentToolsTaskAlias.target, default: agentToolsTaskAlias.default },
  { target: outputStyleForceForPlugin.target, default: outputStyleForceForPlugin.default },
  { target: outputStyleNameUnique.target, default: outputStyleNameUnique.default },
  {
    target: outputStylePluginNameDescription.target,
    default: outputStylePluginNameDescription.default,
  },
  { target: agentInitialPromptMainOnly.target, default: agentInitialPromptMainOnly.default },
  { target: agentMcpServersRefExists.target, default: agentMcpServersRefExists.default },
  { target: agentModelValue.target, default: agentModelValue.default },
  { target: agentSkillsExist.target, default: agentSkillsExist.default },
  { target: agentToolsAgentTypeList.target, default: agentToolsAgentTypeList.default },
  { target: agentToolsSkillForPreload.target, default: agentToolsSkillForPreload.default },
  { target: agentBodyNonempty.target, default: agentBodyNonempty.default },
  { target: agentDescriptionProactive.target, default: agentDescriptionProactive.default },
  { target: agentDescriptionsBudget.target, default: agentDescriptionsBudget.default },
  { target: agentNameKebabCase.target, default: agentNameKebabCase.default },
  { target: agentTeammateIgnoredFields.target, default: agentTeammateIgnoredFields.default },
  { target: permissionsRuleSyntax.target, default: permissionsRuleSyntax.default },
  { target: permissionsUnknownTool.target, default: permissionsUnknownTool.default },
  { target: permissionsToolNameGlob.target, default: permissionsToolNameGlob.default },
  {
    target: permissionsSpecifierUnsupported.target,
    default: permissionsSpecifierUnsupported.default,
  },
  { target: permissionsPathRuleTool.target, default: permissionsPathRuleTool.default },
  { target: permissionsMcpRuleParens.target, default: permissionsMcpRuleParens.default },
  { target: permissionsParamRule.target, default: permissionsParamRule.default },
  { target: permissionsSkillRule.target, default: permissionsSkillRule.default },
  {
    target: permissionsBypassModeCommitted.target,
    default: permissionsBypassModeCommitted.default,
  },
  {
    target: permissionsDefaultModeConflict.target,
    default: permissionsDefaultModeConflict.default,
  },
  {
    target: permissionsDefaultModeProjectIgnored.target,
    default: permissionsDefaultModeProjectIgnored.default,
  },
  { target: permissionsDefaultModeValue.target, default: permissionsDefaultModeValue.default },
  { target: permissionsDisableModeValue.target, default: permissionsDisableModeValue.default },
  { target: permissionsSchema.target, default: permissionsSchema.default },
  { target: permissionsAllowUnrestricted.target, default: permissionsAllowUnrestricted.default },
  {
    target: permissionsBashExecWrapperPrefix.target,
    default: permissionsBashExecWrapperPrefix.default,
  },
  { target: permissionsBashRunnerWildcard.target, default: permissionsBashRunnerWildcard.default },
  {
    target: permissionsBashWildcardBeforeSubcommand.target,
    default: permissionsBashWildcardBeforeSubcommand.default,
  },
  { target: permissionsEndConversation.target, default: permissionsEndConversation.default },
  { target: permissionsProtectedPathAllow.target, default: permissionsProtectedPathAllow.default },
  {
    target: permissionsAdditionalDirectoriesPath.target,
    default: permissionsAdditionalDirectoriesPath.default,
  },
  { target: permissionsBlockReadsFalse.target, default: permissionsBlockReadsFalse.default },
  { target: permissionsInvalidPathPattern.target, default: permissionsInvalidPathPattern.default },
  { target: permissionsNegation.target, default: permissionsNegation.default },
  {
    target: permissionsWebfetchDomainSyntax.target,
    default: permissionsWebfetchDomainSyntax.default,
  },
  { target: permissionsWindowsPath.target, default: permissionsWindowsPath.default },
  { target: permissionsAutoModeSchema.target, default: permissionsAutoModeSchema.default },
  { target: sandboxDomainSyntax.target, default: sandboxDomainSyntax.default },
  { target: sandboxExcludedCommandsSyntax.target, default: sandboxExcludedCommandsSyntax.default },
  {
    target: sandboxFilesystemDisabledConflict.target,
    default: sandboxFilesystemDisabledConflict.default,
  },
  { target: sandboxSchema.target, default: sandboxSchema.default },
  { target: sandboxScope.target, default: sandboxScope.default },
  { target: sandboxCredentialsAws.target, default: sandboxCredentialsAws.default },
  { target: sandboxCredentialsMask.target, default: sandboxCredentialsMask.default },
  { target: sandboxDomainOverlap.target, default: sandboxDomainOverlap.default },
  { target: permissionsSandboxBashAsk.target, default: permissionsSandboxBashAsk.default },
  { target: permissionsDeadAllow.target, default: permissionsDeadAllow.default },
  {
    target: permissionsAutoModeDroppedAllow.target,
    default: permissionsAutoModeDroppedAllow.default,
  },
  { target: permissionsBashColonStarMid.target, default: permissionsBashColonStarMid.default },
  {
    target: permissionsBashColonStarSuffix.target,
    default: permissionsBashColonStarSuffix.default,
  },
  {
    target: permissionsDefaultModeManualAlias.target,
    default: permissionsDefaultModeManualAlias.default,
  },
  { target: permissionsDefaultModeSurface.target, default: permissionsDefaultModeSurface.default },
  { target: permissionsDenyAllTools.target, default: permissionsDenyAllTools.default },
  { target: permissionsDuplicateRule.target, default: permissionsDuplicateRule.default },
  { target: permissionsAllowDirDepth.target, default: permissionsAllowDirDepth.default },
  { target: permissionsCdAllowlist.target, default: permissionsCdAllowlist.default },
  { target: permissionsGlobGrepAllow.target, default: permissionsGlobGrepAllow.default },
  { target: permissionsLegacyToolName.target, default: permissionsLegacyToolName.default },
  { target: permissionsReadDenyNotebook.target, default: permissionsReadDenyNotebook.default },
  { target: permissionsWebfetchApex.target, default: permissionsWebfetchApex.default },
  {
    target: permissionsWebfetchMidWildcard.target,
    default: permissionsWebfetchMidWildcard.default,
  },
  { target: permissionsAutoModeDefaults.target, default: permissionsAutoModeDefaults.default },
  { target: permissionsIgnorePatterns.target, default: permissionsIgnorePatterns.default },
  {
    target: sandboxCredentialsMaskFallback.target,
    default: sandboxCredentialsMaskFallback.default,
  },
  { target: sandboxDomainDuplicate.target, default: sandboxDomainDuplicate.default },
  { target: sandboxPlatformLimits.target, default: sandboxPlatformLimits.default },
  { target: sandboxWeakeningOptions.target, default: sandboxWeakeningOptions.default },
  { target: permissionsBashGluedWildcard.target, default: permissionsBashGluedWildcard.default },
  {
    target: permissionsBashStrippedWrapper.target,
    default: permissionsBashStrippedWrapper.default,
  },
  {
    target: permissionsBashDenyNotBoundary.target,
    default: permissionsBashDenyNotBoundary.default,
  },
  {
    target: permissionsBashArgumentConstraint.target,
    default: permissionsBashArgumentConstraint.default,
  },
  {
    target: permissionsBashReadonlyRedundant.target,
    default: permissionsBashReadonlyRedundant.default,
  },
  { target: permissionsPathAnchor.target, default: permissionsPathAnchor.default },
  { target: permissionsParamRuleIntent.target, default: permissionsParamRuleIntent.default },
  { target: permissionsMcpServerExists.target, default: permissionsMcpServerExists.default },
  { target: permissionsAgentRuleExists.target, default: permissionsAgentRuleExists.default },
  {
    target: permissionsAdditionalDirectoriesNoConfig.target,
    default: permissionsAdditionalDirectoriesNoConfig.default,
  },
  { target: permissionsDenyDirListable.target, default: permissionsDenyDirListable.default },
  { target: permissionsDenySecretFiles.target, default: permissionsDenySecretFiles.default },
  { target: permissionsAutoModePushAsk.target, default: permissionsAutoModePushAsk.default },
  { target: permissionsAutoModeRuleSyntax.target, default: permissionsAutoModeRuleSyntax.default },
  { target: marketplaceNameReserved.target, default: marketplaceNameReserved.default },
  {
    target: marketplaceCommandVersionIgnored.target,
    default: marketplaceCommandVersionIgnored.default,
  },
  {
    target: marketplaceHeadersHelperCommand.target,
    default: marketplaceHeadersHelperCommand.default,
  },
  { target: marketplaceEntryHooksInline.target, default: marketplaceEntryHooksInline.default },
  { target: marketplaceSourceSchema.target, default: marketplaceSourceSchema.default },
  {
    target: marketplaceRelativeSourceFormat.target,
    default: marketplaceRelativeSourceFormat.default,
  },
  { target: marketplaceSchema.target, default: marketplaceSchema.default },
  {
    target: marketplaceEntryNameMatchesManifest.target,
    default: marketplaceEntryNameMatchesManifest.default,
  },
  {
    target: marketplaceRelativeSourceExists.target,
    default: marketplaceRelativeSourceExists.default,
  },
  {
    target: marketplaceRelativeSourceEscapeSymlink.target,
    default: marketplaceRelativeSourceEscapeSymlink.default,
  },
  { target: marketplaceVersionDuplicate.target, default: marketplaceVersionDuplicate.default },
  {
    target: marketplaceEntryManifestOnlyFields.target,
    default: marketplaceEntryManifestOnlyFields.default,
  },
  {
    target: marketplaceStrictFalseConflict.target,
    default: marketplaceStrictFalseConflict.default,
  },
  { target: marketplaceEntryHooksOverride.target, default: marketplaceEntryHooksOverride.default },
  { target: marketplaceEntryRootSkills.target, default: marketplaceEntryRootSkills.default },
  {
    target: marketplaceEntryComponentPaths.target,
    default: marketplaceEntryComponentPaths.default,
  },
  { target: marketplaceArchiveSha256.target, default: marketplaceArchiveSha256.default },
  { target: marketplaceCommandLinkMode.target, default: marketplaceCommandLinkMode.default },
  { target: marketplaceCommandSource.target, default: marketplaceCommandSource.default },
  { target: marketplaceLocation.target, default: marketplaceLocation.default },
  { target: marketplaceMinVersion.target, default: marketplaceMinVersion.default },
  {
    target: marketplaceRelativeSourceBackslash.target,
    default: marketplaceRelativeSourceBackslash.default,
  },
  {
    target: marketplaceSelfHostedRootSource.target,
    default: marketplaceSelfHostedRootSource.default,
  },
  {
    target: marketplaceRelativeSourceUrlHosted.target,
    default: marketplaceRelativeSourceUrlHosted.default,
  },
  {
    target: marketplaceHeadersLiteralCredential.target,
    default: marketplaceHeadersLiteralCredential.default,
  },
  { target: settingsEnabledPluginsSchema.target, default: settingsEnabledPluginsSchema.default },
  {
    target: settingsEnabledPluginsEntryExists.target,
    default: settingsEnabledPluginsEntryExists.default,
  },
  {
    target: settingsExtraKnownMarketplacesSchema.target,
    default: settingsExtraKnownMarketplacesSchema.default,
  },
  {
    target: settingsExtraKnownMarketplacesKeyMatchesName.target,
    default: settingsExtraKnownMarketplacesKeyMatchesName.default,
  },
  {
    target: settingsMarketplaceHeadersHelperHttps.target,
    default: settingsMarketplaceHeadersHelperHttps.default,
  },
  {
    target: settingsMarketplaceKeyAliasConflict.target,
    default: settingsMarketplaceKeyAliasConflict.default,
  },
  { target: settingsSyncClaudeAiPlugins.target, default: settingsSyncClaudeAiPlugins.default },
  { target: settingsValidJson.target, default: settingsValidJson.default },
  { target: settingsFileSize.target, default: settingsFileSize.default },
  { target: settingsKeyScope.target, default: settingsKeyScope.default },
  { target: settingsManagedFile.target, default: settingsManagedFile.default },
  { target: settingsRemovedKey.target, default: settingsRemovedKey.default },
  { target: settingsEnvCredential.target, default: settingsEnvCredential.default },
  { target: settingsEnvValueFormat.target, default: settingsEnvValueFormat.default },
  { target: settingsEnvIgnoredVar.target, default: settingsEnvIgnoredVar.default },
  { target: settingsProjectValueIgnored.target, default: settingsProjectValueIgnored.default },
  {
    target: settingsKnownMarketplacesPolicySchema.target,
    default: settingsKnownMarketplacesPolicySchema.default,
  },
  {
    target: settingsPluginSuggestionMarketplacesSource.target,
    default: settingsPluginSuggestionMarketplacesSource.default,
  },
  { target: settingsConflictingKeys.target, default: settingsConflictingKeys.default },
  { target: settingsModelValue.target, default: settingsModelValue.default },
  { target: settingsModelList.target, default: settingsModelList.default },
  { target: settingsSkilloverridesKey.target, default: settingsSkilloverridesKey.default },
  { target: settingsEnvShadowed.target, default: settingsEnvShadowed.default },
  { target: settingsSchema.target, default: settingsSchema.default },
  { target: settingsAttributionFalse.target, default: settingsAttributionFalse.default },
  { target: settingsDeprecatedKey.target, default: settingsDeprecatedKey.default },
  { target: settingsGlobalOnlyFile.target, default: settingsGlobalOnlyFile.default },
  { target: settingsOutputstyleResolves.target, default: settingsOutputstyleResolves.default },
  {
    target: settingsProjectAutocontinueOff.target,
    default: settingsProjectAutocontinueOff.default,
  },
  { target: settingsRedundantValue.target, default: settingsRedundantValue.default },
  { target: settingsSchemaUrl.target, default: settingsSchemaUrl.default },
  {
    target: settingsCommittedHelperCommand.target,
    default: settingsCommittedHelperCommand.default,
  },
  { target: settingsEnvDeprecatedVar.target, default: settingsEnvDeprecatedVar.default },
  { target: settingsEnvPromptCachingOff.target, default: settingsEnvPromptCachingOff.default },
  { target: settingsEnvRouting.target, default: settingsEnvRouting.default },
  { target: settingsLocalLocation.target, default: settingsLocalLocation.default },
  { target: settingsWebfetchPreflightSkip.target, default: settingsWebfetchPreflightSkip.default },
  { target: settingsEnvNumericSpelling.target, default: settingsEnvNumericSpelling.default },
  { target: settingsFooterlinksPattern.target, default: settingsFooterlinksPattern.default },
  { target: settingsManagedValueForm.target, default: settingsManagedValueForm.default },
  { target: settingsManagedVersionFloor.target, default: settingsManagedVersionFloor.default },
  {
    target: settingsWorktreeSparseClaudeDir.target,
    default: settingsWorktreeSparseClaudeDir.default,
  },
  { target: statuslineWindowsPath.target, default: statuslineWindowsPath.default },
  { target: hooksScriptExists.target, default: hooksScriptExists.default },
  { target: hooksScriptExecutable.target, default: hooksScriptExecutable.default },
  { target: pluginBinExecutable.target, default: pluginBinExecutable.default },
  { target: statuslineScriptExists.target, default: statuslineScriptExists.default },
  { target: claudeMdLocalUntracked.target, default: claudeMdLocalUntracked.default },
  {
    target: memoryAgentMemoryLocalUntracked.target,
    default: memoryAgentMemoryLocalUntracked.default,
  },
  { target: pluginEvalsReplayCommitted.target, default: pluginEvalsReplayCommitted.default },
  { target: pluginEvalsResultsGitignored.target, default: pluginEvalsResultsGitignored.default },
  { target: settingsLocalGitignored.target, default: settingsLocalGitignored.default },
  { target: settingsLocalUntracked.target, default: settingsLocalUntracked.default },
  {
    target: settingsEnabledPluginsExternalSource.target,
    default: settingsEnabledPluginsExternalSource.default,
  },
  {
    target: settingsEnabledPluginsMarketplaceDeclared.target,
    default: settingsEnabledPluginsMarketplaceDeclared.default,
  },
  {
    target: settingsExtraKnownMarketplacesDirectory.target,
    default: settingsExtraKnownMarketplacesDirectory.default,
  },
  {
    target: settingsKnownMarketplacesPatternAnchored.target,
    default: settingsKnownMarketplacesPatternAnchored.default,
  },
  { target: settingsMarketplaceKeyAlias.target, default: settingsMarketplaceKeyAlias.default },
  { target: settingsMarketplaceSkipLfs.target, default: settingsMarketplaceSkipLfs.default },
  {
    target: settingsStrictKnownMarketplacesSkillsDir.target,
    default: settingsStrictKnownMarketplacesSkillsDir.default,
  },
  { target: claudeMdAgentsMdShadowed.target, default: claudeMdAgentsMdShadowed.default },
  { target: claudeMdAgentsMdVariant.target, default: claudeMdAgentsMdVariant.default },
  { target: claudeMdExcludesPattern.target, default: claudeMdExcludesPattern.default },
  { target: claudeMdImportExists.target, default: claudeMdImportExists.default },
  { target: claudeMdImportMaxDepth.target, default: claudeMdImportMaxDepth.default },
  { target: claudeMdMaxBytes.target, default: claudeMdMaxBytes.default },
  { target: memorySettingsSchema.target, default: memorySettingsSchema.default },
  { target: memorySymlinkNetworkTarget.target, default: memorySymlinkNetworkTarget.default },
  { target: rulesFrontmatterSchema.target, default: rulesFrontmatterSchema.default },
  { target: rulesMdExtension.target, default: rulesMdExtension.default },
  { target: rulesPathsGlobValid.target, default: rulesPathsGlobValid.default },
  { target: rulesSymlinkExternalScoped.target, default: rulesSymlinkExternalScoped.default },
  { target: claudeMdImportExternal.target, default: claudeMdImportExternal.default },
  { target: claudeMdMaxLines.target, default: claudeMdMaxLines.default },
  { target: claudeMdSymlink.target, default: claudeMdSymlink.default },
  {
    target: memoryAutoMemoryDirectoryCommitted.target,
    default: memoryAutoMemoryDirectoryCommitted.default,
  },
  { target: memoryIndexMaxSize.target, default: memoryIndexMaxSize.default },
  { target: rulesMaxLines.target, default: rulesMaxLines.default },
  { target: rulesSymlinkExternal.target, default: rulesSymlinkExternal.default },
  { target: claudeMdAgentsMdProsePointer.target, default: claudeMdAgentsMdProsePointer.default },
  { target: claudeMdCombinedSize.target, default: claudeMdCombinedSize.default },
  { target: claudeMdDanglingReference.target, default: claudeMdDanglingReference.default },
  { target: claudeMdDerivableContent.target, default: claudeMdDerivableContent.default },
  { target: claudeMdEmphasisOveruse.target, default: claudeMdEmphasisOveruse.default },
  {
    target: claudeMdExcludesAbsoluteCommitted.target,
    default: claudeMdExcludesAbsoluteCommitted.default,
  },
  { target: claudeMdGitInstructions.target, default: claudeMdGitInstructions.default },
  { target: claudeMdGuardrailToHook.target, default: claudeMdGuardrailToHook.default },
  { target: claudeMdHtmlCommentContent.target, default: claudeMdHtmlCommentContent.default },
  { target: claudeMdImportInCodeSpan.target, default: claudeMdImportInCodeSpan.default },
  { target: claudeMdLocation.target, default: claudeMdLocation.default },
  { target: claudeMdProcedureToSkill.target, default: claudeMdProcedureToSkill.default },
  { target: memoryAgentMemoryOrphan.target, default: memoryAgentMemoryOrphan.default },
  { target: memoryIndexEntryFormat.target, default: memoryIndexEntryFormat.default },
  { target: memoryTopicFrontmatter.target, default: memoryTopicFrontmatter.default },
  { target: rulesPathsNoMatch.target, default: rulesPathsNoMatch.default },
  { target: settingsAgentExists.target, default: settingsAgentExists.default },
  {
    target: settingsDefaultshellPowershellTool.target,
    default: settingsDefaultshellPowershellTool.default,
  },
  { target: settingsEnvContextCost.target, default: settingsEnvContextCost.default },
  { target: settingsEnvFormatHeuristic.target, default: settingsEnvFormatHeuristic.default },
  { target: settingsEnvSecretHeuristic.target, default: settingsEnvSecretHeuristic.default },
  { target: settingsManagedEffortCap.target, default: settingsManagedEffortCap.default },
  { target: settingsManagedMerge.target, default: settingsManagedMerge.default },
  { target: settingsModelCapability.target, default: settingsModelCapability.default },
  { target: settingsModelPinVersion.target, default: settingsModelPinVersion.default },
  { target: settingsNestedProjectFile.target, default: settingsNestedProjectFile.default },
  {
    target: settingsSkilloverridesUnknownSkill.target,
    default: settingsSkilloverridesUnknownSkill.default,
  },
  { target: settingsWorktreePaths.target, default: settingsWorktreePaths.default },
  { target: statuslineHomePathShared.target, default: statuslineHomePathShared.default },
  { target: statuslineScriptTerminalSize.target, default: statuslineScriptTerminalSize.default },
  { target: mcpJsonLocation.target, default: mcpJsonLocation.default },
  { target: mcpJsonServersKey.target, default: mcpJsonServersKey.default },
  { target: mcpJsonFileSize.target, default: mcpJsonFileSize.default },
  { target: mcpServerNameReserved.target, default: mcpServerNameReserved.default },
  { target: mcpRemoteUrlEmpty.target, default: mcpRemoteUrlEmpty.default },
  { target: mcpHiddenWhitespace.target, default: mcpHiddenWhitespace.default },
  { target: mcpTimeoutMin.target, default: mcpTimeoutMin.default },
  { target: mcpOauthTransport.target, default: mcpOauthTransport.default },
  { target: mcpOauthValues.target, default: mcpOauthValues.default },
  {
    target: mcpAuthorizationHeaderWithOauth.target,
    default: mcpAuthorizationHeaderWithOauth.default,
  },
  { target: mcpProjectDirDefault.target, default: mcpProjectDirDefault.default },
  { target: mcpEnvExpansionField.target, default: mcpEnvExpansionField.default },
  { target: mcpCredentialVarRemote.target, default: mcpCredentialVarRemote.default },
  { target: mcpHeadershelperCredentialEnv.target, default: mcpHeadershelperCredentialEnv.default },
  { target: mcpSettingsMcpservers.target, default: mcpSettingsMcpservers.default },
  { target: mcpAnthropicHostedUrl.target, default: mcpAnthropicHostedUrl.default },
  { target: mcpProjectPluginBundle.target, default: mcpProjectPluginBundle.default },
  { target: mcpToolNameFormat.target, default: mcpToolNameFormat.default },
  { target: mcpApprovalCommitted.target, default: mcpApprovalCommitted.default },
  { target: mcpDisableConnectorsFalse.target, default: mcpDisableConnectorsFalse.default },
  { target: mcpPolicyEntrySchema.target, default: mcpPolicyEntrySchema.default },
  { target: lspJsonSchema.target, default: lspJsonSchema.default },
  { target: lspTransportSocket.target, default: lspTransportSocket.default },
  { target: mcpAllowlistServernameDead.target, default: mcpAllowlistServernameDead.default },
  { target: mcpEnvClientSecret.target, default: mcpEnvClientSecret.default },
  { target: mcpManagedServersEntry.target, default: mcpManagedServersEntry.default },
  { target: mcpDuplicateServerName.target, default: mcpDuplicateServerName.default },
  { target: lspExtensionConflict.target, default: lspExtensionConflict.default },
  { target: lspDuplicateServerName.target, default: lspDuplicateServerName.default },
  { target: mcpPluginToolNameScoped.target, default: mcpPluginToolNameScoped.default },
  { target: mcpApprovalNamesExist.target, default: mcpApprovalNamesExist.default },
  { target: mcpApprovalConflict.target, default: mcpApprovalConflict.default },
  { target: mcpAllowDenyOverlap.target, default: mcpAllowDenyOverlap.default },
  { target: mcpHeadershelperCommitted.target, default: mcpHeadershelperCommitted.default },
  { target: mcpHeadershelperPath.target, default: mcpHeadershelperPath.default },
  { target: mcpNoSseTransport.target, default: mcpNoSseTransport.default },
  { target: mcpServerNameAnthropicSkills.target, default: mcpServerNameAnthropicSkills.default },
  { target: mcpServerNameFormat.target, default: mcpServerNameFormat.default },
  { target: mcpStdioRelativePath.target, default: mcpStdioRelativePath.default },
  { target: mcpAllowlistEmpty.target, default: mcpAllowlistEmpty.default },
  { target: mcpInsecureUrl.target, default: mcpInsecureUrl.default },
  { target: mcpPluginStdioReach.target, default: mcpPluginStdioReach.default },
  { target: mcpPolicyLiteralValues.target, default: mcpPolicyLiteralValues.default },
  { target: mcpPolicyServernameWeak.target, default: mcpPolicyServernameWeak.default },
  { target: mcpAlwaysLoadCount.target, default: mcpAlwaysLoadCount.default },
  { target: mcpEnvVarNumbers.target, default: mcpEnvVarNumbers.default },
  { target: mcpEnvVarSyntax.target, default: mcpEnvVarSyntax.default },
  { target: mcpNoLiteralSecrets.target, default: mcpNoLiteralSecrets.default },
  { target: mcpProjectToggleKeys.target, default: mcpProjectToggleKeys.default },
  { target: mcpToolServerUnknown.target, default: mcpToolServerUnknown.default },
  { target: lspJsonLocation.target, default: lspJsonLocation.default },
  { target: mcpEnvVarDefault.target, default: mcpEnvVarDefault.default },
  { target: mcpPluginRootPaths.target, default: mcpPluginRootPaths.default },
  { target: mcpStdioCommandHasArgs.target, default: mcpStdioCommandHasArgs.default },
  { target: mcpUnknownKeys.target, default: mcpUnknownKeys.default },
  { target: pluginManifestLocation.target, default: pluginManifestLocation.default },
  { target: pluginSkillDirLayout.target, default: pluginSkillDirLayout.default },
  { target: pluginNoProjectPluginsDir.target, default: pluginNoProjectPluginsDir.default },
  { target: pluginProjectSkillsDirLimits.target, default: pluginProjectSkillsDirLimits.default },
  { target: pluginCommandsDirNonempty.target, default: pluginCommandsDirNonempty.default },
  { target: pluginDefaultDirShadowed.target, default: pluginDefaultDirShadowed.default },
  { target: pluginMonitorsCommandEnv.target, default: pluginMonitorsCommandEnv.default },
  { target: pluginNoGitLfs.target, default: pluginNoGitLfs.default },
  { target: pluginPackageLockfile.target, default: pluginPackageLockfile.default },
  { target: pluginPathVarBraced.target, default: pluginPathVarBraced.default },
  { target: pluginUserConfigNoShellFields.target, default: pluginUserConfigNoShellFields.default },
  {
    target: pluginSymlinkEscapesMarketplace.target,
    default: pluginSymlinkEscapesMarketplace.default,
  },
  { target: pluginSymlinkEscapesPlugin.target, default: pluginSymlinkEscapesPlugin.default },
  { target: pluginDependenciesResolve.target, default: pluginDependenciesResolve.default },
  { target: pluginMonitorsSkillExists.target, default: pluginMonitorsSkillExists.default },
  { target: pluginNpmSourceShrinkwrap.target, default: pluginNpmSourceShrinkwrap.default },
  { target: pluginSettingsSingleSource.target, default: pluginSettingsSingleSource.default },
  {
    target: pluginUserConfigSensitiveInContent.target,
    default: pluginUserConfigSensitiveInContent.default,
  },
  { target: pluginFeatureMinVersion.target, default: pluginFeatureMinVersion.default },
  { target: pluginManifestMetadataFormat.target, default: pluginManifestMetadataFormat.default },
  { target: pluginManifestNoBom.target, default: pluginManifestNoBom.default },
  { target: pluginManifestPublishMetadata.target, default: pluginManifestPublishMetadata.default },
  { target: pluginManifestVersionSemver.target, default: pluginManifestVersionSemver.default },
  { target: pluginCommandsMapFields.target, default: pluginCommandsMapFields.default },
  {
    target: pluginDependenciesNotAutoInstalled.target,
    default: pluginDependenciesNotAutoInstalled.default,
  },
  { target: pluginPathNoBackslash.target, default: pluginPathNoBackslash.default },
  { target: pluginSettingsAgentExists.target, default: pluginSettingsAgentExists.default },
  {
    target: pluginSkillsKeyRedundantDefault.target,
    default: pluginSkillsKeyRedundantDefault.default,
  },
  {
    target: pluginUserConfigFieldApplicability.target,
    default: pluginUserConfigFieldApplicability.default,
  },
  { target: pluginBinClaudeAi.target, default: pluginBinClaudeAi.default },
  { target: pluginMonitorsCommandQuote.target, default: pluginMonitorsCommandQuote.default },
  { target: pluginPackageLifecycleScripts.target, default: pluginPackageLifecycleScripts.default },
  { target: pluginPackageLockfileChoice.target, default: pluginPackageLockfileChoice.default },
  { target: pluginThemesLayout.target, default: pluginThemesLayout.default },
  { target: pluginEvalsCaseYaml.target, default: pluginEvalsCaseYaml.default },
  { target: pluginEvalsDir.target, default: pluginEvalsDir.default },
  { target: pluginEvalsGrader.target, default: pluginEvalsGrader.default },
  { target: pluginEvalsMockSchema.target, default: pluginEvalsMockSchema.default },
  { target: pluginEvalsMockServerExists.target, default: pluginEvalsMockServerExists.default },
  { target: pluginEvalsPromptFrontmatter.target, default: pluginEvalsPromptFrontmatter.default },
  { target: pluginEvalsPromptNoAtMentions.target, default: pluginEvalsPromptNoAtMentions.default },
  { target: pluginUserConfigSensitive.target, default: pluginUserConfigSensitive.default },
  { target: pluginChannelServerStdio.target, default: pluginChannelServerStdio.default },
  { target: pluginBinShadowsSystemCommand.target, default: pluginBinShadowsSystemCommand.default },
  {
    target: pluginDependenciesPrereleaseRange.target,
    default: pluginDependenciesPrereleaseRange.default,
  },
  { target: pluginRelevanceSignalHints.target, default: pluginRelevanceSignalHints.default },
  { target: pluginDirNotMarketplaceRoot.target, default: pluginDirNotMarketplaceRoot.default },
  { target: pluginNoStateInPluginRoot.target, default: pluginNoStateInPluginRoot.default },
  { target: pluginNoParentPathEscape.target, default: pluginNoParentPathEscape.default },
  { target: pluginPathUsesPluginRoot.target, default: pluginPathUsesPluginRoot.default },
  { target: sandboxAllowWriteEscalation.target, default: sandboxAllowWriteEscalation.default },
  { target: sandboxCredentialsRecommended.target, default: sandboxCredentialsRecommended.default },
  { target: sandboxDockerExcluded.target, default: sandboxDockerExcluded.default },
  { target: sandboxDomainBroad.target, default: sandboxDomainBroad.default },
  { target: sandboxExcludedCommandsBroad.target, default: sandboxExcludedCommandsBroad.default },
  { target: sandboxProxyEnv.target, default: sandboxProxyEnv.default },
  { target: sandboxSettingsWithoutEnabled.target, default: sandboxSettingsWithoutEnabled.default },
  { target: sandboxUnsandboxedRetry.target, default: sandboxUnsandboxedRetry.default },
]

type RuleName = (typeof modules)[number]['target']['name']
type Language = (typeof modules)[number]['target']['language'] | 'json'
// A rule for files of two languages sets `also` in its `target` export. The
// config then has one block for each.
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

// Language settings only, so the spread in `configFor` and `fileBlocksFor`
// cannot replace a block's `files` or `plugins`.
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
  'skill-name-characters': 'error',
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
  'agent-permission-mode-auto-unavailable': 'error',
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
  'agent-skills-preload-limit': 'warn',
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
// JavaScript rules only. Each config starts with one block of files for each
// language. Then it has the blocks of each rule that it turns on. Add a key
// for a new config.
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

/** The blocks of files from `fileBlocksFor`, then one block for the `files`
 *  and one for the `also` of each rule that `severity` turns on. Each block
 *  also registers the language plugins, so a consumer needs no other setup.
 *  The rule blocks come last, so they set the language of a file that globs
 *  of two languages match. */
function configFor(config: string, severity: (rule: RuleName) => Severity): Linter.Config[] {
  const ruleBlocks = modules
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
  return [...fileBlocksFor(config), ...ruleBlocks]
}

// A glob that matches every file of a language, such as `**/*.md`.
const CATCH_ALL = /^\*\*\/\*\.[A-Za-z0-9]+$/

/** One block for each language, with each glob of that language from the
 *  `files` and `also` of every module, and no rules. A rule that is `off` has
 *  no block of its own, so this block gives its files a config. A user then
 *  turns the rule on with an entry in `rules`. The globs come from the
 *  modules, so a new rule adds no entry to a central list. A catch-all glob
 *  is not in the block. Else a `rules` entry would reach every file of the
 *  language, and a user's own config for those files would change. */
function fileBlocksFor(config: string): Linter.Config[] {
  const globs = new Map<Language, Set<string>>()
  for (const { target } of modules as Module[]) {
    for (const block of [target, ...(target.also ? [target.also] : [])]) {
      const set = globs.get(block.language) ?? new Set<string>()
      for (const glob of block.files.filter((g) => !CATCH_ALL.test(g))) set.add(glob)
      globs.set(block.language, set)
    }
  }
  return [...globs].map(([language, files]) => ({
    name: `claude/${config}/${language}-files`,
    files: [...files],
    plugins: { claude: plugin, markdown, json },
    ...LANGUAGES[language],
  }))
}

plugin.configs.recommended = configFor('recommended', (rule) => recommended[rule])
plugin.configs.strict = configFor('strict', (rule) => STRICT[recommended[rule]])

export default plugin
