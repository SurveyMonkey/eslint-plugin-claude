// The frontmatter fields of a subagent file and of an output style file, and
// the values of the subagent fields that take a fixed set.
// Sources: the Frontmatter reference tables,
// https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields and
// https://code.claude.com/docs/en/output-styles#frontmatter, checked on
// Claude Code 2.1.285. Review these lists on or before 2027-04-01, the
// `stale_after` date of docs/rules/agent-frontmatter-schema.md and
// docs/rules/output-style-frontmatter-schema.md.

/** Every field that a subagent file accepts. */
export const AGENT_FIELDS = [
  'name',
  'description',
  'tools',
  'disallowedTools',
  'model',
  'permissionMode',
  'maxTurns',
  'skills',
  'mcpServers',
  'hooks',
  'memory',
  'background',
  'omitClaudeMd',
  'effort',
  'isolation',
  'color',
  'initialPrompt',
  'experimental',
] as const

/** Every field that an output style file accepts. */
export const OUTPUT_STYLE_FIELDS = [
  'name',
  'description',
  'keep-coding-instructions',
  'force-for-plugin',
] as const

/** The values of `memory`. */
export const MEMORY_SCOPES = ['user', 'project', 'local'] as const

/** The values of the fields that take one of a fixed set, by field name. */
export const AGENT_ENUMS: Readonly<Record<string, readonly string[]>> = {
  permissionMode: [
    'default',
    'acceptEdits',
    'auto',
    'dontAsk',
    'bypassPermissions',
    'plan',
    'manual',
  ],
  memory: MEMORY_SCOPES,
  effort: ['low', 'medium', 'high', 'xhigh', 'max'],
  isolation: ['worktree'],
  color: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'],
}

/** The values of `experimental.cacheTtl`. */
export const CACHE_TTL_VALUES = ['5m', '1h'] as const

/** The `type` values of a server in `.mcp.json`. Claude Code skips an `sdk`
 *  server with a warning. */
export const MCP_SERVER_TYPES = ['stdio', 'http', 'sse', 'ws', 'sdk'] as const

/** The names of the built-in subagents. Source: the "Built-in subagents"
 *  section (https://code.claude.com/docs/en/sub-agents#built-in-subagents),
 *  checked on 2026-10-10. */
export const BUILT_IN_AGENTS = [
  'Explore',
  'Plan',
  'general-purpose',
  'claude',
  'statusline-setup',
  'claude-code-guide',
] as const
