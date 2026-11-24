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
  argsOf,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  PATH_VARIABLES,
  stringOf,
} from '../hooks-config.ts'
import { placeholderFolders, scriptsRun, scriptText } from '../hooks-files.ts'
import {
  closingParen,
  commandsOf,
  commandWordAt,
  MAX_NESTING,
  nestsTooDeep,
  tickEnd,
} from '../shell-words.ts'

const name = 'hooks-command-shell-safety' as const

/** A script that is not a shell script, by its extension. */
const OTHER_LANGUAGE = /\.(?:py|js|mjs|cjs|ts|rb|ps1|bat|cmd)$/i
const SHELL_SHEBANG = /^#!.*\b(?:ba|z|da|k)?sh\b/
/** A variable or a positional or special parameter, as the scan of `unquotedVariables` reads one. */
const PARAMETER = /\$(?:\{#?([A-Za-z_]\w*)|\{(\d+|[@*])\}|([A-Za-z_]\w*|\d|[@*]))/g
/** `PARAMETER` at one index: a sticky copy, so the scan needs no slice of the text. */
const PARAMETER_AT = new RegExp(PARAMETER.source, 'y')
const VARIABLE = /\$(?:\{#?([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*))/g
const ASSIGNMENT = /^[A-Za-z_]\w*\+?=/
/** A variable that gets a value from `jq` or `cat`, which read the hook input, or from `read`. */
const DERIVED =
  /(?:^|[\s;])([A-Za-z_]\w*)=\$\([^)\n]*\b(?:cat|jq)\b|\bread\s+(?:-\w+\s+)*([A-Za-z_]\w*)/g

/** The name of each variable and parameter in `text`, also one in quotes. */
const parametersIn = (text: string) =>
  [...text.matchAll(PARAMETER)].map((match) => (match[1] ?? match[2] ?? match[3]) as string)

/** Adds each name of `from` to the end of `into`. A spread puts each name in one argument of one
 *  call, and more than about 100,000 arguments can throw a RangeError. */
function append(into: string[], from: readonly string[]): void {
  for (const item of from) {
    into.push(item)
  }
}

/** The names of the variables outside quotes in the shell text `text`. The scan skips an assignment value, a
 *  `[[ ]]` test, a comment and a special parameter. It scans the inside of a substitution or a
 *  backtick pair on its own, with a new quote level. In a backtick pair, a comment ends at the
 *  closing backtick. A `#` starts a comment only at the start of a word, and not in a
 *  `${...}` expansion. As in `closingParen`, each parenthesis level has its own count of open `${`
 *  expansions. `nesting` is the number of substitutions and backtick pairs that hold `text`.
 *
 *  The scan stops and fails closed in two cases. Then each variable and parameter in the rest of
 *  the text counts, also one in quotes:
 *  - `closingParen` can stop at its depth limit (`nestsTooDeep`). That limit counts only the
 *    levels in double quotes. So a chain of `$(` with no quotes does not get to it.
 *  - A substitution or a backtick pair is deeper than `MAX_NESTING`. The scan reads each level
 *    with one more call, so this limit keeps the call stack small (#960). */
function unquotedVariables(text: string, nesting = 0): string[] {
  const names: string[] = []
  let quote = ''
  let test = false
  let wordStart = 0
  // The open `${` expansions at this level, and the counts of the outer levels.
  let braces = 0
  const outer: number[] = []
  // The number of outer levels with an open expansion. `bare` reads it in constant time.
  let open = 0
  // True when the next character starts a word. The shell removes each backslash and new line
  // pair first, so a pair does not change `boundary`.
  let boundary = true
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)
    const before: boolean = boundary
    boundary = false
    // True when no `${...}` expansion holds the scan, also through a process substitution in one.
    // In an expansion, a blank ends no word, and `[[` starts no test.
    const bare = braces === 0 && open === 0
    if (quote === "'") {
      quote = char === "'" ? '' : quote
    } else if (char === '$' && text.startsWith('(', i + 1)) {
      const end = closingParen(text, i + 1)
      if (nesting >= MAX_NESTING || (end === text.length && nestsTooDeep(text, i + 1))) {
        // The scan cannot find the quotes past a limit. bash reads the deeper levels. So each
        // variable and parameter in the rest counts as out of quotes, also one in quotes.
        append(names, parametersIn(text.slice(i + 2)))
        break
      }
      append(names, unquotedVariables(text.slice(i + 2, end), nesting + 1))
      i = end
    } else if (char === '`') {
      if (nesting >= MAX_NESTING) {
        append(names, parametersIn(text.slice(i + 1)))
        break
      }
      const end = tickEnd(text, i)
      // In backticks, the shell removes a backslash before `$`, a backtick or a backslash. When
      // the pair is in double quotes, it also removes one before a double quote.
      const escaped = quote === '"' ? /\\([$`\\"])/g : /\\([$`\\])/g
      const inner = text.slice(i + 1, end).replace(escaped, '$1')
      append(names, unquotedVariables(inner, nesting + 1))
      i = end
    } else if (char === '\\') {
      i++
      boundary = before && text.charAt(i) === '\n'
    } else if (quote === '"') {
      quote = char === '"' ? '' : quote
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '#' && before && braces === 0) {
      // The comment ends before the next new line, which the next pass reads.
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end - 1
    } else if (char === '}' && braces > 0) {
      braces--
    } else if (bare && (text.startsWith('[[', i) || text.startsWith(']]', i))) {
      test = char === '['
      i++
    } else if (char === '$' && text.charAt(i + 1) === '$') {
      // `$$` is a parameter, so a `{` after it opens no expansion.
      i++
    } else if (char === '$') {
      PARAMETER_AT.lastIndex = i
      const match = test ? null : PARAMETER_AT.exec(text)
      if (match !== null && !ASSIGNMENT.test(text.slice(wordStart, i))) {
        names.push((match[1] ?? match[2] ?? match[3]) as string)
      }
      if (/^\{[^\s|]/.test(text.slice(i + 1, i + 3))) {
        // The scan reads the expansion one character at a time, so a quote in it is a quote. A
        // blank or a `|` after `${` opens a bash 5.3 substitution of commands, not an expansion.
        braces++
        i++
      }
    } else {
      boundary = /[\s;|&<>]/.test(char)
      if (bare && /[\s;&|()]/.test(char)) {
        wordStart = i + 1
      }
      if (char === '(' && (braces === 0 || /[<>]/.test(text.charAt(i - 1)))) {
        // In an expansion, a parenthesis is plain text, unless it starts a process substitution.
        outer.push(braces)
        open += braces === 0 ? 0 : 1
        braces = 0
        boundary = true
      } else if (char === ')' && braces === 0) {
        braces = outer.pop() ?? 0
        open -= braces === 0 ? 0 : 1
      }
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
      const line = flag === -1 ? undefined : words[flag + 1]
      return line !== undefined &&
        ['bash', 'sh', 'zsh'].includes(path.posix.basename(words[at] as string))
        ? [line]
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
        const argv = argsOf(handler)
        // The docs say `shell` is ignored when `args` is set.
        if (
          stringOf(handler, 'type') !== 'command' ||
          line?.kind !== 'string' ||
          (stringOf(handler, 'shell') === 'powershell' && argv === undefined)
        ) {
          continue
        }
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

export const target = { name, ...HOOKS_TARGET }

export default rule
