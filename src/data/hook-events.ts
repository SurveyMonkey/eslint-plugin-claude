import type { HandlerType } from '../hooks-config.ts'

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

/** A matcher value that only a later Claude Code sends, with the first version. Source: the hooks
 *  reference, "Matcher patterns" for `cloud_credential_error` and "Notification" for the three
 *  `quota_auto_resume_*` values. */
export const MATCHER_VALUE_SINCE: readonly {
  event: string
  values: readonly string[]
  version: string
}[] = [
  { event: 'StopFailure', values: ['cloud_credential_error'], version: '2.1.267' },
  {
    event: 'Notification',
    values: ['quota_auto_resume_fired', 'quota_auto_resume_stale', 'quota_auto_resume_disabled'],
    version: '2.1.234',
  },
]

/** The events whose matcher is a list of exact values with `|` as the one separator. Every other
 *  event with matcher support also accepts `,`, a space and `-`. */
export const NARROW_MATCHER_EVENTS: readonly string[] = ['FileChanged', 'StopFailure']

// The events that set `CLAUDE_ENV_FILE`. Source: the hooks reference, "Persist environment
// variables" (https://code.claude.com/docs/en/hooks#persist-environment-variables), checked on
// 2026-10-10. Hooks on other events do not have the variable. Review this section on or before 2027-04-10.

/** The events whose hooks get the `CLAUDE_ENV_FILE` environment variable. */
export const ENV_FILE_EVENTS: readonly string[] = [
  'SessionStart',
  'Setup',
  'CwdChanged',
  'FileChanged',
]

// The fields of a hook handler. Source: the hooks reference, "Hook handler fields"
// (https://code.claude.com/docs/en/hooks#hook-handler-fields), checked on 2026-10-10. Review this
// section on or before 2027-04-10.

/** The fields of every handler type. */
export const COMMON_HANDLER_FIELDS: readonly string[] = [
  'type',
  'if',
  'timeout',
  'statusMessage',
  'once',
]

/** The fields that only one handler type lists, by type. `onFailure` is on `command` and `http` hooks, and
 *  `continueOnBlock` on `prompt` hooks. */
export const HANDLER_FIELDS: Readonly<Record<HandlerType, readonly string[]>> = {
  command: ['command', 'args', 'async', 'asyncRewake', 'shell', 'onFailure'],
  http: ['url', 'headers', 'allowedEnvVars', 'onFailure'],
  mcp_tool: ['server', 'tool', 'input'],
  prompt: ['prompt', 'model', 'continueOnBlock'],
  agent: ['prompt', 'model'],
}

// The events that run an agent hook. Source: the hooks reference, "Agent-based hooks"
// (https://code.claude.com/docs/en/hooks#agent-based-hooks), checked on 2026-10-10. Agent hooks run on the
// events that run prompt hooks, except `PermissionRequest`. The list of those events is in "Prompt-based
// hooks" (https://code.claude.com/docs/en/hooks#prompt-based-hooks), which `hooks-handler-type-event-support`
// cites. `PermissionDenied` is also not in this list: Claude Code runs an agent hook there and discards
// its output. Review this section on or before 2027-04-10.

/** The events whose agent hooks Claude Code runs and acts on. */
export const AGENT_HOOK_EVENTS: readonly string[] = [
  'UserPromptSubmit',
  'UserPromptExpansion',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PostToolBatch',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'Stop',
  'TeammateIdle',
]
