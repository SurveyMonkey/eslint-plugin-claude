// The frontmatter fields of a skill, from the Frontmatter reference table of
// the Claude Code skills docs, as read on 2026-09-30
// (docs/rules/skill-frontmatter-schema.md).

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
