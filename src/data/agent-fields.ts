// The frontmatter fields of a subagent file and of an output style file.
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
