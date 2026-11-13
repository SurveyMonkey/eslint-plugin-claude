// The shell tools of a permission rule. Source: the permissions page, "Match all uses of a tool"
// and "PowerShell" (https://code.claude.com/docs/en/permissions), checked on Claude Code 2.1.287.
// Review this list on or before 2027-03-29, the `stale_after` date of docs/rules-inventory.md.

/** The shell tools whose bare name and `(*)` form match every command. The permissions page says
 *  so for `Bash` ("Match all uses of a tool") and for `PowerShell` ("PowerShell"). */
export const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell']
