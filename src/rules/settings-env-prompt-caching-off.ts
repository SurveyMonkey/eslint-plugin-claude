// An `env` variable in the shared settings file that turns prompt caching off
// (docs/rules/settings-env-prompt-caching-off.md). The names are in `src/data/settings-env.ts`.
// The rule reads `.claude/settings.json` only. The prompt caching page names managed settings as
// the place for a policy across an organization.
import type { JSONRuleDefinition } from '@eslint/json'
import { isEnvOn, PROMPT_CACHING_OFF_VARS } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'settings-env-prompt-caching-off' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'off' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not turn prompt caching off from the shared settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      off: '"{{name}}" in the shared settings file turns prompt caching off for every user of this repository. Each request then costs more and takes longer. Set it in your shell when you debug caching.',
    },
  },
  create(context) {
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
            lastMember(env, variable) === member &&
            PROMPT_CACHING_OFF_VARS.includes(variable) &&
            value.type === 'String' &&
            isEnvOn(value.value)
          ) {
            context.report({ node: member.name, messageId: 'off', data: { name: variable } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
