// In exec form, Claude Code spawns `command` with no shell, so shell syntax passes to the program as literal
// text (docs/rules/hooks-exec-form-shell-syntax.md). The rule reads two faults. An `args` item that is a shell
// operator, such as `|` or `&&`, has no meaning. A `$NAME` in `command` or in an `args` item is not expanded.
// The path placeholders, which Claude Code replaces, and the variables that `hooks-env-var-unavailable` reads
// are not faults. A glob or an operator character inside a longer item is a valid argument for many programs.
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

const name = 'hooks-exec-form-shell-syntax' as const

/** An item that is one shell operator: a pipe, a list operator or a redirect. */
const OPERATOR = /^(?:[|&;]{1,2}|\d*(?:>>?|<)(?:&\d+)?|\d*>>?\/dev\/null)$/
const PLACEHOLDER = new RegExp(`\\$\\{(?:${PATH_VARIABLES.join('|')})\\}`, 'g')
/** A variable in the style of an environment variable. A lower-case name is often a variable of a program, such as
 *  a `jq` variable. */
const VARIABLE = /\$(?:\{[A-Z_][A-Z0-9_]*\}|[A-Z_][A-Z0-9_]*)/
/** The variables that `hooks-env-var-unavailable` reports. */
const OTHER_RULE = /\$\{?(?:CLAUDE_ENV_FILE|CLAUDE_MODEL)\}?/g

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use no shell syntax in the command or args of a hook in exec form',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      operator:
        'In exec form, "{{text}}" is an argument and not a shell operator. There is no shell, so it passes to the program as literal text. Use shell form (omit "args") for a pipe, a redirect or a list.',
      variable:
        'In exec form, "{{text}}" is not expanded, because there is no shell. It passes to the program as literal text. Use shell form (omit "args") to expand it.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const executable = memberOf(handler, 'command')?.value
        const args = memberOf(handler, 'args')?.value
        if (
          stringOf(handler, 'type') !== 'command' ||
          executable?.kind !== 'string' ||
          args?.kind !== 'array'
        ) {
          continue
        }
        for (const node of [executable, ...args.items]) {
          if (node.kind !== 'string') {
            continue
          }
          const text = node.value
          const variable = VARIABLE.exec(text.replace(PLACEHOLDER, '').replace(OTHER_RULE, ''))
          if (OPERATOR.test(text)) {
            context.report({ loc: node.loc, messageId: 'operator', data: { text } })
          } else if (variable !== null) {
            context.report({ loc: node.loc, messageId: 'variable', data: { text: variable[0] } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
