// In exec form, Claude Code spawns `command` with no shell, so shell syntax passes to the program as literal
// text (docs/rules/hooks-exec-form-shell-syntax.md). The rule reads two faults. An `args` item that is a shell
// operator, such as `|` or `&&`, has no meaning. A `$NAME` in `command` or in an `args` item is not expanded.
// The path placeholders, which Claude Code replaces, and the variables that `hooks-env-var-unavailable` reads
// are not faults. A glob or an operator character inside a longer item is a valid argument for many programs.
// A `;` item of `find` ends `-exec`, and a shell that reads `-c` expands its command line, so those are no
// faults.
import path from 'node:path'
import type { Rule } from 'eslint'
import { ENV_FILE_EVENTS, HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  type HNode,
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
/** The variables that `hooks-env-var-unavailable` reports. It reports `CLAUDE_ENV_FILE` only on the events
 *  where Claude Code sets no such variable. */
const MODEL = /\$\{?CLAUDE_MODEL\}?/g
const ENV_FILE = /\$\{?CLAUDE_ENV_FILE\}?/g
const SHELLS = ['bash', 'sh', 'zsh']
/** The text of the node `node`, or the empty string. */
const before = (node: HNode | undefined) => (node?.kind === 'string' ? node.value : '')

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
      for (const { event, handler } of handlersOf(source)) {
        const executable = memberOf(handler, 'command')?.value
        const args = memberOf(handler, 'args')?.value
        if (
          stringOf(handler, 'type') !== 'command' ||
          executable?.kind !== 'string' ||
          args?.kind !== 'array'
        ) {
          continue
        }
        const program = path.posix.basename(executable.value)
        const noEnvFile = HOOK_EVENTS.includes(event) && !ENV_FILE_EVENTS.includes(event)
        const items = [executable, ...args.items]
        for (const [index, node] of items.entries()) {
          if (node.kind !== 'string') {
            continue
          }
          const text = node.value
          const shellLine =
            SHELLS.includes(program) && /^-[A-Za-z]*c$/.test(before(items[index - 1]))
          const stripped = text.replace(PLACEHOLDER, '').replace(MODEL, '')
          const variable = shellLine
            ? null
            : VARIABLE.exec(noEnvFile ? stripped.replace(ENV_FILE, '') : stripped)
          if (OPERATOR.test(text) && !(text === ';' && program === 'find')) {
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
