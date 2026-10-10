// A path placeholder in the `command` of a shell-form hook is a text substitution, and the shell
// then reads the path (docs/rules/hooks-placeholder-quoted.md). A path that holds a space splits into
// words unless the reference sits inside quotes. `claude plugin validate` reports an unquoted
// placeholder in the `hooks/hooks.json` of a plugin, so the rule reads every other file. A hook in exec
// form has no shell, and a PowerShell hook has its own quote rules (`hooks-powershell-placeholder`).
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
import { commandsOf } from '../shell-words.ts'

const name = 'hooks-placeholder-quoted' as const

const VARIABLES = PATH_VARIABLES.join('|')
/** A reference to a path variable: `${NAME}`, or `$NAME` that no name character follows. */
const REFERENCE = new RegExp(`\\$\\{(?:${VARIABLES})\\}|\\$(?:${VARIABLES})(?![A-Za-z0-9_])`, 'g')

/** The first reference in `line` that sits outside quotes, or undefined. Each reference becomes two
 *  marks with a space between them. The shell splits a word at an unquoted space, so the marks of a
 *  quoted reference stay in one word, and the marks of an unquoted one do not. A line with a command
 *  substitution is not read, because quotes nest inside it. */
function unquotedReference(line: string): string | undefined {
  if (line.includes('$(') || line.includes('`')) {
    return undefined
  }
  const found: string[] = []
  const marked = line.replace(REFERENCE, (text) => {
    found.push(text)
    const mark = found.length - 1
    return `${mark} ${mark}`
  })
  const words = commandsOf(marked).flat()
  return found.find((_, mark) => words.every((word) => !word.includes(`${mark} ${mark}`)))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put the path placeholder of a shell-form hook command inside quotes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unquoted:
        'The placeholder "{{placeholder}}" is not inside quotes. A path with a space splits into words. Wrap it in double quotes, or set "args" for exec form.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      // `claude plugin validate` reports the hooks file of a plugin.
      if (source.kind === 'plugin') {
        return
      }
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
        const placeholder = unquotedReference(line.value)
        if (placeholder !== undefined) {
          context.report({ loc: line.loc, messageId: 'unquoted', data: { placeholder } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
