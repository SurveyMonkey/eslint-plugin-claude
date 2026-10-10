// A hook that references a path placeholder runs better in exec form (docs/rules/hooks-prefer-exec-form.md).
// With `args`, each element is one argument with no quotes, and a path with a space needs no care. The
// hooks reference also says to omit `args` when the hook needs shell features, so the rule reads a
// line with none: no pipe, redirect, list, group, glob, other variable or assignment. A PowerShell
// hook is out of scope, because exec form there needs the shell as the executable.
// `hooks-placeholder-quoted` reports a placeholder outside quotes in shell form.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  PATH_VARIABLES,
  stringOf,
} from '../hooks-config.ts'
import { isAssignment } from '../shell-words.ts'

const name = 'hooks-prefer-exec-form' as const

const PLACEHOLDER = new RegExp(`\\$\\{(?:${PATH_VARIABLES.join('|')})\\}`, 'g')
/** A character of a shell feature. A `$` left after the placeholders is another variable. */
const SHELL_FEATURE = /[<>&|;()`*?$\n]/

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use exec form for a hook that references a path placeholder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      exec: 'This command references a path placeholder in shell form. Set "args" for exec form: "command" is the executable, and each "args" item is one argument with no quoting.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        if (
          stringOf(handler, 'type') !== 'command' ||
          line?.kind !== 'string' ||
          stringOf(handler, 'shell') === 'powershell' ||
          memberOf(handler, 'args')?.value.kind === 'array'
        ) {
          continue
        }
        const rest = line.value.replace(PLACEHOLDER, '')
        if (
          rest !== line.value &&
          !SHELL_FEATURE.test(rest) &&
          !isAssignment(rest.trimStart().split(/\s/)[0] as string)
        ) {
          context.report({ loc: line.loc, messageId: 'exec' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
