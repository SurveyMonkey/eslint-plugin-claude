// A server named `anthropic-skills` (docs/rules/mcp-server-name-anthropic-skills.md). Claude Code
// reserves that name for the skills that it syncs from claude.ai. So it lists no prompt of a
// server with that name as a command. The tools of the server still work. The name is not in
// `src/data/mcp-reserved-names.ts`, because Claude Code does not skip the server at load time.
// The rule reads a `.mcp.json` and the servers that a plugin manifest declares.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lintedServers } from '../mcp-servers.ts'

const name = 'mcp-server-name-anthropic-skills' as const

const SYNCED_SKILLS_NAME = 'anthropic-skills'

const rule: JSONRuleDefinition<{ MessageIds: 'synced' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not name an MCP server anthropic-skills',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      synced: `The server name "${SYNCED_SKILLS_NAME}" is reserved for skills synced from claude.ai. Claude Code lists no prompt of this server as a command. Its tools still work. Rename the server.`,
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          if (server.name === SYNCED_SKILLS_NAME) {
            context.report({ node: server.pinned ?? server.member.name, messageId: 'synced' })
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
