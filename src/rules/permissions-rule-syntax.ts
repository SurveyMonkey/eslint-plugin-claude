// Claude Code reads a permission rule as `Tool` or `Tool(specifier)`. It skips
// a string that is neither (docs/rules/permissions-rule-syntax.md). This is the
// only grammar rule that reports a string which does not parse.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { permissionEntries } from '../permission-entries.ts'

const name = 'permissions-rule-syntax' as const

const rule: JSONRuleDefinition<{
  MessageIds: 'emptyTool' | 'unbalanced' | 'trailingText' | 'nulByte'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each permission rule as Tool or Tool(specifier)',
      url: docsUrl(name),
    },
    messages: {
      emptyTool: 'This permission rule has no tool name. Claude Code skips it.',
      unbalanced: 'This permission rule has unbalanced parentheses. Claude Code skips it.',
      trailingText:
        'This permission rule has text after the closing parenthesis. Claude Code skips it.',
      nulByte: 'This permission rule has a NUL byte. Claude Code skips it.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const { node: entry, result } of permissionEntries(node)) {
          if (!result.ok) {
            context.report({ node: entry, messageId: result.reason })
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
