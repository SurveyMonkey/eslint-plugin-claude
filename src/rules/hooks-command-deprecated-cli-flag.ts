// A hook command that runs `claude` with a flag that Claude Code deprecated
// (docs/rules/hooks-command-deprecated-cli-flag.md). The CLI reference, "CLI flags", calls `--remote`
// a deprecated alias for `--cloud`. The rule reads a command like `hooks-command-removed-cli-flag` does.
// It reads exec form (`args`) and shell form, and it splits a shell line with `claudeArguments`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'
import { claudeArguments, isClaude } from '../shell-words.ts'

const name = 'hooks-command-deprecated-cli-flag' as const

const FLAG = '--remote'

const isFlag = (word: string) => word === FLAG || word.startsWith(`${FLAG}=`)

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not pass a deprecated CLI flag in a hook command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      remote: 'The CLI reference calls "--remote" a deprecated alias for "--cloud". Use "--cloud".',
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
              context.report({ loc: item.loc, messageId: 'remote' })
            }
          }
        } else if (claudeArguments(command.value).some((words) => words.some(isFlag))) {
          context.report({ loc: command.loc, messageId: 'remote' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
