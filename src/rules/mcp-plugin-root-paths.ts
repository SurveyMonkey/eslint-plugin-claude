// A relative path in the `command`, `args` or `env` of a plugin MCP server
// (docs/rules/mcp-plugin-root-paths.md). The plugin docs show the files of a plugin server through
// `${CLAUDE_PLUGIN_ROOT}`. The docs do not say where a plugin server starts, so a path that starts
// with `./` or `../` depends on a directory that the plugin does not control. The rule is a
// heuristic. It does not look for the target of the path. An absolute path, a bare program name and a path that starts
// with a variable are silent. `mcp-stdio-relative-path` owns a project `.mcp.json`.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { expandedStrings, lintedServers, mcpFileKind } from '../mcp-servers.ts'

const name = 'mcp-plugin-root-paths' as const

const RELATIVE_START = /^\.\.?\//

const rule: JSONRuleDefinition<{ MessageIds: 'relative' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a file of a plugin MCP server as a path from the plugin root variable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relative: `The \`{{field}}\` of the server "{{server}}" is the relative path "{{path}}". A relative path depends on the directory where the server starts. Write \`\${CLAUDE_PLUGIN_ROOT}/...\` for a file of the plugin.`,
    },
  },
  create(context) {
    // A project `.mcp.json` is not a plugin config.
    if (
      path.basename(context.filename) !== 'plugin.json' &&
      mcpFileKind(context.filename) !== 'plugin'
    ) {
      return {}
    }
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          for (const { node: text, field } of expandedStrings(server.member.value)) {
            if (
              (field === 'command' || field === 'args' || field === 'env') &&
              RELATIVE_START.test(text.value)
            ) {
              context.report({
                node: server.pinned ?? text,
                messageId: 'relative',
                data: { field, server: server.name, path: text.value },
              })
            }
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
