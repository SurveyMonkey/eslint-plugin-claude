// The command names that the permissions page lists for Bash rules. Source: the "Bash" section
// (https://code.claude.com/docs/en/permissions#bash), checked on Claude Code 2.1.296 on
// 2026-10-10. Review these lists on or before 2027-04-10, the `stale_after` date of
// docs/rules/permissions-bash-stripped-wrapper.md. `tests/bash-commands.test.ts` pins each list to
// the sentence of the docs that it comes from.

/** The wrappers that Claude Code strips before it matches a Bash rule: "The stripped wrappers are
 *  `timeout`, `time`, `nice`, `nohup`, and `stdbuf`, plus the shell builtins `command` and
 *  `builtin`, and zsh's `noglob`"
 *  (https://code.claude.com/docs/en/permissions#process-wrappers). */
export const STRIPPED_WRAPPERS: readonly string[] = [
  'timeout',
  'time',
  'nice',
  'nohup',
  'stdbuf',
  'command',
  'builtin',
  'noglob',
]

/** The commands that the "Read-only commands" part lists: "The set includes `ls`, `cat`, `echo`,
 *  `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`, and read-only
 *  forms of `git`" (https://code.claude.com/docs/en/permissions#read-only-commands). The list
 *  leaves out `git`, because the docs name no form of it. */
export const READ_ONLY_COMMANDS: readonly string[] = [
  'ls',
  'cat',
  'echo',
  'pwd',
  'head',
  'tail',
  'grep',
  'find',
  'wc',
  'which',
  'diff',
  'stat',
  'du',
  'cd',
]

/** The read-only commands that still prompt for some arguments. `find` prompts for an
 *  unquoted glob, and `cd` prompts for a target out of the working directories
 *  (https://code.claude.com/docs/en/permissions#read-only-commands). A rule for them is not
 *  redundant unless it names the bare command. */
export const READ_ONLY_WITH_PROMPTS: readonly string[] = ['find', 'cd']

/** The commands that fetch a URL: "use deny rules to stop `curl`, `wget`, and similar commands"
 *  (https://code.claude.com/docs/en/permissions#read-only-commands, the warning on rules that
 *  constrain arguments). */
export const FETCH_COMMANDS: readonly string[] = ['curl', 'wget']

/** The directories at the root of a file system that a path rule can name: a person who writes
 *  `/Users/me/x` means the absolute path. A project directory such as `/src` is not in the list.
 *  This is a choice of the plugin, and it limits `permissions-path-anchor` to paths that are
 *  likely absolute. */
export const ABSOLUTE_ROOTS: readonly string[] = [
  'Users',
  'home',
  'tmp',
  'var',
  'etc',
  'opt',
  'usr',
  'mnt',
  'Volumes',
  'private',
  'Library',
  'Applications',
  'root',
  'srv',
  'nix',
]
