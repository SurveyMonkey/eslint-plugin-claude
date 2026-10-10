// In exec form (the handler sets `args`), `command` is the executable name or path only. Claude Code
// spawns it with no shell. A bare name that holds whitespace, such as `node script.js`, names no
// executable, and the spawn fails. A path is one executable even with spaces in it
// (docs/rules/hooks-exec-form-command-spaces.md).
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'

const name = 'hooks-exec-form-command-spaces' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set only the executable in the command of a hook in exec form',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      spaces:
        'In exec form, "command" is the executable only, and "{{command}}" holds whitespace. The spawn fails. Move the extra words into "args".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const executable = memberOf(handler, 'command')?.value
        if (
          stringOf(handler, 'type') === 'command' &&
          executable?.kind === 'string' &&
          memberOf(handler, 'args')?.value.kind === 'array' &&
          !/[\\/]/.test(executable.value) &&
          /\s/.test(executable.value)
        ) {
          context.report({
            loc: executable.loc,
            messageId: 'spaces',
            data: { command: executable.value },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
