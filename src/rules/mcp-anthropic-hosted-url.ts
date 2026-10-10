// A remote server at an Anthropic-hosted connector URL (docs/rules/mcp-anthropic-hosted-url.md).
// These hosts sign in through claude.ai only. Claude Code refuses to start a local OAuth flow for
// them. A server entry at the same URL can also hide the claude.ai connector. The hosts are in
// `src/data/mcp-connector-hosts.ts`. The option `hosts` adds hosts.
import type { JSONRuleDefinition } from '@eslint/json'
import { ANTHROPIC_CONNECTOR_HOSTS } from '../data/mcp-connector-hosts.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, REMOTE_SERVER_TYPES, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-anthropic-hosted-url' as const

type Options = [{ hosts: string[] }]

/** The host of `url` in lower case with no trailing dot. The result is null when `url` has a
 *  `${` reference or does not parse, because the host is then not known. */
function hostOf(url: string): string | null {
  if (url.includes('${')) {
    return null
  }
  try {
    return new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'hosted' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not add an Anthropic-hosted connector as an MCP server entry',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { hosts: { type: 'array', items: { type: 'string', minLength: 1 } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ hosts: [] }],
    messages: {
      hosted:
        'The server "{{server}}" is at {{host}}, an Anthropic-hosted connector host. Claude Code refuses to start a local OAuth flow for it. Remove the entry, and connect the service on claude.ai.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    const [{ hosts }] = context.options
    const covered = new Set([
      ...ANTHROPIC_CONNECTOR_HOSTS,
      ...hosts.map((host) => host.toLowerCase().replace(/\.$/, '')),
    ])
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const type = lastMember(member.value, 'type')?.value
          const url = lastMember(member.value, 'url')?.value
          if (
            type?.type !== 'String' ||
            !REMOTE_SERVER_TYPES.includes(type.value) ||
            url?.type !== 'String'
          ) {
            continue
          }
          const host = hostOf(url.value)
          if (host !== null && covered.has(host)) {
            context.report({
              node: url,
              messageId: 'hosted',
              data: { server: keyOf(member.name), host },
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
