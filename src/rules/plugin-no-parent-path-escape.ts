// Claude Code copies an installed plugin into its cache, and files outside the plugin directory are
// not copied, so a path above the plugin root finds nothing (docs/rules/plugin-no-parent-path-escape.md).
// The rule reads each shell command of a plugin. It reports a command that names a path above
// `${CLAUDE_PLUGIN_ROOT}`. It also reads each script of the plugin that the command runs, and
// reports a script that names a path above the plugin root. It resolves a path of a script from the
// folder of the script. A path with a variable or another expansion is not read. The rule is a
// heuristic. It makes no report for a script that it cannot read (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'
import { afterRoot, pluginScripts } from '../plugin-scripts.ts'
import { subcommands, wordsOf } from '../shell-split.ts'
import { isInside } from '../skill-tree.ts'

const name = 'plugin-no-parent-path-escape' as const

// A path with one of these characters can hold a variable, a substitution, a glob, a home path or a
// URL. The rule cannot resolve it.
const UNRESOLVED = /[$`*?[\]{}\\~:=!#"']/
// A word with a `..` segment.
const PARENT = /(?:^|\/)\.\.(?:\/|$)/

/** True when the rest of a word after `${CLAUDE_PLUGIN_ROOT}` is a path that leaves the root. */
function leavesRoot(rest: string): boolean {
  if ((rest !== '' && !rest.startsWith('/')) || /[$`]/.test(rest)) {
    return false
  }
  const resolved = path.posix.resolve('/root', `.${rest}`)
  return resolved !== '/root' && !resolved.startsWith('/root/')
}

/** The first word of the shell text `text` that names a path above the plugin root, or undefined.
 *  A word with `${CLAUDE_PLUGIN_ROOT}` is read from the root. When `from` is set, any other word is
 *  a path from that folder. A command has no `from`, because its working folder is not known. */
function firstEscape(text: string, root: string, from: string | undefined): string | undefined {
  for (const part of subcommands(text)) {
    const words = wordsOf(part)
    const comment = words.findIndex((word) => word.startsWith('#'))
    for (const word of comment === -1 ? words : words.slice(0, comment)) {
      const rest = afterRoot(word)
      const bare = word.replace(/^[<>]+/, '')
      if (rest !== undefined ? leavesRoot(rest) : isEscape(bare, root, from)) {
        return bare
      }
    }
  }
  return undefined
}

/** True when the word `word`, as a path from `from`, is above `root`. */
function isEscape(word: string, root: string, from: string | undefined): boolean {
  return (
    from !== undefined &&
    PARENT.test(word) &&
    !word.startsWith('/') &&
    !UNRESOLVED.test(word) &&
    !isInside(path.resolve(from, word), root)
  )
}

const advice =
  'Claude Code copies an installed plugin into its cache, and the copy has no files outside the plugin directory. Move the files into the plugin, or reach them through a link inside the plugin.'

const rule: JSONRuleDefinition<{ MessageIds: 'command' | 'script' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not name a path above the plugin root in a plugin command or script',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      command: `This command names "{{path}}", which is above the plugin root. ${advice}`,
      script: `The script "{{script}}" names "{{path}}", which is above the plugin root. ${advice}`,
    },
  },
  create(context) {
    const file = pluginFileOf(context.filename)
    return {
      Document(node) {
        if (file === undefined) {
          return
        }
        const { realRoot } = file.plugin
        for (const { node: command } of commandsOf(file.role, node, file.plugin)) {
          const found = firstEscape(command.value, realRoot, undefined)
          if (found !== undefined) {
            context.report({ node: command, messageId: 'command', data: { path: found } })
          }
          for (const script of pluginScripts(file.plugin, command.value)) {
            const escaped = firstEscape(script.text, realRoot, path.dirname(script.file))
            if (escaped !== undefined) {
              const data = { path: escaped, script: script.word }
              context.report({ node: command, messageId: 'script', data })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [
    '**/.claude-plugin/plugin.json',
    '**/hooks/hooks.json',
    '**/.mcp.json',
    '**/monitors/monitors.json',
  ],
  rule,
}
