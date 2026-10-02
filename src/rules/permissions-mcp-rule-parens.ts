// Claude Code skips an `mcp__` rule that has parentheses when it loads a
// settings file (docs/rules/permissions-mcp-rule-parens.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { MCP_PREFIX } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'

const name = 'permissions-mcp-rule-parens' as const

const rule: JSONRuleDefinition<{ MessageIds: 'parens' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write an MCP permission rule without parentheses',
      url: docsUrl(name),
    },
    messages: {
      parens:
        'Claude Code skips an "mcp__" rule that has parentheses. To match a parameter, pass a deny rule with --disallowedTools.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const { node: entry, rule: parsed } of parsedEntries(node)) {
          if (parsed.tool.startsWith(MCP_PREFIX) && parsed.specifier !== null) {
            context.report({ node: entry, messageId: 'parens' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json', '**/.claude/settings.local.json'],
  rule,
}
