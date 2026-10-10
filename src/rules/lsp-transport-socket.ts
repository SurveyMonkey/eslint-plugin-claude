// `transport: "socket"` in an LSP server config (docs/rules/lsp-transport-socket.md). Claude Code
// accepts the value, but runs every LSP server over stdio. So the server never uses a socket,
// and the stdout protocol rules of stdio apply to it. `claude plugin validate` accepts the
// value too. The rule reads `.lsp.json` at a plugin root and the inline `lspServers` maps of
// `plugin.json`. The shape of the config is in `lsp-json-schema`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lspServerMembers } from '../lsp-servers.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'lsp-transport-socket' as const

const rule: JSONRuleDefinition<{ MessageIds: 'socket' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set the transport of an LSP server to socket',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      socket:
        'The LSP server "{{server}}" sets "transport" to "socket". Claude Code accepts the value, but runs every server over stdio. Remove the key, and make the server talk over stdio.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const member of lspServerMembers(node.body, context.filename)) {
          const transport = lastMember(member.value, 'transport')?.value
          if (transport?.type === 'String' && transport.value === 'socket') {
            context.report({
              node: transport,
              messageId: 'socket',
              data: { server: keyOf(member.name) },
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
  files: ['**/.lsp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
