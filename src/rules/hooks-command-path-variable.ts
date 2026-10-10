// A plugin cannot know where Claude Code installs it, so a plugin hook reaches its files through
// `${CLAUDE_PLUGIN_ROOT}` (docs/rules/hooks-command-path-variable.md). The rule reports a plugin command hook that runs a
// path which starts in the working directory. It reads a plugin `hooks.json` and the hooks of a plugin skill. A project
// hook and an absolute path get no report: the docs show both as working.
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'
import { commandsOf, commandWordAt } from '../shell-words.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'hooks-command-path-variable' as const

/** The placeholder of the plugin install directory, as the docs write it. */
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`

/** The programs that take a script as their first argument that is no flag. */
const INTERPRETERS = [
  'bash',
  'sh',
  'zsh',
  'node',
  'python',
  'python3',
  'ruby',
  'pwsh',
  'powershell',
]

const SHELLS = ['bash', 'sh', 'zsh']
const POWERSHELLS = ['pwsh', 'powershell']

/** The commands that change the working directory, in lower case. A relative path after one of them can resolve
 *  inside the plugin. */
const DIRECTORY_COMMANDS = ['cd', 'pushd', 'set-location', 'push-location']

/** What the word after the flag `flag` of the interpreter `program` is:
 *  - `line`: a shell command line, which the rule reads again;
 *  - `code`: code of another language, which holds no path;
 *  - `file`: a script file;
 *  - undefined: the flag does not take code. */
function flagKind(program: string, flag: string): 'line' | 'code' | 'file' | undefined {
  const lower = flag.toLowerCase()
  if (SHELLS.includes(program)) {
    // A short flag cluster that holds `c`, such as `-lc`. `-e` and `-p` are no code flags for a shell.
    return /^-[A-Za-z]*c[A-Za-z]*$/.test(flag) ? 'line' : undefined
  }
  if (POWERSHELLS.includes(program)) {
    if (['-c', '-command'].includes(lower)) {
      return 'line'
    }
    if (['-file', '-f'].includes(lower)) {
      return 'file'
    }
    return ['-ec', '-encodedcommand'].includes(lower) ? 'code' : undefined
  }
  const codeFlags =
    program === 'node'
      ? ['-e', '-p', '-pe', '--eval', '--print']
      : program === 'ruby'
        ? ['-e']
        : ['-c']
  return codeFlags.includes(flag) ? 'code' : undefined
}

/** True when `word` is a path that Claude Code resolves from the working directory: it has a slash, and it does
 *  not start with a slash, a variable (`$` or `%`), `~` or a drive letter. */
function isRelativePath(word: string): boolean {
  return word.includes('/') && !/^([/$%~]|[A-Za-z]:)/.test(word)
}

/** The first path in `words` that starts in the working directory, or undefined. `words` is one simple
 *  command: the program and its arguments. */
function relativeIn(words: string[]): string | undefined {
  const at = commandWordAt(words)
  const program = words[at]
  if (program === undefined) {
    return undefined
  }
  if (isRelativePath(program)) {
    return program
  }
  const base = path.posix
    .basename(program)
    .replace(/\.exe$/i, '')
    .toLowerCase()
  if (!INTERPRETERS.includes(base)) {
    return undefined
  }
  const rest = words.slice(at + 1)
  for (const [index, word] of rest.entries()) {
    if (word.startsWith('-')) {
      const kind = flagKind(base, word)
      const next = rest[index + 1]
      if (kind === 'file') {
        return next !== undefined && isRelativePath(next) ? next : undefined
      }
      if (kind === 'line') {
        return next === undefined ? undefined : relativeInLines(commandsOf(next))
      }
      if (kind === 'code') {
        return undefined
      }
    } else {
      return isRelativePath(word) ? word : undefined
    }
  }
  return undefined
}

/** True when `words` is a command that changes the working directory. */
function changesDirectory(words: string[]): boolean {
  const program = words[commandWordAt(words)]
  return program !== undefined && DIRECTORY_COMMANDS.includes(program.toLowerCase())
}

/** The first path that starts in the working directory in `lines`, which are simple commands. The scan stops
 *  after the first command that changes the directory, and reads the target of that command. */
function relativeInLines(lines: string[][]): string | undefined {
  const moved = lines.findIndex(changesDirectory)
  return (moved === -1 ? lines : lines.slice(0, moved + 1))
    .map((words) => (changesDirectory(words) ? relativeTarget(words) : relativeIn(words)))
    .find((value) => value !== undefined)
}

/** The target of a command that changes the directory, when it is a path that starts in the working directory. */
function relativeTarget(words: string[]): string | undefined {
  const target = words.slice(commandWordAt(words) + 1).find((word) => !word.startsWith('-'))
  return target !== undefined && isRelativePath(target) ? target : undefined
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Reach the files of a plugin hook through the CLAUDE_PLUGIN_ROOT variable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relative:
        'The plugin hook runs "{{path}}" from the working directory, but Claude Code installs a plugin in a directory that you do not know. Write the path with "{{variable}}".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const inPlugin =
        source.kind === 'plugin' ||
        (source.kind === 'skill' && classifySkillFile(context.filename)?.plugin === true)
      if (!inPlugin) {
        return
      }
      for (const { handler } of handlersOf(source)) {
        const member = memberOf(handler, 'command')
        if (member?.value.kind !== 'string' || stringOf(handler, 'type') !== 'command') {
          continue
        }
        const args = memberOf(handler, 'args')?.value
        // Exec form: `command` is the program, and each string in `args` is an argument.
        const lines =
          args?.kind === 'array'
            ? [
                [
                  member.value.value,
                  ...args.items.flatMap((item) => (item.kind === 'string' ? [item.value] : [])),
                ],
              ]
            : commandsOf(member.value.value)
        const found = relativeInLines(lines)
        if (found !== undefined) {
          context.report({
            loc: member.value.loc,
            messageId: 'relative',
            data: { path: found, variable: PLUGIN_ROOT },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
