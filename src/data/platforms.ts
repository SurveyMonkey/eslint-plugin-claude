// The platforms that the option `platforms` of a rule names. The five values are the vocabulary
// of this plugin. The hooks reference, "Command hook fields"
// (https://code.claude.com/docs/en/hooks#command-hook-fields), is the source for the default
// shell on each of them. The Claude Code version of the last check is not on record. Review this
// list on or before 2027-04-10, the `stale_after` date of docs/rules/sandbox-platform-limits.md
// and of the other rule docs that cite it.

/** Claude Code runs a hook in PowerShell by default on `windows-no-git-bash`, and in Bash on the
 *  others (the hooks reference, "Command hook fields"). */
export const PLATFORMS = [
  'windows-git-bash',
  'windows-no-git-bash',
  'macos',
  'linux',
  'wsl',
] as const
