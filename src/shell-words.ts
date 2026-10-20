// A small reader of a shell line, for the rules that look at the command of a hook. It gives the
// simple commands of the line and their words. It is not a full shell parser: it finds the words of
// a line that a person wrote by hand. It does not expand a variable or a glob.
import path from 'node:path'

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
/** A word that runs the next word as a command. */
const WRAPPERS = ['exec', 'env', 'command', 'nohup']

/** True when `word` is a `NAME=value` word, which sets a variable for the command. */
export const isAssignment = (word: string) => ASSIGNMENT.test(word)

/** How deep a quote and a substitution may nest before the reader gives up and takes the rest of the line. */
const MAX_NESTING = 100

/** The index of the `)` that closes the `(` at `open` in `line`, or the last index. A quote, a backslash, a
 *  backtick and a nested substitution inside keep their own level. A comment inside ends at the next
 *  new line. A `#` in a `${...}` expansion starts no comment. */
function closingParen(line: string, open: number, nesting = 0): number {
  if (nesting > MAX_NESTING) {
    return line.length - 1
  }
  let depth = 0
  // The open `${` expansions.
  let braces = 0
  // True when the next character starts a word. The shell removes each backslash and new line
  // pair first, so a pair keeps the value. A backslash in a comment joins no lines.
  let boundary = true
  for (let i = open; i < line.length; i++) {
    const char = line.charAt(i)
    const before: boolean = boundary
    boundary = false
    if (char === "'") {
      const end = line.indexOf("'", i + 1)
      if (end === -1) {
        return line.length - 1
      }
      i = end
    } else if (char === '"') {
      i = closingQuote(line, i, nesting + 1)
    } else if (char === '`') {
      i = closingTick(line, i)
    } else if (char === '\\') {
      i++
      boundary = before && line.charAt(i) === '\n'
    } else if (char === '$' && (line.charAt(i + 1) === '{' || line.charAt(i + 1) === '$')) {
      // `$$` is a parameter, so a `{` after it opens no expansion.
      braces += line.charAt(i + 1) === '{' ? 1 : 0
      i++
    } else if (char === '}' && braces > 0) {
      braces--
    } else if (char === '#' && braces === 0 && before) {
      // A `#` that starts a word, or that follows a redirect operator, starts a comment, to the
      // next new line. A quote or a parenthesis in it is plain text.
      const end = line.indexOf('\n', i)
      i = end === -1 ? line.length : end
      boundary = true
    } else if (char === '(') {
      depth++
      boundary = true
    } else if (char === ')' && --depth === 0) {
      return i
    } else {
      // A `#` after a `)` starts no comment. The reader does not know if that `)` closes a
      // substitution. A word can go on after a substitution.
      boundary = /[\s;|&<>]/.test(char)
    }
  }
  return line.length - 1
}

/** The index of the double quote that closes the one at `start` in `line`, or the last index. A command
 *  substitution or a backtick pair inside holds quotes of its own. */
function closingQuote(line: string, start: number, nesting = 0): number {
  for (let i = start + 1; i < line.length; i++) {
    const char = line.charAt(i)
    if (char === '\\') {
      i++
    } else if (char === '$' && line.startsWith('(', i + 1)) {
      i = closingParen(line, i + 1, nesting + 1)
    } else if (char === '`') {
      i = closingTick(line, i)
    } else if (char === '"') {
      return i
    }
  }
  return line.length - 1
}

/** The index of the backtick that closes the one at `start` in `line`, or the last index. */
function closingTick(line: string, start: number): number {
  for (let i = start + 1; i < line.length; i++) {
    if (line.charAt(i) === '\\') {
      i++
    } else if (line.charAt(i) === '`') {
      return i
    }
  }
  return line.length - 1
}

/** A simple command: its words, and whether its standard output is the output of the line. It is not when a
 *  pipe takes it, or when a command substitution captures it. */
export interface Command {
  words: string[]
  stdout: boolean
  /** True when a lone `&` ended the command before this one. */
  afterAmp?: true
}

/** The simple commands of a shell line. A command ends at `;`, `&`, `|`, a parenthesis, a backtick or a new line
 *  that no backslash joins. A `#` that starts a word, or that follows a redirect operator, starts a
 *  comment. The reader skips it to the next new line, or in backticks to the closing backtick. A
 *  backslash in a comment joins no lines. A quote or a backslash joins characters into one word. A
 *  quote is not part of the word. A command substitution in double quotes is part of the word, and
 *  holds quotes of its own. A `${...}` expansion is part of the word, with its spaces, operators and
 *  parentheses. A command substitution in it gives its own commands. */
