// Claude Code reads a permission rule as `Tool` or `Tool(specifier)`. It skips
// a string that is neither (docs/rules/permissions-rule-syntax.md). This is the
// only grammar rule that reports a string which does not parse.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'
import type { ParseFailureReason } from '../permission-rule.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-rule-syntax' as const

const messages: Record<ParseFailureReason, string> = {
  emptyTool: 'This permission rule has no tool name. Claude Code skips it.',
  unbalanced: 'This permission rule has unbalanced parentheses. Claude Code skips it.',
  trailingText: 'This permission rule has text after the final parenthesis. Claude Code skips it.',
  nulByte: 'This permission rule has a NUL byte. It matches nothing.',
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each permission rule as Tool or Tool(specifier)',
      url: docsUrl(name),
    },
    messages,
  },
  create(context) {
    return permissionListener(context, (entries) => {
      for (const { loc, result } of entries) {
        if (!result.ok) {
          context.report({ loc, messageId: result.reason })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}
