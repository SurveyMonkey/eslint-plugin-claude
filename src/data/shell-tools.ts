// The shell tools of a permission rule. Source: the permissions page, "Match all uses of a tool"
// and "PowerShell" (https://code.claude.com/docs/en/permissions). The Claude Code version of the
// last check is not on record. Review this list on or before 2027-03-30, the earliest
// `stale_after` date of the rule docs that cite it.

/** The shell tools whose bare name and `(*)` form match every command. The permissions page says
 *  so for `Bash` ("Match all uses of a tool") and for `PowerShell` ("PowerShell"). */
export const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']
