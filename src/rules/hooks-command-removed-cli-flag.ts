// A hook command that runs `claude` with a flag that Claude Code removed
// (docs/rules/hooks-command-removed-cli-flag.md). `--enable-auto-mode` is gone since v2.1.111, and
// `--permission-mode auto` replaces it (the CLI reference, "CLI flags"). A command in exec form
// (with `args`) is an executable and its arguments. A command in shell form is a shell line, so the
// rule splits it into the simple commands and their words, and checks each command that runs
// `claude`.
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'
import { commandsOf, commandWordAt } from '../shell-words.ts'

const name = 'hooks-command-removed-cli-flag' as const

const FLAG = '--enable-auto-mode'

/** True when `word` runs Claude Code: `claude`, or a path that ends in it. */
const isClaude = (word: string) => path.posix.basename(word).replace(/\.exe$/i, '') === 'claude'

const isFlag = (word: string) => word === FLAG || word.startsWith(`${FLAG}=`)

/** True when the simple command `words` runs `claude` and passes the flag. */
function passesFlag(words: string[]): boolean {
  const at = commandWordAt(words)
  return at < words.length && isClaude(words[at] as string) && words.slice(at + 1).some(isFlag)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not pass a CLI flag that Claude Code removed in a hook command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      removed: `Claude Code removed "${FLAG}" in v2.1.111. Auto mode is in the Shift+Tab cycle. Use "--permission-mode auto" to start in it.`,
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
          for (const item of args.items) {
            if (isClaude(command.value) && item.kind === 'string' && isFlag(item.value)) {
              context.report({ loc: item.loc, messageId: 'removed' })
            }
          }
        } else if (commandsOf(command.value).some(passesFlag)) {
          context.report({ loc: command.loc, messageId: 'removed' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
