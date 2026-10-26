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

/** The index of the quote that closes the one at `start` in `text`, or the length of `text`. A double quote
 *  holds command substitutions, which have quotes and parentheses of their own. */
function quoteEnd(text: string, start: number): number {
  const quote = text.charAt(start)
  for (let i = start + 1; i < text.length; i++) {
    const char = text.charAt(i)
    if (char === quote) {
      return i
    }
    if (quote === '"' && char === '\\') {
      i++
    } else if (quote === '"' && char === '$' && text.startsWith('(', i + 1)) {
      i = closingParen(text, i + 1)
    }
  }
  return text.length
}

/** The index of the parenthesis that closes the one at `open` in `text`, or the length of `text`. A
 *  parenthesis in quotes, after a backslash or in a comment does not count. In a `${...}` expansion,
 *  only a parenthesis that starts a command or process substitution counts. Each parenthesis level
 *  and each backtick substitution has its own count of open `${` expansions, as in
 *  `src/shell-words.ts`. */
function closingParen(text: string, open: number): number {
  let depth = 0
  // The open `${` expansions at this level, the counts of the outer levels, and if a backtick
  // substitution is open.
  let braces = 0
  const outer: number[] = []
  let tick = false
  // True when the next character starts a word. The shell removes each backslash and new line
  // pair first, so a pair does not change `boundary`. A backslash in a comment joins no lines.
  let boundary = true
  for (let i = open; i < text.length; i++) {
    const char = text.charAt(i)
    const before: boolean = boundary
    boundary = false
    if (char === "'" || char === '"') {
      i = quoteEnd(text, i)
    } else if (char === '\\') {
      i++
      boundary = before && text.charAt(i) === '\n'
    } else if (
      char === '$' &&
      (/^\{[^\s|]/.test(text.slice(i + 1, i + 3)) || text.charAt(i + 1) === '$')
    ) {
      // `$$` is a parameter, so a `{` after it opens no expansion. A blank or a `|` after `${`
      // opens a bash 5.3 substitution of commands, not an expansion.
      braces += text.charAt(i + 1) === '{' ? 1 : 0
      i++
    } else if (char === '}' && braces > 0) {
      braces--
    } else if (char === '`') {
      // A `#` after a backtick that starts a substitution starts a word. After a backtick that
      // ends one, it stays in the word, as in `src/shell-words.ts`.
      tick = !tick
      boundary = tick
      if (tick) {
        outer.push(braces)
        braces = 0
      } else {
        braces = outer.pop() as number
      }
    } else if (char === '#' && braces === 0 && before) {
      // A `#` that starts a word, or that follows a redirect operator, starts a comment. A quote
      // in it is plain text. The comment ends before the next new line. In a backtick
      // substitution, it also ends before the backtick that ends the substitution.
      const length = text.slice(i).search(tick ? /[\n`]/ : /\n/)
      i = length === -1 ? text.length : i + length - 1
    } else if (char === '(' && (braces === 0 || /[$<>]/.test(text.charAt(i - 1)))) {
      // In an expansion, a parenthesis is plain text, unless it starts a command or process
      // substitution.
      depth++
      outer.push(braces)
      braces = 0
      boundary = true
    } else if (char === ')' && braces === 0) {
      // A `#` after a `)` starts no comment, as in `src/shell-words.ts`.
      if (--depth === 0) {
        return i
      }
      braces = outer.pop() as number
    } else {
      boundary = /[\s;|&<>]/.test(char)
    }
  }
  return text.length
}

/** The index of the backtick that closes the one at `start` in `text`, or the length of `text`. A
 *  backslash escapes the next character, as in `closingTick` in `src/shell-words.ts`. */
function tickEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text.charAt(i) === '\\') {
      i++
    } else if (text.charAt(i) === '`') {
      return i
    }
  }
  return text.length
}

/** The names of the variables outside quotes in the shell text `text`. The scan skips an assignment value, a
 *  `[[ ]]` test, a comment and a special parameter. It scans the inside of a command substitution, and of a
 *  backtick pair, on its own, as `scanCommands` in `src/shell-words.ts` does. A quote in it starts a new quote
 *  level, and a comment in it ends at its end. A `#` starts a comment only at the start of a word, and
 *  not in a `${...}` expansion. As in `closingParen`, each parenthesis level has its own count of open
 *  `${` expansions. */
function unquotedVariables(text: string): string[] {
  const names: string[] = []
  let quote = ''
  let test = false
  let wordStart = 0
  // The open `${` expansions at this level, and the counts of the outer levels.
  let braces = 0
  const outer: number[] = []
  // True when the next character starts a word. The shell removes each backslash and new line
  // pair first, so a pair does not change `boundary`.
  let boundary = true
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i)
    const before: boolean = boundary
    boundary = false
    // True when no `${...}` expansion holds the scan, also through a process substitution in one.
    // In an expansion, a blank ends no word, and `[[` starts no test.
    const bare = braces === 0 && outer.every((count) => count === 0)
    if (quote === "'") {
      quote = char === "'" ? '' : quote
    } else if (char === '$' && text.startsWith('(', i + 1)) {
      const end = closingParen(text, i + 1)
      names.push(...unquotedVariables(text.slice(i + 2, end)))
      i = end
    } else if (char === '`') {
      const end = tickEnd(text, i)
      // In backticks, the shell removes a backslash before `$`, a backtick or a backslash, and in
      // double quotes also before a double quote.
      const escaped = quote === '"' ? /\\([$`\\"])/g : /\\([$`\\])/g
      names.push(...unquotedVariables(text.slice(i + 1, end).replace(escaped, '$1')))
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
      const match = test
        ? null
        : /^\$(?:\{#?([A-Za-z_]\w*)|([A-Za-z_]\w*|\d|[@*]))/.exec(text.slice(i))
      if (match !== null && !ASSIGNMENT.test(text.slice(wordStart, i))) {
        names.push((match[1] ?? match[2]) as string)
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
        braces = 0
        boundary = true
      } else if (char === ')' && braces === 0) {
        braces = outer.pop() ?? 0
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
