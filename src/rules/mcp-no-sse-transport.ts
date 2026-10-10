// A server with `type: "sse"` (docs/rules/mcp-no-sse-transport.md). The docs call the SSE
// transport deprecated and say to use HTTP where the server has it. Claude Code tries HTTP first
// for `claude mcp add --transport http`, and falls back to SSE. The rule reports the exact value
// `sse`. A rule for the server schema owns a `type` value that is not a known transport. The rule reads a
// `.mcp.json` and the servers that a plugin manifest declares.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lintedServers } from '../mcp-servers.ts'

const name = 'mcp-no-sse-transport' as const

const rule: JSONRuleDefinition<{ MessageIds: 'sse' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use the http transport for an MCP server, not the deprecated sse transport',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      sse: 'The server "{{server}}" has `type: "sse"`. The SSE transport is deprecated. Use `http` where the server supports it.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const type = lastMember(server.member.value, 'type')?.value
          if (type?.type === 'String' && type.value === 'sse') {
            context.report({
              node: server.pinned ?? type,
              messageId: 'sse',
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
