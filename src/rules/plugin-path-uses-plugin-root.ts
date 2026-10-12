// A plugin does not know where Claude Code installs it, so the docs say to name its files through
// `${CLAUDE_PLUGIN_ROOT}` and not through fixed paths (docs/rules/plugin-path-uses-plugin-root.md).
// The rule reports a relative path in a monitor command and in the `command` and `args` of an LSP
// server. `hooks-command-path-variable` owns the hook commands, and `mcp-plugin-root-paths` owns
// the MCP servers, so this rule reads neither. An absolute path is silent, because it can name a
// tool of the system. The rule is a heuristic. It makes no report when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lspServerMembers } from '../lsp-servers.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'
import { readPluginAt } from '../plugin-manifest.ts'
import { subcommands, wordsOf } from '../shell-split.ts'

const name = 'plugin-path-uses-plugin-root' as const

const RELATIVE_START = /^\.\.?\//
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

/** True when the program `text` is a path with a folder that starts in the working folder, such
 *  as `bin/m`. A name, an absolute path, a home path and a path from a variable are not. */
const isFolderPath = (text: string) => text.includes('/') && !/^[/$~]/.test(text)

/** The first relative path in the shell command `command`: a word that starts with `./` or `../`,
 *  or a program path such as `bin/m`. The result is undefined when the command has none. */
function firstRelative(command: string): string | undefined {
  for (const part of subcommands(command)) {
    const words = wordsOf(part)
    const program = words.findIndex((word) => !ASSIGNMENT.test(word) && word !== 'sudo')
    const found = words.find(
      (word, index) => RELATIVE_START.test(word) || (index === program && isFolderPath(word)),
    )
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'monitor' | 'lsp' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Write a file of a plugin monitor or LSP server as a path from the plugin root variable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      monitor: `The monitor command uses the relative path "{{path}}". A plugin can be installed anywhere, and a relative path depends on the folder where Claude Code runs it. Write \`\${CLAUDE_PLUGIN_ROOT}/...\` for a file of the plugin.`,
      lsp: `The \`{{field}}\` of the LSP server "{{server}}" is the relative path "{{path}}". A plugin can be installed anywhere, and a relative path depends on the folder where Claude Code runs it. Write \`\${CLAUDE_PLUGIN_ROOT}/...\` for a file of the plugin.`,
    },
  },
  create(context) {
    const full = path.resolve(context.filename)
    const isLsp = path.basename(full) === '.lsp.json'
    const file = isLsp ? undefined : pluginFileOf(full)
    const seen = isLsp ? readPluginAt(path.dirname(full)) !== undefined : file !== undefined
    return {
      Document(node) {
        if (!seen) {
          return
        }
        for (const { kind, node: command } of file
          ? commandsOf(file.role, node, file.plugin)
          : []) {
          const found = kind === 'monitor' ? firstRelative(command.value) : undefined
          if (found !== undefined) {
            context.report({ node: command, messageId: 'monitor', data: { path: found } })
          }
        }
        for (const member of lspServerMembers(node.body, full)) {
          const command = lastMember(member.value, 'command')?.value
          const args = lastMember(member.value, 'args')?.value
          const server = keyOf(member.name)
          if (
            command?.type === 'String' &&
            (RELATIVE_START.test(command.value) || isFolderPath(command.value))
          ) {
            const data = { field: 'command', server, path: command.value }
            context.report({ node: command, messageId: 'lsp', data })
          }
          for (const { value } of args?.type === 'Array' ? args.elements : []) {
            if (value.type === 'String' && RELATIVE_START.test(value.value)) {
              const data = { field: 'args', server, path: value.value }
              context.report({ node: value, messageId: 'lsp', data })
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json', '**/.lsp.json'],
}

export default rule
