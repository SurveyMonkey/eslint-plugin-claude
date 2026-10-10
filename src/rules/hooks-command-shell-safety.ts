// The hooks reference says to quote shell variables, and warns that a command hook runs with the full
// permissions of the user (docs/rules/hooks-command-shell-safety.md). The rule is a heuristic. The two
// patterns are the choice of the plugin:
// - a shell variable outside quotes;
// - `rm` with a recursive flag on a variable that is unquoted or that holds hook input.
// It reads a shell-form command, and the repository scripts that the command runs. A script of another language
// and a file that the rule cannot read inside the repository give no report (ADR 001, Decision 14).
import path from 'node:path'
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
import { placeholderFolders, scriptsRun, scriptText } from '../hooks-files.ts'
import { commandsOf, commandWordAt } from '../shell-words.ts'

const name = 'hooks-command-shell-safety' as const

/** A script that is not a shell script, by its extension. */
const OTHER_LANGUAGE = /\.(?:py|js|mjs|cjs|ts|rb|ps1|bat|cmd)$/i
const SHELL_SHEBANG = /^#!.*\b(?:ba|z|da|k)?sh\b/
const VARIABLE = /\$(?:\{#?([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*))/g
const ASSIGNMENT = /^[A-Za-z_]\w*\+?=/
/** A variable that gets a value from `jq` or `cat`, which read the hook input, or from `read`. */
const DERIVED =
  /(?:^|[\s;])([A-Za-z_]\w*)=\$\([^)\n]*\b(?:cat|jq)\b|\bread\s+(?:-\w+\s+)*([A-Za-z_]\w*)/g

/** The names of the variables outside quotes in the shell text `text`. The scan skips an assignment value, a
 *  `[[ ]]` test, a command substitution, a comment and a special parameter. */
function unquotedVariables(text: string): string[] {
  const names: string[] = []
  let quote = ''
  let test = false
  let wordStart = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)
    if (quote === "'") {
      quote = char === "'" ? '' : quote
    } else if (char === '\\') {
      i++
    } else if (quote === '"') {
      quote = char === '"' ? '' : quote
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '#' && i === wordStart) {
      i = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i)
    } else if (text.startsWith('[[', i) || text.startsWith(']]', i)) {
      test = char === '['
      i++
    } else if (char === '$' && !test && !text.startsWith('(', i + 1)) {
      const match = /^\$(?:\{#?([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*|\d|[@*]))/.exec(text.slice(i))
      if (match !== null && !ASSIGNMENT.test(text.slice(wordStart, i))) {
        names.push((match[1] ?? match[2]) as string)
        i += match[0].length - 1
      }
    } else if (/[\s;&|()]/.test(char)) {
      wordStart = i + 1
    }
  }
  return names
}

/** The variable names in `word`. */
const variablesIn = (word: string) =>
  [...word.matchAll(VARIABLE)].map((match) => (match[1] ?? match[2]) as string)

/** The variable that `rm` with a recursive flag deletes in `text`, or undefined. A variable counts when it is
 *  outside quotes or holds hook input. */
function destroyedVariable(text: string, unquoted: string[]): string | undefined {
  const derived = [...text.matchAll(DERIVED)].map((match) => (match[1] ?? match[2]) as string)
  for (const words of commandsOf(text)) {
    const at = commandWordAt(words)
    const rest = words.slice(at + 1)
    if (
      words[at] === 'rm' &&
      rest.some((word) => /^-[A-Za-z]*[rR]/.test(word) || word === '--recursive')
    ) {
      const found = rest
        .filter((word) => !word.startsWith('-'))
        .flatMap(variablesIn)
        .find((variable) => unquoted.includes(variable) || derived.includes(variable))
      if (found !== undefined) {
        return found
      }
    }
  }
  return undefined
}

/** The shell lines in `command`: the line itself, and the line after `-c` of a shell. */
function linesOf(command: string): string[] {
  return [
    command,
    ...commandsOf(command).flatMap((words) => {
      const at = commandWordAt(words)
      const flag = words.findIndex(
        (word, index) => index > at && /^-[A-Za-z]*c[A-Za-z]*$/.test(word),
      )
      return ['bash', 'sh', 'zsh'].includes(path.posix.basename(words[at] ?? '')) &&
        flag !== -1 &&
        words[flag + 1] !== undefined
        ? [words[flag + 1] as string]
        : []
    }),
  ]
}

/** The finding for the shell text `text`, or undefined. `skip` names the variables that another rule reports. */
function findingOf(
  text: string,
  skip: readonly string[],
): { messageId: 'unquoted' | 'destructive'; variable: string } | undefined {
  const unquoted = unquotedVariables(text).filter((variable) => !skip.includes(variable))
  const destroyed = destroyedVariable(text, unquoted)
  if (destroyed !== undefined) {
    return { messageId: 'destructive', variable: destroyed }
  }
  const [first] = unquoted
  return first === undefined ? undefined : { messageId: 'unquoted', variable: first }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Quote shell variables, and check the path before rm -rf, in a hook command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unquoted:
        'The {{source}} uses {{variable}} with no quotes. The shell splits the value at spaces and expands globs. Write "{{variable}}" in double quotes.',
      destructive:
        'The {{source}} runs "rm" with a recursive flag on {{variable}}, a path that comes from a variable. Check the path before it, and quote the variable.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        const args = memberOf(handler, 'args')?.value
        if (
          stringOf(handler, 'type') !== 'command' ||
          line?.kind !== 'string' ||
          stringOf(handler, 'shell') === 'powershell'
        ) {
          continue
        }
        const argv =
          args?.kind === 'array'
            ? args.items.flatMap((item) => (item.kind === 'string' ? [item.value] : []))
            : undefined
        // The path placeholders are for `hooks-placeholder-quoted`. Exec form has no shell to read.
        const found = [
          ...(argv === undefined
            ? linesOf(line.value).map((text) => ({
                source: 'command',
                found: findingOf(text, PATH_VARIABLES),
              }))
            : []),
          ...scriptsRun(line.value, argv, folders, true).map((script) => {
            const text = OTHER_LANGUAGE.test(script.file) ? undefined : scriptText(script)
            return {
              source: `script "${path.basename(script.file)}"`,
              found:
                text === undefined ||
                (text.startsWith('#!') && !SHELL_SHEBANG.test(text)) ||
                text.includes('\0')
                  ? undefined
                  : findingOf(text, []),
            }
          }),
        ].find((item) => item.found !== undefined)
        if (found?.found !== undefined) {
          context.report({
            loc: line.loc,
            messageId: found.found.messageId,
            data: { source: found.source, variable: `$${found.found.variable}` },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
