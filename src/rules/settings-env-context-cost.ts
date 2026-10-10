// An `env` variable in the shared settings file that raises the cost of every session
// (docs/rules/settings-env-context-cost.md). A heuristic, and `off` in `recommended`. The names
// are in `src/data/settings-env.ts`. `FORCE_PROMPT_CACHING_5M` is a debug override of the cache
// lifetime. `ENABLE_TOOL_SEARCH` set to a false value loads every MCP tool definition at the start.
// The rule compares no number. `settings-env-prompt-caching-off` owns the variables that turn
// prompt caching off.
import type { JSONRuleDefinition } from '@eslint/json'
import { FORCE_CACHE_5M_VAR, isEnvOff, isEnvOn, TOOL_SEARCH_VAR } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'settings-env-context-cost' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'fiveMinutes' | 'toolSearchOff' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not set an env variable that raises the context cost in the shared settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      fiveMinutes:
        '"{{name}}" forces the 5-minute prompt cache lifetime for every user of this repository, and overrides the lifetime that each user chooses. The docs name it as a way to debug the cache. Set it in your shell when you debug.',
      toolSearchOff:
        '"{{name}}" set to a false value loads the definition of every MCP tool at the start of each session. That fills the context, and a change of the tool set invalidates the prompt cache. Remove the variable to defer the tools.',
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
          if (lastMember(env, variable) !== member || value.type !== 'String') {
            continue
          }
          if (variable === FORCE_CACHE_5M_VAR && isEnvOn(value.value)) {
            context.report({
              node: member.name,
              messageId: 'fiveMinutes',
              data: { name: variable },
            })
          } else if (variable === TOOL_SEARCH_VAR && isEnvOff(value.value)) {
            context.report({
              node: member.name,
              messageId: 'toolSearchOff',
              data: { name: variable },
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
  files: ['**/.claude/settings.json'],
  rule,
}
