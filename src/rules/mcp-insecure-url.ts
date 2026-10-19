// A remote server at an `http://` or `ws://` URL (docs/rules/mcp-insecure-url.md). The traffic to
// a host that is not on the machine goes in clear text. `claude plugin validate` warns about this
// URL in the MCP configs of a plugin (v2.1.281 or later), so the rule reads the servers of the
// project `.mcp.json` only. A loopback host is on the machine, so it is silent. A host with a `${`
// reference is not known, so it is silent too.
// The rule also reads each string in the `mcpServers` of `.claude-plugin/plugin.json`: the path or
// URL of an MCP bundle. Validate passes an `http://` bundle URL (v2.1.302), so the rule reports it.
// The docs ask for "a path inside the plugin or an `https://` URL". A loopback host and a `${` host
// are silent there too, for the same reasons. A plugin directly under `.claude/skills/` is silent,
// because Claude Code skips its bundles.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import {
  declaredMcpStrings,
  lintedServers,
  mcpFileKind,
  parseUrl,
  REMOTE_SERVER_TYPES,
} from '../mcp-servers.ts'
import { isSkillsPlugin } from '../plugin-manifest.ts'

const name = 'mcp-insecure-url' as const

/** The schemes that send the traffic in clear text. */
const CLEAR_SCHEMES: readonly string[] = ['http:', 'ws:']

/** True when `host`, as `URL` gives it, is on the machine: `localhost`, an address of `127.0.0.0/8`,
 *  or `[::1]`. */
const isLoopback = (host: string) =>
  host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host)

/** A bundle string that `claude plugin validate` reads as an `http://` URL. Validate 2.1.302 reads
 *  `HTTP://` as a URL. It reads `http:`, `http:/` and `http:\\` as a path, and fails them. It
 *  also fails a string with a character before `http://`, such as a space, a tab or a BOM. */
const HTTP_BUNDLE = /^http:\/\//i

/** The host and the scheme of `url` when the scheme is in `schemes` and the host is not on the
 *  machine. The host has no trailing dot. The result is null for a URL that does not parse,
 *  another scheme, a loopback host and a host with a `${` reference. */
function clearHost(
  url: string,
  schemes: readonly string[],
): { host: string; scheme: string } | null {
  const parsed = parseUrl(url)
  if (parsed === null || !schemes.includes(parsed.protocol)) {
    return null
  }
  const host = parsed.hostname.replace(/\.$/, '')
  return isLoopback(host) || host.includes('${') ? null : { host, scheme: parsed.protocol }
}

/** True when `filename` is a plugin manifest: a `plugin.json` in a `.claude-plugin/` directory. */
const isManifest = (filename: string) =>
  path.basename(filename) === 'plugin.json' &&
  path.basename(path.dirname(path.resolve(filename))) === '.claude-plugin'

const rule: JSONRuleDefinition<{ MessageIds: 'insecure' | 'insecureBundle' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Use https:// or wss:// for a remote MCP server, and https:// for an MCP bundle URL',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      insecure:
        'The server "{{server}}" connects to {{host}} over {{scheme}}//. The traffic goes in clear text. Use https:// or wss://, or a host on the machine.',
      insecureBundle:
        'The MCP bundle URL points to {{host}} over http://, so a download of the bundle goes in clear text. Use a path inside the plugin or an https:// URL.',
    },
  },
  create(context) {
    if (isManifest(context.filename)) {
      if (isSkillsPlugin(context.filename)) {
        return {}
      }
      return {
        Document(node) {
          for (const declared of declaredMcpStrings(node.body)) {
            const clear = HTTP_BUNDLE.test(declared.value)
              ? clearHost(declared.value, CLEAR_SCHEMES)
              : null
            if (clear !== null) {
              context.report({
                node: declared,
                messageId: 'insecureBundle',
                data: { host: clear.host },
              })
            }
          }
        },
      }
    }
    // `claude plugin validate` warns for a plugin config. `mcpFileKind` also gives `project` to a
    // file that is not `.mcp.json`, so the rule checks the file name.
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
          const clear = clearHost(url.value, CLEAR_SCHEMES)
          if (clear === null) {
            continue
          }
          context.report({
            node: url,
            messageId: 'insecure',
            data: { server: server.name, host: clear.host, scheme: clear.scheme },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
}

export default rule
