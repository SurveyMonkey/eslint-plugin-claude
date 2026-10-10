// The hook event names that Claude Code knows. Source: the hooks reference,
// "Hook lifecycle" (https://code.claude.com/docs/en/hooks#hook-lifecycle),
// checked on Claude Code 2.1.285. Review this list on or before 2027-03-29,
// the `stale_after` date of docs/rules-inventory.md. A team on a newer
// release can add a name with the `additionalEvents` option of
// `hooks-event-name-known`.
export const HOOK_EVENTS: readonly string[] = [
  'SessionStart',
  'Setup',
  'UserPromptSubmit',
  'UserPromptExpansion',
  'PreToolUse',
  'PermissionRequest',
  'PermissionDenied',
  'PostToolUse',
  'PostToolUseFailure',
  'PostToolBatch',
  'Notification',
  'MessageDisplay',
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'Stop',
  'StopFailure',
  'TeammateIdle',
  'InstructionsLoaded',
  'ConfigChange',
  'CwdChanged',
  'DirectoryAdded',
  'FileChanged',
  'WorktreeCreate',
  'WorktreeRemove',
  'PreCompact',
  'PostCompact',
  'PreModelSwitch',
  'PostModelSwitch',
  'Elicitation',
  'ElicitationResult',
  'SessionEnd',
]

// The matcher facts per event. Source: the hooks reference, "Matcher patterns"
// (https://code.claude.com/docs/en/hooks#matcher-patterns), checked on 2026-10-10.
// Review this section on or before 2027-04-10.

/** The events that run a hook for every occurrence and ignore a `matcher`. */
export const NO_MATCHER_EVENTS: readonly string[] = [
  'UserPromptSubmit',
  'PostToolBatch',
  'Stop',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'WorktreeCreate',
  'WorktreeRemove',
  'MessageDisplay',
  'CwdChanged',
]

/** The events whose matcher selects a tool name. */
export const TOOL_EVENTS: readonly string[] = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
]

/** The events with a fixed set of matcher values, and the values. */
export const MATCHER_VALUES: ReadonlyMap<string, readonly string[]> = new Map([
  ['SessionStart', ['startup', 'resume', 'clear', 'compact', 'fork']],
  ['Setup', ['init', 'maintenance']],
  ['SessionEnd', ['clear', 'resume', 'logout', 'prompt_input_exit', 'other']],
  [
    'Notification',
    [
      'permission_prompt',
      'idle_prompt',
      'auth_success',
      'elicitation_dialog',
      'elicitation_url_dialog',
      'elicitation_complete',
      'elicitation_response',
      'agent_needs_input',
      'agent_completed',
      'quota_auto_resume_fired',
      'quota_auto_resume_stale',
      'quota_auto_resume_disabled',
    ],
  ],
  ['PreCompact', ['manual', 'auto']],
  ['PostCompact', ['manual', 'auto']],
  [
    'ConfigChange',
    ['user_settings', 'project_settings', 'local_settings', 'policy_settings', 'skills'],
  ],
  ['DirectoryAdded', ['slash_command', 'register_repo_root']],
  [
    'StopFailure',
    [
      'rate_limit',
      'overloaded',
      'authentication_failed',
      'oauth_org_not_allowed',
      'account_on_hold',
      'billing_error',
      'invalid_request',
      'model_not_found',
      'server_error',
      'max_output_tokens',
      'cloud_credential_error',
      'unknown',
    ],
  ],
  [
    'InstructionsLoaded',
    ['session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact'],
  ],
])

/** A matcher value that Claude Code no longer sends, for each event. The docs list it as removed,
 *  so it is not a value that Claude Code does not know. */
export const REMOVED_MATCHER_VALUES: ReadonlyMap<string, readonly string[]> = new Map([
  ['SessionEnd', ['bypass_permissions_disabled']],
])

/** The events whose matcher is a list of exact values with `|` as the one separator. Every other
 *  event with matcher support also accepts `,`, a space and `-`. */
export const NARROW_MATCHER_EVENTS: readonly string[] = ['FileChanged', 'StopFailure']

// The events that set `CLAUDE_ENV_FILE`. Source: the hooks reference, "Persist environment
// variables" (https://code.claude.com/docs/en/hooks#persist-environment-variables), checked on
// 2026-10-10. Other hook types do not have the variable. Review this section on or before 2027-04-10.

/** The events whose hooks get the `CLAUDE_ENV_FILE` environment variable. */
export const ENV_FILE_EVENTS: readonly string[] = [
  'SessionStart',
  'Setup',
  'CwdChanged',
  'FileChanged',
]
