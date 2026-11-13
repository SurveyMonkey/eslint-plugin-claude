// The platforms that a rule with the option `platforms` knows. Source: the hooks reference,
// "Command hook fields" (https://code.claude.com/docs/en/hooks#command-hook-fields), checked on
// Claude Code 2.1.287. Review this list on or before 2027-03-29, the `stale_after` date of
// docs/rules-inventory.md.

/** The platforms that a rule with the option `platforms` knows. Claude Code runs a hook in PowerShell by
 *  default on `windows-no-git-bash`, and in Bash on the others (the hooks reference, "Command hook fields"). */
export const PLATFORMS = [
  'windows-git-bash',
  'windows-no-git-bash',
  'macos',
  'linux',
  'wsl',
] as const
