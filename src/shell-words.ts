// A small reader of a shell line, for the rules that look at the command of a hook. It gives the
// simple commands of the line and their words. It is not a full shell parser: it finds the words of
// a line that a person wrote by hand. It does not expand a variable or a glob.
import path from 'node:path'

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
/** A word that runs the next word as a command. */
const WRAPPERS = ['exec', 'env', 'command', 'nohup']

/** True when `word` is a `NAME=value` word, which sets a variable for the command. */
export const isAssignment = (word: string) => ASSIGNMENT.test(word)

/** The simple commands of a shell line, each as its words. A command ends at `;`, `&`, `|`, a
 *  parenthesis, a backtick or a new line that no backslash joins. A quote or a backslash joins
 *  characters into one word. A quote is not part of the word. */
export function commandsOf(line: string): string[][] {
  const commands: string[][] = []
  let words: string[] = []
  let word = ''
  let open = false
  let quote = ''
  const endWord = () => {
    if (open) {
      words.push(word)
      word = ''
      open = false
    }
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) {
      commands.push(words)
      words = []
    }
  }
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i)
    if (quote === "'" && char !== "'") {
      word += char
    } else if (char === '\\' && quote !== "'") {
      if (line.startsWith('\n', i + 1) || line.startsWith('\r\n', i + 1)) {
        // A backslash before a new line joins the two lines, and adds no character to the word.
        i += line.charAt(i + 1) === '\r' ? 2 : 1
      } else {
        // The next character is part of the word. A backslash at the end of the string adds no character.
        word += line.charAt(++i)
        open = true
      }
    } else if (quote !== '' && char === quote) {
      quote = ''
    } else if (quote !== '') {
      word += char
    } else if (char === "'" || char === '"') {
      quote = char
      open = true
    } else if (/[;&|()`\n]/.test(char)) {
      endCommand()
    } else if (/\s/.test(char)) {
      endWord()
    } else {
      word += char
      open = true
    }
  }
  endCommand()
  return commands
}

/** The index of the command word in the words of a simple command. A variable assignment and a
 *  wrapper such as `exec` come before it. The index is the length of `words` when no word is left. */
export function commandWordAt(words: string[]): number {
  let at = 0
  while (
    at < words.length &&
    (isAssignment(words[at] as string) || WRAPPERS.includes(words[at] as string))
  ) {
    at++
  }
  return at
}

/** True when `word` runs Claude Code: `claude`, or a path that ends in it, with an optional `.exe`. */
export const isClaude = (word: string) =>
  path.posix.basename(word).replace(/\.exe$/i, '') === 'claude'

/** The arguments of each simple command of `line` that runs `claude`, as lists of words. */
export function claudeArguments(line: string): string[][] {
  return commandsOf(line).flatMap((words) => {
    const at = commandWordAt(words)
    return at < words.length && isClaude(words[at] as string) ? [words.slice(at + 1)] : []
  })
}

/** Where a simple command sends its standard output. */
export type Sink = 'stdout' | 'stderr' | 'other'

/** A word that holds a redirect of an output: an optional file descriptor, `>` or `>>`, and a target. */
const REDIRECT = /^(\d*)>>?(.*)$/

/** Where the simple command `commands[index]` sends its standard output. A redirect of file descriptor 1
 *  moves it: to stderr for `>&2` and `>/dev/stderr`, and to a file for any other target. The scanner ends a
 *  command at `&`, so the `2` of `>&2` is the first word of the next command. A redirect of another descriptor,
 *  such as `2>/dev/null`, leaves standard output where it is. */
export function sinkOf(commands: string[][], index: number): Sink {
  const words = commands[index] as string[]
  for (const [at, word] of words.entries()) {
    const match = REDIRECT.exec(word)
    if (match === null || (match[1] !== '' && match[1] !== '1')) {
      continue
    }
    const target = match[2] === '' ? words[at + 1] : match[2]
    if (target !== undefined) {
      return target === '/dev/stderr' ? 'stderr' : 'other'
    }
    const next = commands[index + 1]?.[0]
    if (next !== '1') {
      return next === '2' ? 'stderr' : 'other'
    }
  }
  return 'stdout'
}

/** What an `echo` or `printf` command prints to standard output. `json` is the object of an argument that is a
 *  JSON object. `text` is the arguments, joined by a space. */
export interface Printed {
  json: Record<string, unknown> | undefined
  text: string
}

const PRINTERS = ['echo', 'printf']

/** True when the command word of the simple command `words` is `echo` or `printf`. */
export const isPrinter = (words: string[]) =>
  PRINTERS.includes(path.posix.basename(words[commandWordAt(words)] ?? ''))

/** The arguments of a printer that it prints: no option such as `-n`, and no redirect with its target. */
function printedArguments(words: string[]): string[] {
  const kept: string[] = []
  for (let at = 0; at < words.length; at++) {
    const word = words[at] as string
    const redirect = REDIRECT.exec(word)
    if (redirect === null) {
      if (!/^-[neE]+$/.test(word)) {
        kept.push(word)
      }
    } else if (redirect[2] === '') {
      at++
    }
  }
  return kept
}

/** The JSON object that `word` holds, or undefined when the word is not one. */
function objectIn(word: string): Record<string, unknown> | undefined {
  if (!word.trim().startsWith('{')) {
    return undefined
  }
  try {
    return JSON.parse(word)
  } catch {
    return undefined
  }
}

/** What the `echo` and `printf` commands of `commands` print to standard output. A command that prints a JSON
 *  object gives one item for each object. Any other gives one item with `json` undefined. A command that
 *  sends its output to stderr or a file prints nothing here. */
export function printedBy(commands: string[][]): Printed[] {
  return commands.flatMap((words, index): Printed[] => {
    if (!isPrinter(words) || sinkOf(commands, index) !== 'stdout') {
      return []
    }
    const args = printedArguments(words.slice(commandWordAt(words) + 1))
    const objects = args.flatMap((arg) => {
      const json = objectIn(arg)
      return json === undefined ? [] : [{ json, text: arg }]
    })
    return objects.length > 0 ? objects : [{ json: undefined, text: args.join(' ') }]
  })
}
