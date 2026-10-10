// A server name that Claude Code reserves (docs/rules/mcp-server-name-reserved.md). The list
// is in `src/data/mcp-reserved-names.ts`. Claude Code skips such a server at load time. The
// option `names` adds names to the list. The rule reads the server map of a project file and
// of a plugin file, with or without the `mcpServers` wrapper.
import type { JSONRuleDefinition } from '@eslint/json'
import { RESERVED_MCP_SERVER_NAMES } from '../data/mcp-reserved-names.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-server-name-reserved' as const

type Options = [{ names: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'reserved' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not give an MCP server a name that Claude Code reserves',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { names: { type: 'array', items: { type: 'string', minLength: 1 } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ names: [] }],
    messages: {
      reserved:
        'The name "{{server}}" is reserved. Claude Code skips this server at load time. Rename it.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    const [{ names }] = context.options
    const reserved = new Set([...RESERVED_MCP_SERVER_NAMES, ...names])
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const server = keyOf(member.name)
          if (reserved.has(server)) {
            context.report({ node: member.name, messageId: 'reserved', data: { server } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json'],
  rule,
}
