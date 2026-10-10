// `disabledMcpServers` and `enabledMcpServers` in a settings file
// (docs/rules/mcp-project-toggle-keys.md). Claude Code records these two lists for each project in
// `~/.claude.json` when a person toggles a server in the `/mcp` panel. The settings reference
// lists no such key. They are not `enabledMcpjsonServers` and `disabledMcpjsonServers`, which
// approve the servers of a project `.mcp.json`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-project-toggle-keys' as const

const KEYS = ['disabledMcpServers', 'enabledMcpServers']

const rule: JSONRuleDefinition<{ MessageIds: 'toggle' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set the per-project MCP toggle lists in a settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      toggle:
        'The key "{{key}}" is not a settings key. Claude Code records it for each project in `~/.claude.json`, when a person toggles a server in the `/mcp` panel. To approve or block the servers of `.mcp.json`, use `enabledMcpjsonServers` and `disabledMcpjsonServers`.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const key of KEYS) {
          const member = lastMember(node.body, key)
          if (member !== undefined) {
            context.report({ node: member.name, messageId: 'toggle', data: { key } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
