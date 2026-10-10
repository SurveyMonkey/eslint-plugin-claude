// An `env` variable in the shared settings file that sends the traffic of every user elsewhere
// (docs/rules/settings-env-routing.md). The names are in `src/data/settings-env.ts`. The rule
// reads `.claude/settings.json` only. A managed file is the place for a proxy or a provider. The
// file `.claude/settings.local.json` belongs to one user. `OTEL_EXPORTER_OTLP_ENDPOINT` is not
// here: `settings-env-ignored-var` reports it in a project file.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  BASE_URL_VAR,
  DEFAULT_API_HOST,
  isEnvOn,
  PROVIDER_ENV_VARS,
  TRAFFIC_ENV_VARS,
} from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'settings-env-routing' as const

/** True when `text` is not a URL with the default API host. A text that is no URL is not the
 *  default host. */
function isOtherHost(text: string): boolean {
  try {
    return new URL(text).hostname !== DEFAULT_API_HOST
  } catch {
    return true
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'traffic' | 'bypass' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not route the traffic of every user from the shared settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      traffic:
        '"{{name}}" in the shared settings file sends the traffic of every user of this repository through a proxy or adds a certificate authority. Set it in your shell, in user settings, or in managed settings.',
      bypass:
        '"{{name}}" in the shared settings file selects the API endpoint or the model provider for every user of this repository. Claude Code then bypasses server-managed settings. Set it in your shell, in user settings, or in managed settings.',
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
          // Two keys of one name: the last counts, as in `JSON.parse`. An empty value cancels a
          // shell value, and a value that is not a string is for `settings-env-value-format`.
          if (
            lastMember(env, variable) !== member ||
            value.type !== 'String' ||
            value.value === ''
          ) {
            continue
          }
          if (TRAFFIC_ENV_VARS.includes(variable)) {
            context.report({ node: member.name, messageId: 'traffic', data: { name: variable } })
          } else if (
            (variable === BASE_URL_VAR && isOtherHost(value.value)) ||
            (PROVIDER_ENV_VARS.includes(variable) && isEnvOn(value.value))
          ) {
            context.report({ node: member.name, messageId: 'bypass', data: { name: variable } })
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
