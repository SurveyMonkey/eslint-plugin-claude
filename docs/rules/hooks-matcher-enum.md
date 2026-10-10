---
type: Reference
description: The ESLint rule claude/hooks-matcher-enum, which reports a matcher value that a hook event never sends, such as a SessionStart matcher of begin or a PreCompact matcher of now, for the ten events with a fixed set of matcher values.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-enum`

Use a matcher value that the hook event sends.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

Ten events match on a fixed set of values.[^patterns] A hook with a matcher value outside the set never
runs. The rule reports at the `matcher` value, once for each value that is not in the set.

| Event | Values |
|-------|--------|
| `SessionStart` | `startup`, `resume`, `clear`, `compact`, `fork` |
| `Setup` | `init`, `maintenance` |
| `SessionEnd` | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` |
| `Notification` | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`, `elicitation_url_dialog`, `elicitation_complete`, `elicitation_response`, `agent_needs_input`, `agent_completed`, `quota_auto_resume_fired`, `quota_auto_resume_stale`, `quota_auto_resume_disabled` |
| `PreCompact`, `PostCompact` | `manual`, `auto` |
| `ConfigChange` | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `DirectoryAdded` | `slash_command`, `register_repo_root` |
| `StopFailure` | `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `cloud_credential_error`, `unknown` |
| `InstructionsLoaded` | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |

The rule reads a matcher that holds exact-match characters only. These are letters, digits, `_`, `-`,
spaces, `,` and `|`.[^patterns] It splits the matcher at `|` and `,`, and checks each value. For `StopFailure`
the exact set is narrower: letters, digits, `_` and `|`, and only `|` separates.[^patterns] The rule makes no
report in these cases:

- The matcher is omitted, empty or `*`. Each means match-all.[^patterns]
- The matcher holds any other character. Claude Code reads it as a regular expression. The rule cannot
  read which values it selects.
- The value is `bypass_permissions_disabled` on `SessionEnd`. Claude Code removed it in v2.1.234.[^sessionend]
  The docs tell you to drop it, and that is a deprecation, not an unknown value.
- The event has no fixed set, or it is not a known event.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "begin", "hooks": [{ "type": "command", "command": "./setup.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume", "hooks": [{ "type": "command", "command": "./setup.sh" }] }]
  }
}
```

## Sources

[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
[^sessionend]: [Hooks reference: SessionEnd](https://code.claude.com/docs/en/hooks#sessionend)
