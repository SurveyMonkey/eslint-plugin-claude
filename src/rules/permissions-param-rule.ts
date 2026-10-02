// A `Tool(param:value)` rule cannot match the primary input field of a tool.
// Claude Code ignores the rule and warns at startup
// (docs/rules/permissions-param-rule.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { PRIMARY_FIELDS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'

const name = 'permissions-param-rule' as const

const rule: JSONRuleDefinition<{ MessageIds: 'primaryField' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not match the primary input field with a parameter rule',
      url: docsUrl(name),
    },
    messages: {
      primaryField:
        'A parameter rule cannot match {{field}} of {{tool}}. Claude Code ignores this rule.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of parsedEntries(node)) {
          const { tool } = entry.rule
          const field = parameterOf(entry)
          if (field !== null && PRIMARY_FIELDS.get(tool) === field) {
            context.report({ node: entry.node, messageId: 'primaryField', data: { tool, field } })
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
