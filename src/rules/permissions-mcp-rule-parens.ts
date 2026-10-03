// Claude Code skips an `mcp__` rule that has parentheses when it loads a
// settings file (docs/rules/permissions-mcp-rule-parens.md).
import type { Rule } from 'eslint'
import { MCP_PREFIX } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-mcp-rule-parens' as const

const rule: Rule.RuleModule = {
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
    return permissionListener(context, (entries) => {
      for (const { loc, rule: parsed } of parsedEntries(entries)) {
        if (parsed.tool.startsWith(MCP_PREFIX) && parsed.specifier !== null) {
          context.report({ loc, messageId: 'parens' })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}
