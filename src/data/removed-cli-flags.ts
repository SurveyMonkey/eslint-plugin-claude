// The CLI flags that Claude Code removed. Sources: the CLI reference, "CLI flags"
// (https://code.claude.com/docs/en/cli-reference#cli-flags), for `--enable-auto-mode`, and the
// error reference
// (https://code.claude.com/docs/en/errors#sandbox-is-not-supported-by-claude-remote-control), for
// the two sandbox flags. Checked on Claude Code 2.1.302 on 2026-10-16. Review this list on or
// before 2027-04-10, the `stale_after` date of docs/rules/hooks-command-removed-cli-flag.md.

/** A flag that Claude Code removed, and the message that the rule gives for it. */
export interface RemovedFlag {
  readonly flag: string
  /** The version that removed the flag. */
  readonly version: string
  /** The subcommand that the flag is removed from. A flag with no subcommand is removed from each command. */
  readonly subcommand?: string
  readonly messageId: 'removed' | 'removedFromSubcommand'
}

export const REMOVED_FLAGS: readonly RemovedFlag[] = [
  { flag: '--enable-auto-mode', version: 'v2.1.111', messageId: 'removed' },
  {
    flag: '--sandbox',
    version: 'v2.1.300',
    subcommand: 'remote-control',
    messageId: 'removedFromSubcommand',
  },
  {
    flag: '--no-sandbox',
    version: 'v2.1.300',
    subcommand: 'remote-control',
    messageId: 'removedFromSubcommand',
  },
]
