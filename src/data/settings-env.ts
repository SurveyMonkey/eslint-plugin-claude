// The `env` variables that Claude Code reads from a settings file, and the forms of their
// values. Sources: the env vars reference (https://code.claude.com/docs/en/env-vars#variables),
// the entry for `env` in the settings reference
// (https://code.claude.com/docs/en/settings-reference#variables-claude-code-ignores-in-env),
// and the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog),
// checked on Claude Code 2.1.295 on 2026-10-08. Review these lists on or before 2027-04-08,
// the `stale_after` date of docs/rules/settings-env-credential.md.

/** The variables that hold an authentication credential. The server-managed settings page
 *  lists them as "Authentication credentials". `CLAUDE_CODE_CLIENT_KEY` is not here. It holds
 *  the path to a key file, not a credential. */
export const CREDENTIAL_ENV_VARS: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
]

/** The variable that holds `Name: Value` header lines, one for each line. */
export const CUSTOM_HEADERS_VAR = 'ANTHROPIC_CUSTOM_HEADERS'

/** The header names that carry a credential, as the docs write them. Claude Code sends
 *  `ANTHROPIC_API_KEY` as `X-Api-Key` and `ANTHROPIC_AUTH_TOKEN` as `Authorization`. */
export const CREDENTIAL_HEADERS: readonly string[] = ['Authorization', 'X-Api-Key']
