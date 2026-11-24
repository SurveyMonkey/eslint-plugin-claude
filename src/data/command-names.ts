// The command names that Claude Code owns, from the All commands table of
// https://code.claude.com/docs/en/commands#all-commands, checked on Claude
// Code 2.1.296 on 2026-10-10. Review this list on or before 2027-04-10, the
// `stale_after` date of docs/rules/skill-name-shadows-builtin.md. The rows of `ship` and
// `steward` come from the docs snapshot of 2026-11-24.
//
// An alias is not in either list. The skills page says that a skill replaces
// the command with its name, but not its aliases (`/review`, `/cost`, `/stats`).

/** The built-in commands: each row of the table that is not a skill, a workflow
 *  or an alias. */
export const BUILT_IN_COMMANDS: readonly string[] = [
  'add-dir',
  'advisor',
  'agents',
  'artifacts',
  'auto-mode-setup',
  'autocompact',
  'autofix-pr',
  'background',
  'branch',
  'btw',
  'bug',
  'cd',
  'chrome',
  'clear',
  'color',
  'compact',
  'config',
  'context',
  'copy',
  'design-login',
  'desktop',
  'diff',
  'effort',
  'exit',
  'export',
  'fast',
  'feedback',
  'focus',
  'fork',
  'goal',
  'heapdump',
  'help',
  'hooks',
  'ide',
  'import',
  'init',
  'insights',
  'install-github-app',
  'install-slack-app',
  'keybindings',
  'list-agents',
  'login',
  'logout',
  'mcp',
  'memory',
  'mobile',
  'model',
  'output-style',
  'passes',
  'permissions',
  'plan',
  'plugin',
  'plugin-authoring',
  'powerup',
  'pr-comments',
  'privacy-settings',
  'radio',
  'rate-limit-options',
  'recap',
  'release-notes',
  'reload-plugins',
  'reload-skills',
  'remote-control',
  'remote-env',
  'rename',
  'restart',
  'resume',
  'rewind',
  'sandbox',
  'schedule',
  'scroll-speed',
  'security-review',
  'setup-bedrock',
  'setup-vertex',
  'skill-doctor',
  'skills',
  'status',
  'statusline',
  'stickers',
  'stop',
  'subtask',
  'tasks',
  'team-onboarding',
  'teleport',
  'terminal-setup',
  'theme',
  'tui',
  'ultraplan',
  'ultrareview',
  'upgrade',
  'usage',
  'usage-credits',
  'vim',
  'voice',
  'web-setup',
  'workflows',
]

/** The bundled skills: each row of the table that the table marks as a Skill.
 *  Two names are left out on purpose. The skills page describes a project skill
 *  named `verify` or `simplify` as a supported setup: `/verify` records its
 *  recipe in `.claude/skills/verify/SKILL.md`, and Claude Code runs a skill
 *  with either name before each commit. The workflow `deep-research` is not a
 *  skill, and the docs do not say what a skill of that name does. */
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
  'ship',
  'slides',
  'steward',
  'update-config',
  'workflow-authoring',
]

/** The names that Claude Code does not load for a skill or command of yours, where `/ship`
 *  is available. The skills page, "Resolve skills that share a name", lists them: the bundled
 *  `/ship` or `/steward` runs instead. `ship-local` is not a row of the commands table, so it
 *  is in this set only. Checked on 2026-11-24. Review this set with `BUNDLED_SKILLS`. */
export const NOT_LOADED_SKILLS: readonly string[] = ['ship', 'ship-local', 'steward']
