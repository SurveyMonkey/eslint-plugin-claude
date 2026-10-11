// A key in a server entry or in its `oauth` object that the MCP docs do not name
// (docs/rules/mcp-unknown-keys.md). The docs list the keys of an entry (`type`, `command`,
// `args`, `env`, `url`, `headers`, `headersHelper`, `oauth`, `timeout`, `alwaysLoad`) and of
// `oauth` (`clientId`, `callbackPort`, `authServerMetadataUrl`, `scopes`). They do not say that
// another key is an error, so the rule is a heuristic. The bound of `callbackPort` is the range
// of a TCP port. The docs state no range. An `sdk` entry is an in-process server that the app
// registers, and its keys are not listed, so the rule skips it. A message names the key and never the value.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { lastMembers, lintedServers } from '../mcp-servers.ts'

const name = 'mcp-unknown-keys' as const

const ENTRY_KEYS: readonly string[] = [
  'type',
  'command',
  'args',
  'env',
  'url',
  'headers',
  'headersHelper',
  'oauth',
  'timeout',
  'alwaysLoad',
]
const OAUTH_KEYS: readonly string[] = [
  'clientId',
  'callbackPort',
  'authServerMetadataUrl',
  'scopes',
]

const rule: JSONRuleDefinition<{ MessageIds: 'entryKey' | 'oauthKey' | 'port' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use only the documented keys in an MCP server entry and its oauth object',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      entryKey:
        'The server "{{server}}" has the key "{{key}}", which the MCP docs do not list. Check the spelling of the key. The docs list: {{known}}.',
      oauthKey:
        'The `oauth` object of the server "{{server}}" has the key "{{key}}", which the MCP docs do not list. Check the spelling of the key. The docs list: {{known}}.',
      port: 'The `oauth.callbackPort` of the server "{{server}}" is not a whole number from 1 to 65535. A port is a number in that range.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const entry = server.member.value
          const type = lastMember(entry, 'type')?.value
          if (entry.type !== 'Object' || (type?.type === 'String' && type.value === 'sdk')) {
            continue
          }
          for (const member of lastMembers(entry.members)) {
            const key = keyOf(member.name)
            if (!ENTRY_KEYS.includes(key)) {
              context.report({
                node: server.pinned ?? member.name,
                messageId: 'entryKey',
                data: { server: server.name, key, known: ENTRY_KEYS.join(', ') },
              })
            }
          }
          const oauth = lastMember(entry, 'oauth')?.value
          for (const member of oauth?.type === 'Object' ? lastMembers(oauth.members) : []) {
            const key = keyOf(member.name)
            if (!OAUTH_KEYS.includes(key)) {
              context.report({
                node: server.pinned ?? member.name,
                messageId: 'oauthKey',
                data: { server: server.name, key, known: OAUTH_KEYS.join(', ') },
              })
            }
          }
          const port = lastMember(oauth, 'callbackPort')?.value
          if (
            port?.type === 'Number' &&
            !(Number.isInteger(port.value) && port.value >= 1 && port.value <= 65535)
          ) {
            context.report({
              node: server.pinned ?? port,
              messageId: 'port',
              data: { server: server.name },
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
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
