// The shell tools of a permission rule. Source: the permissions page, "Match all uses of a tool"
// and "PowerShell" (https://code.claude.com/docs/en/permissions). The check of 2026-11-16 used
// the live page. That page names no version. The local `claude --version` gave Claude Code
// 2.1.325 on the day of the check. Review this list on or before 2027-03-30, the earliest
// `stale_after` date of the rule docs that cite it.

/** The shell tools whose bare name and `(*)` form match every command. The permissions page says
 *  so for `Bash` ("Match all uses of a tool") and for `PowerShell` ("PowerShell"). */
export const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']
