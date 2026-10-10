// An `mcpServers` key in a project settings file (docs/rules/mcp-settings-mcpservers.md).
// Claude Code reads no `mcpServers` key from `settings.json`. A server there never loads. The
// project servers belong in `.mcp.json` at the repository root.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'mcp-settings-mcpservers' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unread' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Define MCP servers in .mcp.json, not in a settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unread:
        'Claude Code does not read an "mcpServers" key in a settings file, so these servers never appear. Define project servers in .mcp.json at the repository root, or run `claude mcp add --scope user`.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const member = lastMember(node.body, 'mcpServers')
        if (member !== undefined) {
          context.report({ node: member.name, messageId: 'unread' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
