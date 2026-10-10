// A small reader of a shell line, for the rules that look at the command of a hook. It gives the
// simple commands of the line and their words. It is not a full shell parser: it finds the words of
// a line that a person wrote by hand. It does not expand a variable or a glob.

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
