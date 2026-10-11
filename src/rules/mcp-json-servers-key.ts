// The top level of a project `.mcp.json` (docs/rules/mcp-json-servers-key.md). Claude Code
// reads the servers from the `mcpServers` object. The rule reports a file that has no such
// object, and names the two usual causes: VS Code's `servers` key, and server entries
// at the top level. A plugin `.mcp.json` may omit the wrapper, so the rule skips it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode } from '../marketplace-json.ts'
import { lastMembers, mcpFileKind } from '../mcp-servers.ts'

const name = 'mcp-json-servers-key' as const

// The members that make a top-level object look like a server entry.
const ENTRY_KEYS = ['command', 'url', 'type']

/** True when `member` holds an object with a key of a server entry. */
function looksLikeServer(member: MemberNode): boolean {
  return ENTRY_KEYS.some((key) => lastMember(member.value, key) !== undefined)
}

const rule: JSONRuleDefinition<{
  MessageIds: 'vscodeServers' | 'unwrapped' | 'missing' | 'notObject'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put the servers of a project .mcp.json under the mcpServers key',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      vscodeServers:
        'The key `servers` is the form of VS Code. Claude Code reads the servers from the top-level `mcpServers` object.',
      unwrapped:
        'This server entry is at the top level. Claude Code reads the servers from the top-level `mcpServers` object. Move the entry into it.',
      missing:
        'This file has no top-level `mcpServers` object, so Claude Code loads no server from it.',
      notObject: 'The `mcpServers` key must be an object that maps server names to configs.',
    },
  },
  create(context) {
    if (mcpFileKind(context.filename) !== 'project') {
      return {}
    }
    return {
      Document(node) {
        const { body } = node
        if (body.type !== 'Object') {
          context.report({ node: body, messageId: 'missing' })
          return
        }
        const wrapper = lastMember(body, 'mcpServers')
        if (wrapper !== undefined) {
          if (wrapper.value.type !== 'Object') {
            context.report({ node: wrapper.value, messageId: 'notObject' })
          }
          return
        }
        const vscode = lastMember(body, 'servers')
        const unwrapped = lastMembers(body.members).find(looksLikeServer)
        if (vscode !== undefined) {
          context.report({ node: vscode.name, messageId: 'vscodeServers' })
        } else if (unwrapped !== undefined) {
          context.report({ node: unwrapped.name, messageId: 'unwrapped' })
        } else {
          context.report({ node: body, messageId: 'missing' })
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
