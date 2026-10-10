// An `env` variable that Claude Code deprecates, or keeps as a legacy name
// (docs/rules/settings-env-deprecated-var.md). The names are in `src/data/settings-env.ts`. None
// of them is a variable that `settings-env-ignored-var` reports, so one fault gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { deprecatedEnvSummary } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-deprecated-var' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'deprecated' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set an env variable that Claude Code deprecates',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      deprecated: '"{{name}}" {{summary}}',
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
          // Two keys of one name: the last counts, as in `JSON.parse`. An empty value cancels a
          // shell value, and a value that is not a string is for `settings-env-value-format`.
          if (
            lastMember(env, variable) !== member ||
            value.type !== 'String' ||
            value.value === ''
          ) {
            continue
          }
          const summary = deprecatedEnvSummary(variable, value.value)
          if (summary !== undefined) {
            context.report({
              node: member.name,
              messageId: 'deprecated',
              data: { name: variable, summary },
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
