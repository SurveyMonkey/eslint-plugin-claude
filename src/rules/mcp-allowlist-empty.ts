// An empty `allowedMcpServers` (docs/rules/mcp-allowlist-empty.md). An unset key allows every
// server. An empty array sets the key, so only a server that matches an entry loads, and no entry
// matches. The managed settings page combines the lists of the managed files, so an entry in a
// sibling file makes the list not empty. A sibling that the rule cannot read can hold entries, so
// the rule then makes no report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'mcp-allowlist-empty' as const

const rule: JSONRuleDefinition<{ MessageIds: 'empty' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Confirm that an empty allowedMcpServers list is intended',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      empty:
        'An empty "allowedMcpServers" allows no server that a user, a plugin or claude.ai adds. An unset key allows every server. Add the entries to allow, or remove the key.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const list = lastMember(node.body, 'allowedMcpServers')?.value
        if (list?.type !== 'Array' || list.elements.length > 0) {
          return
        }
        // The lists of the managed files combine. An entry in a sibling makes the list not empty.
        const siblings = readManagedSource(context.filename)
        if (
          siblings === UNREADABLE ||
          siblings.some(
            ({ allowedMcpServers }) =>
              Array.isArray(allowedMcpServers) && allowedMcpServers.length > 0,
          )
        ) {
          return
        }
        context.report({ node: list, messageId: 'empty' })
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
  rule,
}
