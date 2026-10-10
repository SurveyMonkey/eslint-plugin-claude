// A stdio `command` with a space and no `args` (docs/rules/mcp-stdio-command-has-args.md). The
// docs show `command` as the program and `args` as its arguments. They do not say that a `command`
// with a space fails, so the rule is a heuristic. A path can hold a space, so the rule skips a
// `command` that starts as an absolute path or with a variable reference. `mcp-hidden-whitespace`
// owns a space at the start or end of the value. A remote server is not stdio. An entry with a
// `url` and no `type` is not stdio.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lintedServers } from '../mcp-servers.ts'

const name = 'mcp-stdio-command-has-args' as const

// An absolute path (a `/` at the start, a drive letter, or a network share), or a start that is a
// variable reference. The variable can hold a path with a space.
const PATH_START = /^(?:\/|[A-Za-z]:[\\/]|\\\\|\$\{)/

const rule: JSONRuleDefinition<{ MessageIds: 'splitCommand' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put the arguments of a stdio MCP server in args, not in command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      splitCommand:
        'The `command` of the server "{{server}}" holds a space and the server has no `args`. Put the program in `command` and each argument in `args`.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const entry = server.member.value
          const type = lastMember(entry, 'type')?.value
          const command = lastMember(entry, 'command')?.value
          const args = lastMember(entry, 'args')?.value
          const stdio =
            type === undefined
              ? lastMember(entry, 'url') === undefined
              : type.type === 'String' && type.value === 'stdio'
          if (
            stdio &&
            command?.type === 'String' &&
            /\s/.test(command.value.trim()) &&
            !PATH_START.test(command.value.trim()) &&
            (args === undefined || (args.type === 'Array' && args.elements.length === 0))
          ) {
            context.report({
              node: server.pinned ?? command,
              messageId: 'splitCommand',
              data: { server: server.name },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
