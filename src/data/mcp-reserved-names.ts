// The server names that Claude Code reserves for its built-in MCP servers. Source: the
// "Configuration warnings" block of the MCP page
// (https://code.claude.com/docs/en/mcp#configuration-warnings), checked on Claude Code 2.1.295.
// Review this list on or before 2027-04-10, the `stale_after` date of
// docs/rules/mcp-server-name-reserved.md. A name is case-sensitive, and two of them hold a space.

/** The names that Claude Code skips at load time, with a warning to rename the server. */
export const RESERVED_MCP_SERVER_NAMES: readonly string[] = [
  'workspace',
  'claude-in-chrome',
  'computer-use',
  'Claude Preview',
  'Claude Browser',
]
