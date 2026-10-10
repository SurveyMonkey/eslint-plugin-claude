// The two OAuth values that Claude Code reads in the wrong form (docs/rules/mcp-oauth-values.md).
// `oauth.authServerMetadataUrl` must use `https://`. `oauth.scopes` is one string with spaces
// between the scopes, as RFC 6749 writes the `scope` parameter. A message never shows the value.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-oauth-values' as const

const rule: JSONRuleDefinition<{ MessageIds: 'metadataUrl' | 'scopesArray' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give an MCP oauth object an https metadata URL and a string of scopes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      metadataUrl:
        'The `oauth.authServerMetadataUrl` of the server "{{server}}" does not start with `https://`. Claude Code requires `https://`.',
      scopesArray:
        'The `oauth.scopes` of the server "{{server}}" is an array. Write one string with a space between the scopes.',
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
          const oauth = lastMember(member.value, 'oauth')?.value
          const server = keyOf(member.name)
          const url = lastMember(oauth, 'authServerMetadataUrl')?.value
          if (url?.type === 'String' && !url.value.toLowerCase().startsWith('https://')) {
            context.report({ node: url, messageId: 'metadataUrl', data: { server } })
          }
          const scopes = lastMember(oauth, 'scopes')?.value
          if (scopes?.type === 'Array') {
            context.report({ node: scopes, messageId: 'scopesArray', data: { server } })
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