export function scanCommands(line: string): Command[] {
  const commands: Command[] = []
  let words: string[] = []
  let word = ''
  let open = false
  let quote = ''
  // For each open parenthesis: true when `$` comes before it, which makes it a command substitution.
  const levels: boolean[] = []
  let substitutions = 0
  let amp = false
  let ticks = false
  // True when the character before is the end of a command substitution. The word goes on after it.
  let closed = false
  // True when the character before is a redirect operator, `<` or `>`.
  let redirect = false
  // The open `${` expansions. A command substitution or a backtick pair starts with none. The
  // stack keeps the count of the level outside each one.
  let braces = 0
  const outerBraces: number[] = []
  const enter = () => {
    outerBraces.push(braces)
    braces = 0
  }
  const leave = () => {
    braces = outerBraces.pop() ?? 0
  }
  const endWord = () => {
    if (open) {
      words.push(word)
      word = ''
      open = false
    }
  }
  const endCommand = (piped = false, lone = false) => {
    endWord()
    if (words.length > 0) {
      commands.push({
        words,
        stdout: !piped && !ticks && substitutions === 0,
        ...(amp ? { afterAmp: true as const } : {}),
      })
      words = []
    }
    amp = lone
  }
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i)
    const glued: boolean = closed
    const redirected: boolean = redirect
    closed = false
    redirect = false
    if (quote === "'" && char !== "'") {
      word += char
    } else if (char === '\\' && quote !== "'") {
      if (line.startsWith('\n', i + 1) || line.startsWith('\r\n', i + 1)) {
        // A backslash before a new line joins the two lines, and adds no character to the word.
        // The next character keeps the state of the character before the backslash.
        i += line.charAt(i + 1) === '\r' ? 2 : 1
        closed = glued
        redirect = redirected
      } else {
        // The next character is part of the word. A backslash at the end of the string adds no character.
        const next = line.charAt(++i)
        // In double quotes the shell keeps the backslash before any character but these four.
        word += quote === '"' && !'$`"\\'.includes(next) ? `\\${next}` : next
        open = true
      }
    } else if (quote !== '' && char === quote) {
      quote = ''
    } else if (quote === '"' && char === '$' && line.startsWith('(', i + 1)) {
      const end = closingParen(line, i + 1)
      word += line.slice(i, end + 1)
      i = end
    } else if (quote === '"' && char === '`') {
      const end = closingTick(line, i)
      word += line.slice(i, end + 1)
      i = end
    } else if (quote !== '') {
      word += char
    } else if (char === "'" || char === '"') {
      quote = char
      open = true
    } else if (char === '$' && (line.charAt(i + 1) === '{' || line.charAt(i + 1) === '$')) {
      // `$$` is a parameter, so a `{` after it opens no expansion.
      braces += line.charAt(i + 1) === '{' ? 1 : 0
      word += line.slice(i, i + 2)
      open = true
      i++
    } else if (
      braces > 0 &&
      (char === '}' || /[\s;|&)]/.test(char) || (char === '(' && line.charAt(i - 1) !== '$'))
    ) {
      // A parenthesis in the expansion is plain text, unless it starts a command substitution.
      braces -= char === '}' ? 1 : 0
      word += char
      open = true
    } else if (char === '#' && (redirected || (!open && !glued))) {
      // A comment ends before the next new line. In a backtick substitution it also ends before
      // the closing backtick. Each character in it, such as a quote, is plain text.
      const length = line.slice(i).search(ticks ? /[\n`]/ : /\n/)
      i = length === -1 ? line.length : i + length - 1
    } else if (char === '(') {
      endCommand()
      levels.push(line.charAt(i - 1) === '$')
      substitutions += levels[levels.length - 1] ? 1 : 0
      enter()
    } else if (char === ')') {
      endCommand()
      closed = levels.pop() === true
      substitutions -= closed ? 1 : 0
      leave()
    } else if (char === '`') {
      endCommand()
      ticks = !ticks
      closed = !ticks
      if (ticks) {
        enter()
      } else {
        leave()
      }
    } else if (char === '|') {
      // `||` is a list operator, and `|` or `|&` is a pipe. The second `|` of `||` ends no command.
      endCommand(line.charAt(i + 1) !== '|')
    } else if (char === '&') {
      endCommand(false, line.charAt(i - 1) !== '&' && line.charAt(i + 1) !== '&')
    } else if (/[;\n]/.test(char)) {
      endCommand()
    } else if (/\s/.test(char)) {
      endWord()
    } else {
      word += char
      open = true
      redirect = braces === 0 && (char === '<' || char === '>')
    }
  }
  endCommand()
  return commands
}

