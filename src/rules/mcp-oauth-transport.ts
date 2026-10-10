// An `oauth` object on a server that cannot use it (docs/rules/mcp-oauth-transport.md). OAuth
// applies to `http` and `sse` servers. A stdio server, a server with no `type` (which is stdio)
// and a `ws` server never read the object. A `ws` server takes headers only.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-oauth-transport' as const

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use oauth only on an http or sse MCP server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'The {{transport}} server "{{server}}" has an `oauth` object. OAuth applies to `http` and `sse` servers only, so Claude Code ignores it.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const oauth = lastMember(member.value, 'oauth')
          if (oauth?.value.type !== 'Object') {
            continue
          }
          const type = lastMember(member.value, 'type')?.value
          // No `type` means stdio. A `type` that is not a string is for `mcp-server-schema`.
          const transport = type === undefined ? 'stdio' : type.type === 'String' ? type.value : ''
          if (transport === 'stdio' || transport === 'ws') {
            context.report({
              node: oauth.name,
              messageId: 'ignored',
              data: { server: keyOf(member.name), transport },
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
  files: ['**/.mcp.json'],
  rule,
}
