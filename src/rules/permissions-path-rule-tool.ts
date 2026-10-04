// Claude Code checks file permissions against `Edit(path)` and `Read(path)`
// rules only. It accepts a path rule for another file tool and never
// consults it (docs/rules/permissions-path-rule-tool.md).
import type { Rule } from 'eslint'
import { PATH_RULE_REPLACEMENT } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-path-rule-tool' as const

const rule: Rule.RuleModule = {
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
    return permissionListener(context, (entries) => {
      for (const entry of parsedEntries(entries)) {
        const { tool, specifier } = entry.rule
        const replacement = PATH_RULE_REPLACEMENT.get(tool)
        if (replacement !== undefined && specifier !== null && parameterOf(entry) === null) {
          context.report({
            loc: entry.loc,
            messageId: 'neverConsulted',
            data: { tool, replacement },
          })
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
