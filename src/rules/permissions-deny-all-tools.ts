// A `deny` rule `"*"` removes every tool from Claude's context, and `"mcp__*"` removes every MCP
// tool (docs/rules/permissions-deny-all-tools.md). The rule asks that the choice be deliberate.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-deny-all-tools' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'all' | 'mcp' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Deny every tool or every MCP tool only on purpose',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      all: 'The deny rule `*` removes every tool from Claude. Keep it only if you want that. Otherwise deny the tools by name.',
      mcp: 'The deny rule `mcp__*` removes every MCP tool, from every server. Keep it only if you want that. Otherwise deny one server, as in `mcp__<server>__*`.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (list === 'deny' && parsed.specifier === null) {
          if (parsed.tool === '*') {
            context.report({ loc, messageId: 'all' })
          } else if (parsed.tool === 'mcp__*') {
            context.report({ loc, messageId: 'mcp' })
          }
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
