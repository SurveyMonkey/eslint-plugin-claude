// A number in the `env` block that is not in plain digits (docs/rules/settings-env-numeric-spelling.md).
// Claude Code before v2.1.211 reads `1e6` or `64_000` as a much smaller number. The rule reads the
// shape of the value, because the docs name no list of numeric variables. A variable that has a
// form in `src/data/settings-env.ts` and rejects the value is for `settings-env-value-format`.
import type { JSONRuleDefinition } from '@eslint/json'
import { CREDENTIAL_ENV_VARS, envValueForm } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-numeric-spelling' as const

// `1e6`, `2.5E+3`: digits, an exponent mark, and an exponent. `64_000`: groups of digits that an
// underscore joins.
const SCIENTIFIC = /^\d+(?:\.\d+)?[eE][+-]?\d+$/
const SEPARATED = /^\d+(?:_\d+)+$/

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'spelling' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a number in the env block of a settings file in plain digits',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      spelling:
        'The value "{{value}}" of "{{name}}" is not in plain digits. Claude Code before v2.1.211 reads this spelling as a much smaller number, such as 1. Write plain digits.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        if (env?.type !== 'Object') {
          return
        }
        for (const member of env.members) {
          const variable = keyOf(member.name)
          const { value } = member
          // Two keys of one name: the last counts, as in `JSON.parse`. A value that is not a
          // string is for `settings-env-value-format`.
          if (
            lastMember(env, variable) !== member ||
            value.type !== 'String' ||
            !(SCIENTIFIC.test(value.value) || SEPARATED.test(value.value)) ||
            CREDENTIAL_ENV_VARS.includes(variable) ||
            envValueForm(variable)?.accepts(value.value) === false
          ) {
            continue
          }
          context.report({
            node: value,
            messageId: 'spelling',
            data: { name: variable, value: value.value },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
