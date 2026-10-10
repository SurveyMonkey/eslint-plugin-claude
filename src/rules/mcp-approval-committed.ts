// A project approval of the servers of `.mcp.json` in a committed settings file
// (docs/rules/mcp-approval-committed.md). `enableAllProjectMcpServers: true` and
// `enabledMcpjsonServers` approve repository servers without a prompt in a trusted folder. In an
// untrusted folder, Claude Code ignores both keys in `.claude/settings.json`. Claude Code writes
// the keys to `.claude/settings.local.json` when a user approves, so that file gives no report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'

const name = 'mcp-approval-committed' as const

const rule: JSONRuleDefinition<{ MessageIds: 'all' | 'listed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not commit an approval of the project MCP servers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      all: 'The committed "enableAllProjectMcpServers": true approves every server of .mcp.json without a prompt in a trusted folder. Claude Code ignores it in an untrusted folder. Remove the key, and let each user approve the servers.',
      listed:
        'The committed "enabledMcpjsonServers" approves the listed servers of .mcp.json without a prompt in a trusted folder. Claude Code ignores it in an untrusted folder. Remove the key, and let each user approve the servers.',
    },
  },
  create(context) {
    if (kindOf(context.filename) !== 'project') {
      return {}
    }
    return {
      Document(node) {
        const all = lastMember(node.body, 'enableAllProjectMcpServers')
        if (all?.value.type === 'Boolean' && all.value.value) {
          context.report({ node: all.name, messageId: 'all' })
        }
        const listed = lastMember(node.body, 'enabledMcpjsonServers')
        if (listed?.value.type === 'Array' && listed.value.elements.length > 0) {
          context.report({ node: listed.name, messageId: 'listed' })
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
