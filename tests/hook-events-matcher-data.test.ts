// The matcher facts of `src/data/hook-events.ts` against a literal copy of the hooks reference,
// "Matcher patterns" (https://code.claude.com/docs/en/hooks#matcher-patterns). The rule tests loop
// over these constants, so a wrong entry would pass them.
import { describe, expect, it } from 'vitest'
import {
  MATCHER_VALUES,
  NARROW_MATCHER_EVENTS,
  NO_MATCHER_EVENTS,
  TOOL_EVENTS,
} from '../src/data/hook-events.ts'

describe('the matcher data', () => {
  it('lists the events without matcher support', () => {
    expect([...NO_MATCHER_EVENTS].sort()).toEqual(
      [
        'CwdChanged',
        'MessageDisplay',
        'PostToolBatch',
        'Stop',
        'TaskCompleted',
        'TaskCreated',
        'TeammateIdle',
        'UserPromptSubmit',
        'WorktreeCreate',
        'WorktreeRemove',
      ].sort(),
    )
  })

  it('lists the tool events', () => {
    expect([...TOOL_EVENTS]).toEqual([
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'PermissionRequest',
      'PermissionDenied',
    ])
  })

  it('lists the events with a narrow exact set', () => {
    expect([...NARROW_MATCHER_EVENTS]).toEqual(['FileChanged', 'StopFailure'])
  })

  it('lists the matcher values of each event with a fixed set', () => {
    expect(Object.fromEntries(MATCHER_VALUES)).toEqual({
      SessionStart: ['startup', 'resume', 'clear', 'compact', 'fork'],
      Setup: ['init', 'maintenance'],
      SessionEnd: ['clear', 'resume', 'logout', 'prompt_input_exit', 'other'],
      Notification: [
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
      PreCompact: ['manual', 'auto'],
      PostCompact: ['manual', 'auto'],
      ConfigChange: [
        'user_settings',
        'project_settings',
        'local_settings',
        'policy_settings',
        'skills',
      ],
      DirectoryAdded: ['slash_command', 'register_repo_root'],
      StopFailure: [
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
      InstructionsLoaded: [
        'session_start',
        'nested_traversal',
        'path_glob_match',
        'include',
        'compact',
      ],
    })
  })
})
