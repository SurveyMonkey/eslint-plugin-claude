// A remote server at an `http://` or `ws://` URL (docs/rules/mcp-insecure-url.md). The traffic to
// a host that is not on the machine goes in clear text. `claude plugin validate` warns about this
// URL in the MCP configs of a plugin (v2.1.281 or later), so the rule reads the project
// `.mcp.json` only. A loopback host is on the machine, so it is silent. A host with a `${`
// reference is not known, so it is silent too.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lintedServers, mcpFileKind, parseUrl, REMOTE_SERVER_TYPES } from '../mcp-servers.ts'

const name = 'mcp-insecure-url' as const

/** The schemes that send the traffic in clear text. */
const CLEAR_SCHEMES: readonly string[] = ['http:', 'ws:']

/** True when `host`, as `URL` gives it, is on the machine: `localhost`, an address of `127.0.0.0/8`,
 *  or `[::1]`. */
const isLoopback = (host: string) =>
  host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host)

const rule: JSONRuleDefinition<{ MessageIds: 'insecure' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use https:// or wss:// for a remote MCP server that is not on the machine',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      insecure:
        'The server "{{server}}" connects to {{host}} over {{scheme}}//. The traffic goes in clear text. Use https:// or wss://, or a host on the machine.',
    },
  },
  create(context) {
    // `claude plugin validate` warns for a plugin config. `mcpFileKind` reads a `plugin.json` in
    // `.claude-plugin/` as a project file, so the rule also checks the file name.
    if (
      mcpFileKind(context.filename) !== 'project' ||
      path.basename(context.filename) !== '.mcp.json'
    ) {
      return {}
    }
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const type = lastMember(server.member.value, 'type')?.value
          const url = lastMember(server.member.value, 'url')?.value
          if (
            type?.type !== 'String' ||
            !REMOTE_SERVER_TYPES.includes(type.value) ||
            url?.type !== 'String'
          ) {
            continue
          }
          const parsed = parseUrl(url.value)
          if (parsed === null || !CLEAR_SCHEMES.includes(parsed.protocol)) {
            continue
          }
          const host = parsed.hostname.replace(/\.$/, '')
          if (isLoopback(host) || host.includes('${')) {
            continue
          }
          context.report({
            node: url,
            messageId: 'insecure',
            data: { server: server.name, host, scheme: parsed.protocol },
          })
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
