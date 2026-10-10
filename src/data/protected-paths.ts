// The paths that Claude Code protects from an allow rule. Source: the
// "Protected paths" section of the permission modes page
// (https://code.claude.com/docs/en/permission-modes#protected-paths) and the
// "Protected paths" section of the sandboxing page
// (https://code.claude.com/docs/en/sandboxing#protected-paths), checked on
// Claude Code 2.1.296 on 2026-10-10. Review these lists on or before
// 2027-03-29, the `stale_after` date of docs/rules-inventory.md. A path is a
// list of segments, and each name is case-sensitive.

/** The directories of the permission check. Claude Code does not pre-approve
 *  a write under one, whatever the allow rules in settings say. */
export const PROTECTED_DIRECTORIES: readonly (readonly string[])[] = [
  ['.git'],
  ['.config', 'git'],
  ['.vscode'],
  ['.idea'],
  ['.husky'],
  ['.cargo'],
  ['.devcontainer'],
  ['.yarn'],
  ['.mvn'],
  ['.claude'],
]

/** The paths under `.claude` that the docs except from the check, as the
 *  segments after `.claude`. A `*` stands for any one segment. The docs name
 *  them "such as": the worktrees of Claude Code, its plan files, the scratch
 *  directory `jobs/<id>/tmp` of a background session, the `memory` directory
 *  of a project, and the memory files of a subagent. The rule treats a pattern
 *  at or under one of them as no protected path. */
export const CLAUDE_DIRECTORY_EXCEPTIONS: readonly (readonly string[])[] = [
  ['worktrees'],
  ['plans'],
  ['jobs', '*', 'tmp'],
  ['projects', '*', 'memory'],
  ['agent-memory'],
]

/** The files of the permission check, by name. */
export const PROTECTED_FILES: readonly string[] = [
  '.gitconfig',
  '.gitmodules',
  '.bashrc',
  '.bash_profile',
  '.bash_login',
  '.bash_aliases',
  '.bash_logout',
  '.zshrc',
  '.zprofile',
  '.zshenv',
  '.zlogin',
  '.zlogout',
  '.profile',
  '.envrc',
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',
  '.pnp.cjs',
  '.pnp.loader.mjs',
  '.pnpmfile.cjs',
  'bunfig.toml',
  '.bunfig.toml',
  '.bazelrc',
  '.bazelversion',
  '.bazeliskrc',
  '.pre-commit-config.yaml',
  'lefthook.yml',
  'lefthook.yaml',
  '.lefthook.yml',
  '.lefthook.yaml',
  'gradle-wrapper.properties',
  'maven-wrapper.properties',
  '.devcontainer.json',
  '.ripgreprc',
  'pyrightconfig.json',
  '.mcp.json',
  '.claude.json',
]

/** The paths of the working directory that the sandbox keeps write-denied
 *  while a command runs. An `allowWrite` entry cannot lift them. The sandbox
 *  list is not the list of the permission check. The docs name `.bashrc` and
 *  `.zshrc` as the shell startup files, and `hooks` and `config` inside
 *  `.git`. */
export const SANDBOX_PROTECTED_PATHS: readonly (readonly string[])[] = [
  ['.claude', 'settings.json'],
  ['.claude', 'settings.local.json'],
  ['.claude', 'skills'],
  ['.claude', 'agents'],
  ['.claude', 'commands'],
  ['.claude', 'hooks'],
  ['.claude', 'workflows'],
  ['.claude', 'scheduled_tasks.json'],
  ['.mcp.json'],
  ['.bashrc'],
  ['.zshrc'],
  ['.gitconfig'],
  ['.vscode'],
  ['.idea'],
  ['.git', 'hooks'],
  ['.git', 'config'],
]
