// A trailing `:*` is the same as a final ` *`. The permission dialog writes the space form
// (docs/rules/permissions-bash-colon-star-suffix.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { isInputParameterRule } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-colon-star-suffix' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'suffix' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the final wildcard of a Bash rule as a space and *, not as :*',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      suffix:
        '`{{rule}}` is the same as `{{fixed}}`. Write the space form, which the permission dialog writes.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (parsed.specifier === null || !COMMAND_RULE_TOOLS.includes(parsed.tool)) {
          continue
        }
        // A deny or ask rule on an input parameter has a value, and not a command.
        if (isInputParameterRule(list, parsed.specifier)) {
          continue
        }
        // The same end as `commandWords`: a `:*` that stands alone is text.
        const text = parsed.specifier.trim()
        if (text.length > 2 && text.endsWith(':*')) {
          context.report({
            loc,
            messageId: 'suffix',
            data: {
              rule: `${parsed.tool}(${parsed.specifier})`,
              fixed: `${parsed.tool}(${text.slice(0, -2).trimEnd()} *)`,
            },
          })
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
