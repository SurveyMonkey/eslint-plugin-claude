// The hosts of the Anthropic-hosted connectors that sign in through claude.ai only. Source: the
// error "Server is Anthropic-hosted and doesn't support local OAuth"
// (https://code.claude.com/docs/en/errors#anthropic-hosted-and-doesnt-support-local-oauth),
// checked on Claude Code 2.1.296 on 2026-10-10. The docs say "include", so the list is open.
// Review it on or before 2027-04-10, the `stale_after` date of
// docs/rules/mcp-anthropic-hosted-url.md.

/** The hosts for which Claude Code refuses to start a local OAuth flow. Each host is in lower
 *  case, with no trailing dot. */
export const ANTHROPIC_CONNECTOR_HOSTS: readonly string[] = [
  'microsoft365.mcp.claude.com',
  'gmail.mcp.claude.com',
  'gcal.mcp.claude.com',
]
