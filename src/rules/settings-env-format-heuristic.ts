// The value of an MCP or PowerShell `env` variable that has the wrong form
// (docs/rules/settings-env-format-heuristic.md). A heuristic, and `off` in `recommended`. The
// forms are in `src/data/settings-env.ts`. They are not the forms of `settings-env-value-format`,
// which the docs state more firmly, so this rule does not double a report of that rule. A value
// that is not a string is for `settings-env-value-format`.
import type { JSONRuleDefinition } from '@eslint/json'
import { heuristicEnvForm } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-format-heuristic' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'badForm' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the MCP and PowerShell env variables in the form that the docs give',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      badForm: 'The value of "{{name}}" should be {{expected}}.',
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
          const form = heuristicEnvForm(variable)
          // Two keys of one name: the last counts, as in `JSON.parse`. The empty string cancels a
          // shell value, and is valid for every variable.
          if (
            form !== undefined &&
            lastMember(env, variable) === member &&
            value.type === 'String' &&
            value.value !== '' &&
            !form.accepts(value.value)
          ) {
            context.report({
              node: value,
              messageId: 'badForm',
              data: { name: variable, expected: form.expected },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
