// A `Tool(param:value)` rule cannot match the primary input field of a tool.
// Claude Code ignores the rule and warns at startup
// (docs/rules/permissions-param-rule.md).
import type { Rule } from 'eslint'
import { PRIMARY_FIELDS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-param-rule' as const

const rule: Rule.RuleModule = {
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
    return permissionListener(context, (entries) => {
      for (const entry of parsedEntries(entries)) {
        const { tool } = entry.rule
        const field = parameterOf(entry)
        if (field !== null && PRIMARY_FIELDS.get(tool) === field) {
          context.report({ loc: entry.loc, messageId: 'primaryField', data: { tool, field } })
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
