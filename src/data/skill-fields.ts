// The frontmatter fields of a skill. Source: the Frontmatter reference table,
// https://code.claude.com/docs/en/skills#frontmatter-reference, checked on
// Claude Code 2.1.286. Review this list on or before 2027-03-30, the
// `stale_after` date of docs/rules/skill-frontmatter-schema.md.

/** Every field that a `SKILL.md` accepts. */
export const SKILL_FIELDS = [
  'name',
  'description',
  'when_to_use',
  'argument-hint',
  'arguments',
  'disable-model-invocation',
  'user-invocable',
  'allowed-tools',
  'disallowed-tools',
  'model',
  'effort',
  'context',
  'agent',
  'background',
  'hooks',
  'paths',
  'shell',
  'metadata',
  'license',
  'compatibility',
] as const

/** The fields that a command file does not accept. */
export const COMMAND_EXCLUDED: readonly string[] = ['name', 'paths']

/** The bundled skills: the rows of the commands reference that it marks as a skill
 *  (https://code.claude.com/docs/en/commands#all-commands), checked on Claude Code 2.1.296 on
 *  2026-10-10. A session can lack some of them, such as `claude-in-chrome` and
 *  `workflow-authoring`, so the list is a set of valid names, not of available ones. Review it on
 *  or before the `stale_after` date of docs/rules/settings-skilloverrides-unknown-skill.md. */
export const BUNDLED_SKILLS: readonly string[] = [
  'artifact-capabilities',
  'artifact-diagramming',
  'batch',
  'claude-api',
  'claude-in-chrome',
  'code-review',
  'dataviz',
  'debug',
  'design',
  'design-sync',
  'doctor',
  'fewer-permission-prompts',
  'loop',
  'run',
  'run-skill-generator',
  'simplify',
  'slides',
  'update-config',
  'verify',
  'workflow-authoring',
]
