// Any `Cd` allow rule switches `/cd` to allowlist mode: the resolved target must match an allow
// rule, or `/cd` refuses (docs/rules/permissions-cd-allowlist.md). The rule makes one report for
// a file, at the first such rule.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-cd-allowlist' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'allowlist' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add a Cd allow rule only to put /cd in allowlist mode',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      allowlist:
        '`{{rule}}` switches `/cd` to allowlist mode{{count}}: `/cd` refuses each target that no `Cd` allow rule matches. Keep the rule only if you want that.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const allows = entries.filter(({ list, rule: { tool } }) => list === 'allow' && tool === 'Cd')
      const [first] = allows
      if (first !== undefined) {
        const { specifier } = first.rule
        context.report({
          loc: first.loc,
          messageId: 'allowlist',
          data: {
            rule: specifier === null ? 'Cd' : `Cd(${specifier})`,
            count: allows.length > 1 ? ` (this file has ${allows.length} allow rules)` : '',
          },
        })
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
