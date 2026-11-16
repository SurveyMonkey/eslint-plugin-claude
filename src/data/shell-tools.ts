// The shell tools of a permission rule. Source: the permissions page, "Match all uses of a tool"
// and "PowerShell" (https://code.claude.com/docs/en/permissions). The list was checked on
// 2026-11-16 against the live page. That page names no version, so the version is from
// `claude --version`: Claude Code 2.1.325. Review this list on or before 2027-03-30, the earliest
// `stale_after` date of the rule docs that cite it.

/** The shell tools whose bare name and `(*)` form match every command. The permissions page says
 *  so for `Bash` ("Match all uses of a tool") and for `PowerShell` ("PowerShell"). */
export const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']
