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

/** True when `word` is a path that Claude Code resolves from the working directory: it has a slash, and it does
 *  not start with a slash, a variable, `~` or a drive letter. */
function isRelativePath(word: string): boolean {
  return word.includes('/') && !/^([/$~]|[A-Za-z]:)/.test(word)
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
  const base = path.posix.basename(program).replace(/\.exe$/i, '')
  const script = words.slice(at + 1).find((word) => !word.startsWith('-'))
  return INTERPRETERS.includes(base) && script !== undefined && isRelativePath(script)
    ? script
    : undefined
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
        const found = lines.map(relativeIn).find((value) => value !== undefined)
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
