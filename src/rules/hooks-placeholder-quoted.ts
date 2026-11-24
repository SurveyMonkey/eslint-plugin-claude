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
import { closingParen, commandsOf, MAX_NESTING, tickEnd } from '../shell-words.ts'

const name = 'hooks-placeholder-quoted' as const

const VARIABLES = PATH_VARIABLES.join('|')
/** A reference to a path variable: `${NAME}`, or `$NAME` that no name character follows. */
const REFERENCE = new RegExp(`\\$\\{(?:${VARIABLES})\\}|\\$(?:${VARIABLES})(?![A-Za-z0-9_])`, 'g')

/** The first reference in `line` that sits outside quotes at the level of `line`, or undefined.
 *  Each reference becomes two marks with a backslash and a space between them. Private-use
 *  characters delimit each mark, so a quoted text such as "0 0" cannot look like one.
 *
 *  Out of quotes, the reader drops the backslash. In quotes, it keeps it. A `${...}` expansion does
 *  not change this, so a reference in the value of an unquoted expansion is out of quotes too. bash
 *  splits that value at a space. A reference in a comment is in no word. A substitution in double
 *  quotes stays one word, with its text. `unquotedReference` reads that text. */
function levelReference(line: string): string | undefined {
  const found: string[] = []
  const marked = line.replace(REFERENCE, (text) => {
    found.push(text)
    const mark = found.length - 1
    return `${mark}\\ ${mark}`
  })
  const words = commandsOf(marked).flat()
  return found.find((_, mark) => words.some((word) => word.includes(`${mark} ${mark}`)))
}

/** A `case` word in the place of a command. */
const CASE = /(?:^|[;&|(\n])\s*case\s/

/** The text of each command substitution and backtick pair in `line`, at the level of `line`. A
 *  nested one is in the text of its outer one. Single quotes and comments hide a substitution.
 *  A `#` after a blank in a `${...}` expansion starts a comment here, to the next new line. That
 *  can miss a report. It gives no false report. In backticks, the shell removes a backslash before
 *  `$`, a backtick or a backslash. In double quotes, it also removes one before a double quote.
 *
 *  `closingParen` cannot tell the `)` of a `case` pattern from the `)` that ends a substitution.
 *  So the result is undefined when the text of a `$(...)` holds a `case` command. */
function substitutionsIn(line: string): string[] | undefined {
  const texts: string[] = []
  let quoted = false
  // True when the next character starts a word. The shell removes each backslash and new line
  // pair first, so a pair does not change `boundary`.
  let boundary = true
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i)
    const before: boolean = boundary
    boundary = false
    if (char === '\\') {
      i++
      boundary = before && line.charAt(i) === '\n'
    } else if (char === "'" && !quoted) {
      const end = line.indexOf("'", i + 1)
      i = end === -1 ? line.length : end
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === '$' && line.charAt(i + 1) === '(') {
      const end = closingParen(line, i + 1)
      const text = line.slice(i + 2, end)
      if (CASE.test(text)) {
        return undefined
      }
      texts.push(text)
      i = end
    } else if (char === '`') {
      const end = tickEnd(line, i)
      const escaped = quoted ? /\\([$`\\"])/g : /\\([$`\\])/g
      texts.push(line.slice(i + 1, end).replace(escaped, '$1'))
      i = end
    } else if (char === '#' && before && !quoted) {
      const end = line.indexOf('\n', i)
      i = end === -1 ? line.length : end
      boundary = true
    } else {
      // A `#` after the `(` or `)` of a subshell starts a word. The `)` of a substitution does
      // not come here, because the `$(` branch skips it.
      boundary = !quoted && /[\s;|&<>()]/.test(char)
    }
  }
  return texts
}

/** The first reference in `line` that sits outside quotes at its own level, or undefined. Bash
 *  splits the value of a reference in a command substitution, also when the substitution is in
 *  double quotes. So `levelReference` reads the line, and then the text of each substitution in
 *  it. A level that is deeper than `MAX_NESTING` gets no report. A line with a `case` command in a
 *  `$(...)` gets no report (see `substitutionsIn`). */
function unquotedReference(line: string, depth = 0): string | undefined {
  const texts = substitutionsIn(line)
  if (texts === undefined) {
    return undefined
  }
  const found = levelReference(line)
  if (found !== undefined || depth >= MAX_NESTING) {
    return found
  }
  for (const text of texts) {
    const inner = unquotedReference(text, depth + 1)
    if (inner !== undefined) {
      return inner
    }
  }
  return undefined
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

export const target = { name, ...HOOKS_TARGET }

export default rule
