// A remote server with an empty `url` in a project `.mcp.json`
// (docs/rules/mcp-remote-url-empty.md). Claude Code shows such a server as `not configured`
// and never connects it. A plugin can ship such a placeholder for a connector. The user
// configures it later. So the rule skips plugin files. A `both` file, the root `.mcp.json` of a
// repository that is a plugin, is a project file too, so the rule reads it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, REMOTE_SERVER_TYPES, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-remote-url-empty' as const

const rule: JSONRuleDefinition<{ MessageIds: 'empty' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each remote server in a project .mcp.json a url',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      empty:
        'The remote server "{{server}}" has an empty `url`. Claude Code shows it as `not configured` and never connects it.',
    },
  },
  create(context) {
    // A `both` file is a project file too. The project reads the `mcpServers` object only.
    const kind = mcpFileKind(context.filename)
    if (kind === null || kind === 'plugin') {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, 'project')) {
          const type = lastMember(member.value, 'type')?.value
          const url = lastMember(member.value, 'url')?.value
          if (
            type?.type === 'String' &&
            REMOTE_SERVER_TYPES.includes(type.value) &&
            url?.type === 'String' &&
            url.value === ''
          ) {
            context.report({ node: url, messageId: 'empty', data: { server: keyOf(member.name) } })
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json'],
}

export default rule
