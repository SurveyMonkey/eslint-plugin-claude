// The `env` privacy toggles of a managed settings file (docs/rules/settings-managed-value-form.md).
// The server-managed settings page says that Claude Code applies `DISABLE_TELEMETRY` and three
// like variables without the approval dialog when the value is truthy, such as `1` or `true`. The
// rule reads the value as truthy by `isEnvOn`. A quoted Boolean in a managed file is for
// `settings-schema`, which reports a string where a key takes a Boolean.
import type { JSONRuleDefinition } from '@eslint/json'
import { isEnvOn, PRIVACY_TOGGLE_ENV_VARS } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-managed-value-form' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'approval' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set a privacy toggle in the env block of a managed settings file to 1',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      approval:
        'Server-managed settings show the user an approval dialog for the value "{{value}}" of "{{name}}". Only a truthy value such as 1 or true applies without it. Write "1".',
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
          // string is for `settings-env-value-format`. An empty value unsets the variable.
          if (
            lastMember(env, variable) === member &&
            PRIVACY_TOGGLE_ENV_VARS.includes(variable) &&
            value.type === 'String' &&
            value.value !== '' &&
            !isEnvOn(value.value)
          ) {
            context.report({
              node: value,
              messageId: 'approval',
              data: { name: variable, value: value.value },
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
  files: MANAGED_SETTINGS_FILES,
  rule,
}
