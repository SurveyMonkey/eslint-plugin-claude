// A static `Authorization` header beside an `oauth` object (docs/rules/mcp-authorization-header-
// with-oauth.md). With the header, Claude Code never falls back to OAuth for the server. If the
// server rejects the header, the connection fails. So `oauth` has no effect. The rule reads
// `http`, `streamable-http` and `sse` servers. `mcp-oauth-transport` owns the other transports.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-authorization-header-with-oauth' as const

const OAUTH_TYPES: readonly string[] = ['http', 'streamable-http', 'sse']

const rule: JSONRuleDefinition<{ MessageIds: 'shadowed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set oauth beside a static Authorization header on an MCP server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shadowed:
        'The server "{{server}}" has an `oauth` object and a static `Authorization` header. Claude Code never falls back to OAuth for it. Remove one of them.',
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
          const type = lastMember(member.value, 'type')?.value
          const headers = lastMember(member.value, 'headers')?.value
          if (
            oauth?.value.type !== 'Object' ||
            type?.type !== 'String' ||
            !OAUTH_TYPES.includes(type.value) ||
            headers?.type !== 'Object'
          ) {
            continue
          }
          // HTTP header names do not depend on letter case.
          const header = headers.members.some(
            (entry) => keyOf(entry.name).toLowerCase() === 'authorization',
          )
          if (header) {
            context.report({
              node: oauth.name,
              messageId: 'shadowed',
              data: { server: keyOf(member.name) },
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
