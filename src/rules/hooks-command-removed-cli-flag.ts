// A hook command that runs `claude` with a flag that Claude Code removed
// (docs/rules/hooks-command-removed-cli-flag.md). `--enable-auto-mode` is gone since v2.1.111, and
// `--permission-mode auto` replaces it (the CLI reference, "CLI flags"). A command in exec form
// (with `args`) is an executable and its arguments. A command in shell form is a shell line, so the
// rule splits it into the simple commands and their words, and checks each command that runs
// `claude`.
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'

const name = 'hooks-command-removed-cli-flag' as const

const FLAG = '--enable-auto-mode'

/** A leading `NAME=value` word, which sets a variable for the command. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
/** A word that runs the next word as a command. */
const WRAPPERS = ['exec', 'env', 'command', 'nohup']

/** The simple commands of a shell line, each as its words. A command ends at `;`, `&`, `|`, a
 *  parenthesis, a backtick or a new line. A quote or a backslash joins characters into one word. The
 *  split does not expand a variable or a glob. It is not a full shell parser: it finds the words of a
 *  line that a person wrote by hand. */
function commandsOf(line: string): string[][] {
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
      if (line.charAt(i + 1) === '\n') {
        // A backslash before a new line joins the two lines, and adds nothing to the word.
        i++
      } else {
        // The next character is part of the word. A backslash at the end of the line adds nothing.
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

/** True when `word` runs Claude Code: `claude`, or a path that ends in it. */
const isClaude = (word: string) => path.posix.basename(word).replace(/\.exe$/i, '') === 'claude'

const isFlag = (word: string) => word === FLAG || word.startsWith(`${FLAG}=`)

/** True when the simple command `words` runs `claude` and passes the flag. A variable assignment
 *  and a wrapper such as `exec` come before the command word. */
function passesFlag(words: string[]): boolean {
  let at = 0
  while (
    at < words.length &&
    (ASSIGNMENT.test(words[at] as string) || WRAPPERS.includes(words[at] as string))
  ) {
    at++
  }
  return at < words.length && isClaude(words[at] as string) && words.slice(at + 1).some(isFlag)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not pass a CLI flag that Claude Code removed in a hook command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      removed: `Claude Code removed "${FLAG}" in v2.1.111. Auto mode is in the Shift+Tab cycle. Use "--permission-mode auto" to start in it.`,
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const command = memberOf(handler, 'command')?.value
        if (stringOf(handler, 'type') !== 'command' || command?.kind !== 'string') {
          continue
        }
        const args = memberOf(handler, 'args')?.value
        if (args?.kind === 'array') {
          // Exec form: `command` is the executable, and each item of `args` is one argument.
          for (const item of args.items) {
            if (isClaude(command.value) && item.kind === 'string' && isFlag(item.value)) {
              context.report({ loc: item.loc, messageId: 'removed' })
            }
          }
        } else if (commandsOf(command.value).some(passesFlag)) {
          context.report({ loc: command.loc, messageId: 'removed' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
