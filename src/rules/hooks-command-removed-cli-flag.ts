// A hook command that runs `claude` with a flag that Claude Code removed
// (docs/rules/hooks-command-removed-cli-flag.md). `src/data/removed-cli-flags.ts` lists the flags.
// `--enable-auto-mode` is gone since v2.1.111, and `--permission-mode auto` replaces it (the CLI
// reference, "CLI flags"). v2.1.300 removed `--sandbox` and `--no-sandbox` from
// `claude remote-control` (the error reference). A command in exec form (with `args`) is an
// executable and its arguments. A command in shell form is a shell line, so the rule splits it into
// the simple commands and their words, and checks each command that runs `claude`.
import type { Rule } from 'eslint'
import { REMOVED_FLAGS, type RemovedFlag } from '../data/removed-cli-flags.ts'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'
import { claudeArguments, isClaude } from '../shell-words.ts'

const name = 'hooks-command-removed-cli-flag' as const

/** The removed flag that the argument at `at` of `claude` is, or undefined. A flag of a subcommand
 *  counts only when the subcommand is an earlier argument. A global flag can come before the
 *  subcommand, as in `claude --verbose remote-control`. An argument that is not a string is
 *  undefined. */
function removedFlagAt(args: readonly (string | undefined)[], at: number): RemovedFlag | undefined {
  const word = args[at]
  return REMOVED_FLAGS.find(
    ({ flag, subcommand }) =>
      (word === flag || word?.startsWith(`${flag}=`)) &&
      (subcommand === undefined || args.slice(0, at).includes(subcommand)),
  )
}

/** The messageId and the data of a report for a removed flag. */
const reportOf = ({ flag, version, subcommand, messageId }: RemovedFlag) => ({
  messageId,
  data: { flag, version, subcommand },
})

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not pass a CLI flag that Claude Code removed in a hook command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      // The advice of `removed` is for `--enable-auto-mode` only. A new global flag needs its own message.
      removed:
        'Claude Code removed "{{flag}}" in {{version}}. Auto mode is in the Shift+Tab cycle. Use "--permission-mode auto" to start in it.',
      removedFromSubcommand:
        'Claude Code removed "{{flag}}" from "claude {{subcommand}}" in {{version}}. With it, the server exits with code 1 and does not start. Remove the flag.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const command = memberOf(handler, 'command')?.value
        if (stringOf(handler, 'type') !== 'command' || command?.kind !== 'string') {
          continue
        }
        const args = memberOf(handler, 'args')?.value
        if (args?.kind === 'array') {
          // Exec form: `command` is the executable, and each item of `args` is one argument.
          const values = args.items.map((item) => (item.kind === 'string' ? item.value : undefined))
          for (const [at, item] of args.items.entries()) {
            const removed = isClaude(command.value) ? removedFlagAt(values, at) : undefined
            if (removed !== undefined) {
              context.report({ loc: item.loc, ...reportOf(removed) })
            }
          }
        } else {
          // Shell form: one report at the string for each removed flag that a command passes.
          const found = new Set(
            claudeArguments(command.value).flatMap((words) =>
              words.flatMap((_, at) => removedFlagAt(words, at) ?? []),
            ),
          )
          for (const removed of found) {
            context.report({ loc: command.loc, ...reportOf(removed) })
          }
        }
      }
    })
  },
}

export const target = { name, ...HOOKS_TARGET }

export default rule
