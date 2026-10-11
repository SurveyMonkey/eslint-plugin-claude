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

/** The fields that hold a Boolean and that exist before v2.1.218. Claude Code
 *  reads `yes`, `no`, `on`, `off`, `1` and `0` in them from v2.1.218. The field
 *  `background` is not here, because it needs v2.1.218 itself. */
export const SKILL_BOOLEAN_FIELDS: readonly string[] = [
  'disable-model-invocation',
  'user-invocable',
]