/** The simple commands of a shell line, each as its words. */
export const commandsOf = (line: string): string[][] => scanCommands(line).map(({ words }) => words)

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

/** Where the simple command `commands[index]` sends its standard output. A pipe or a command substitution
 *  takes it, which gives `other`. A redirect of file descriptor 1
 *  moves it: to stderr for `>&2` and `>/dev/stderr`, and to a file for any other target. The scanner ends a
 *  command at `&`, so the `2` of `>&2` is the first word of the next command. A redirect of another descriptor,
 *  such as `2>/dev/null`, leaves standard output where it is. */
export function sinkOf(commands: Command[], index: number): Sink {
  const { words, stdout } = commands[index] as Command
  for (const [at, word] of words.entries()) {
    const match = REDIRECT.exec(word)
    if (match === null || (match[1] !== '' && match[1] !== '1')) {
      continue
    }
    const target = match[2] === '' ? words[at + 1] : match[2]
    if (target !== undefined) {
      return target === '/dev/stderr' ? 'stderr' : 'other'
    }
    const next = commands[index + 1]?.words[0]
    if (next !== '1') {
      return next === '2' ? 'stderr' : 'other'
    }
  }
  // The scanner ends the command of `&>file` at the `&`. The next command then starts with the redirect.
  const following = commands[index + 1]
  if (following?.afterAmp && following.words[0]?.startsWith('>')) {
    return 'other'
  }
  return stdout ? 'stdout' : 'other'
}

/** What an `echo` or `printf` command prints to standard output. `json` is the object of an argument that is a
 *  JSON object. `text` is the arguments, joined by a space. */
export interface Printed {
  json: Record<string, unknown> | undefined
  text: string
}

const PRINTERS = ['echo', 'printf']

/** The words that start a branch of a shell block. They come before the command word. */
const BLOCK_WORDS = ['then', 'else', 'do', '{', '!']

/** The index of the command word in the words of a simple command, like `commandWordAt`, but a word that
 *  starts a branch of a shell block (`then`, `else`, `do`, `{`, `!`) comes before it too. */
export function statementAt(words: string[]): number {
  let at = 0
  for (;;) {
    at += commandWordAt(words.slice(at))
    if (!BLOCK_WORDS.includes(words[at] as string)) {
      return at
    }
    at++
  }
}

/** The name of the command of the simple command `words`, without its path. */
const nameOf = (words: string[]) => path.posix.basename(words[statementAt(words)] ?? '')

/** True when the command word of the simple command `words` is `echo` or `printf`. */
export const isPrinter = (words: string[]) => PRINTERS.includes(nameOf(words))

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

/** `text` without the `\n` pairs at its end, which a `printf` format prints as new lines. */
function withoutTrailingNewlines(text: string): string {
  let end = text.length
  while (text.startsWith('\\n', end - 2) && end >= 2) {
    end -= 2
  }
  return text.slice(0, end)
}

/** What the `echo` and `printf` commands of `commands` print to standard output. A command that prints a JSON
 *  object gives one item for each object. Any other gives one item with `json` undefined. A command that
 *  sends its output to stderr or a file prints nothing here. */
export function printedBy(commands: Command[]): Printed[] {
  return commands.flatMap(({ words }, index): Printed[] => {
    if (!isPrinter(words) || sinkOf(commands, index) !== 'stdout') {
      return []
    }
    const args = printedArguments(words.slice(statementAt(words) + 1))
    // `printf` turns a `\n` of its format into a new line. `echo` prints the two characters.
    const printf = nameOf(words) === 'printf'
    const objects = args.flatMap((arg) => {
      const json = objectIn(printf ? withoutTrailingNewlines(arg) : arg)
      return json === undefined ? [] : [{ json, text: arg }]
    })
    return objects.length > 0 ? objects : [{ json: undefined, text: args.join(' ') }]
  })
}
