// `Bash(ls*)` has no space before the `*`, so it also matches `lsof`. The space before a trailing
// `*` is part of the rule (docs/rules/permissions-bash-glued-wildcard.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-glued-wildcard' as const

/** One program name and a `*` after it, with no space. A `/` makes the word a path, as in
 *  `./scripts/*`. A `:` is the `:*` suffix, which `permissions-bash-colon-star-suffix` reads. */
const GLUED = /^([^\s*/:]+)\*$/

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'glued' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put a space before the final * of a Bash allow rule',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      glued:
        '`{{rule}}` has no space before the `*`, so it also matches every program whose name starts with `{{program}}`. Write `{{fixed}}`, which needs a space after the name.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        const program =
          list === 'allow' && parsed.specifier !== null && COMMAND_RULE_TOOLS.includes(parsed.tool)
            ? GLUED.exec(parsed.specifier.trim())?.[1]
            : undefined
        if (program !== undefined) {
          context.report({
            loc,
            messageId: 'glued',
            data: {
              rule: `${parsed.tool}(${parsed.specifier})`,
              program,
              fixed: `${parsed.tool}(${program} *)`,
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
