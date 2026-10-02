// Claude Code checks file permissions against `Edit(path)` and `Read(path)`
// rules only. It accepts a path rule for another file tool and never
// consults it (docs/rules/permissions-path-rule-tool.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { PATH_RULE_REPLACEMENT } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'

const name = 'permissions-path-rule-tool' as const

const rule: JSONRuleDefinition<{ MessageIds: 'neverConsulted' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a path rule as Edit(path) or Read(path)',
      url: docsUrl(name),
    },
    messages: {
      neverConsulted:
        'Claude Code never consults a path rule for {{tool}}. Use {{replacement}}(path) instead.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of parsedEntries(node)) {
          const { tool, specifier } = entry.rule
          const replacement = PATH_RULE_REPLACEMENT.get(tool)
          if (replacement !== undefined && specifier !== null && parameterOf(entry) === null) {
            context.report({
              node: entry.node,
              messageId: 'neverConsulted',
              data: { tool, replacement },
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
  files: ['**/.claude/settings.json', '**/.claude/settings.local.json'],
  rule,
}
