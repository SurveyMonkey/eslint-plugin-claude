// A server name that `claude mcp` and the Claude Desktop import reject
// (docs/rules/mcp-server-name-format.md). The name has letters, numbers, hyphens and
// underscores only. A tool or prompt name replaces each other character with `_`. The rule skips a
// reserved name, which `mcp-server-name-reserved` reports. It reads a `.mcp.json` and the servers
// that a plugin manifest declares.
import type { JSONRuleDefinition } from '@eslint/json'
import { RESERVED_MCP_SERVER_NAMES } from '../data/mcp-reserved-names.ts'
import { docsUrl } from '../docs-url.ts'
import { lintedServers, SERVER_NAME_PATTERN } from '../mcp-servers.ts'

const name = 'mcp-server-name-format' as const

const rule: JSONRuleDefinition<{ MessageIds: 'format' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name an MCP server with letters, numbers, hyphens and underscores only',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      format:
        'The server name "{{server}}" has a character other than a letter, a number, a hyphen or an underscore. `claude mcp` commands and the Claude Desktop import reject it, and tool names replace it with `_`. Rename the server.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          if (
            !SERVER_NAME_PATTERN.test(server.name) &&
            !RESERVED_MCP_SERVER_NAMES.includes(server.name)
          ) {
            context.report({
              node: server.pinned ?? server.member.name,
              messageId: 'format',
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
