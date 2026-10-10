// One plugin declares an MCP server name once (docs/rules/mcp-duplicate-server-name.md). Claude
// Code loads `.mcp.json` at the plugin root first, then each `mcpServers` value of the manifest
// in order, and a later server of one name replaces an earlier one. So the earlier server never
// runs. The rule reads `.mcp.json`, each `.json` file that `mcpServers` names, and the inline
// maps, through `pluginMcpDeclarations`. A source that it cannot read adds no name (ADR 001,
// Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { pluginMcpDeclarations } from '../mcp-servers.ts'

const name = 'mcp-duplicate-server-name' as const

const rule: JSONRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Declare each MCP server name of a plugin once',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        'The MCP server name "{{server}}" is already declared in {{from}}. A later declaration replaces an earlier one, so Claude Code drops the earlier server. Give each server a name of its own.',
    },
  },
  create(context) {
    // The plugin root is the directory that holds `.claude-plugin/`.
    const root = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const seen = new Map<string, string>()
        for (const declaration of pluginMcpDeclarations(root, node.body)) {
          const earlier = seen.get(declaration.name)
          if (earlier === undefined) {
            seen.set(declaration.name, declaration.from)
          } else {
            context.report({
              node: declaration.node,
              messageId: 'duplicate',
              data: { server: declaration.name, from: earlier },
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
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
