// A channel is an MCP server that Claude Code starts as a subprocess and talks to over stdio
// (docs/rules/plugin-channel-server-stdio.md). The rule reports a channel whose `server` names a
// remote server, one with a `url` and no `command`. It reads the servers of the inline `mcpServers`
// key and of the `.mcp.json` in the plugin root. A server that a file named by the manifest may
// declare, or that no declaration has, gives no report. The rule makes no report when it cannot
// see the plugin or the `.mcp.json`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lookup, type Plugin, readPlugin } from '../plugin-manifest.ts'
import { readJson, UNREADABLE } from '../skill-tree.ts'

const name = 'plugin-channel-server-stdio' as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The config of the server `key` that Claude Code uses, or undefined when the rule cannot tell.
 *  Claude Code loads `.mcp.json` first, then each shape of the manifest key in order, and a later
 *  server of one name replaces an earlier one (manifest reference, "mcpServers"). So the rule
 *  reads the manifest key from the end. A string is a file or a bundle, and may hold the server. */
function serverOf(plugin: Plugin, key: string): unknown {
  const declared = plugin.fields.mcpServers
  for (const part of Array.isArray(declared) ? declared.toReversed() : [declared]) {
    if (typeof part === 'string') {
      return undefined
    }
    if (isObject(part) && Object.hasOwn(part, key)) {
      return part[key]
    }
  }
  const real = lookup(plugin, '.mcp.json')
  const file = typeof real === 'string' ? readJson(real, plugin.realRoot) : UNREADABLE
  if (file === null || file === UNREADABLE || !isObject(file.data)) {
    return undefined
  }
  // The docs say a `.mcp.json` can omit the `mcpServers` wrapper (components reference,
  // "MCP servers").
  const servers = isObject(file.data.mcpServers) ? file.data.mcpServers : file.data
  return Object.hasOwn(servers, key) ? servers[key] : undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'remote' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Bind a channel to a stdio MCP server, not to a remote server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      remote:
        'The channel binds to the server "{{server}}", which is a remote server with a `url`. Claude Code starts a channel server as a subprocess and talks to it over stdio. Declare the server with `command`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const channels = lastMember(node.body, 'channels')?.value
        if (plugin === undefined || channels?.type !== 'Array') {
          return
        }
        for (const { value } of channels.elements) {
          const server = lastMember(value, 'server')?.value
          if (server?.type !== 'String') {
            continue
          }
          const config = serverOf(plugin, server.value)
          if (
            isObject(config) &&
            typeof config.command !== 'string' &&
            typeof config.url === 'string'
          ) {
            context.report({ node: server, messageId: 'remote', data: { server: server.value } })
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
