// The credential variables that the MCP page names. Sources: "Credential variables that read as
// empty" (https://code.claude.com/docs/en/mcp#credential-variables-that-read-as-empty) and
// "Which variables a helper can read"
// (https://code.claude.com/docs/en/mcp#which-variables-a-helper-can-read), checked on Claude
// Code 2.1.295 on 2026-10-10. Review these lists on or before 2027-04-10, the `stale_after`
// date of docs/rules/mcp-credential-var-remote.md.
import { CREDENTIAL_ENV_VARS, CUSTOM_HEADERS_VAR } from './settings-env.ts'

/** The variables that read as empty in the `url` and `headers` of a remote server. The docs say
 *  "such as", so the set is open. It holds the credentials of Claude Code (the shared list of
 *  `settings-env.ts`) and the three names that the docs add: a cloud provider credential, a
 *  proxy URL and a package registry token. */
export const REMOTE_EMPTY_CREDENTIAL_VARS: readonly string[] = [
  ...CREDENTIAL_ENV_VARS,
  'AWS_BEARER_TOKEN_BEDROCK',
  'HTTPS_PROXY',
  'NPM_TOKEN',
]

/** The words that make Claude Code remove a variable from the environment of a `headersHelper`
 *  that a repository or a plugin supplies. The match is in either letter case. */
export const HELPER_CREDENTIAL_WORDS: readonly string[] = [
  'TOKEN',
  'SECRET',
  'PASSWORD',
  'KEY',
  'AUTH',
]

/** The variables of Git that keep their place although `KEY` is in the name. */
export const HELPER_KEPT_VAR = /^GIT_CONFIG_KEY_\d+$/

/** A variable that Claude Code removes by name, as the docs list it. Its name has none of the
 *  words above. */
export const HELPER_REMOVED_VARS: readonly string[] = [CUSTOM_HEADERS_VAR]
