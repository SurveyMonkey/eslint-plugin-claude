// A committed `env` variable that looks like a secret (docs/rules/settings-env-secret-heuristic.md).
// A heuristic, and `off` in `recommended`. The settings reference says that the values of `env`
// are plain text in the settings file, and reach every subprocess of Claude Code. The rule reads
// `.claude/settings.json`, the file that a team commits. The checks are in
// `src/data/settings-env.ts`. `settings-env-credential` owns the Claude Code credential
// variables and the credential lines of `ANTHROPIC_CUSTOM_HEADERS`, so this rule skips them. The
// message names the variable and never the value.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  CREDENTIAL_ENV_VARS,
  CUSTOM_HEADERS_VAR,
  hasSecretName,
  holdsKeyPath,
  looksLikeSecret,
} from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'

const name = 'settings-env-secret-heuristic' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'name' | 'value' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not commit an env variable that looks like a secret',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      name: 'The name "{{name}}" looks like a secret, and the value is plain text in a file that the repository commits. Every subprocess of Claude Code also gets it. Set the variable in your shell instead.',
      value:
        'The value of "{{name}}" has the shape of a credential, and it is plain text in a file that the repository commits. Every subprocess of Claude Code also gets it. Set the variable in your shell instead.',
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
          // shell value and holds no secret. A value that is not a string is for
          // `settings-env-value-format`.
          if (
            lastMember(env, variable) !== member ||
            value.type !== 'String' ||
            value.value === '' ||
            CREDENTIAL_ENV_VARS.includes(variable) ||
            variable === CUSTOM_HEADERS_VAR
          ) {
            continue
          }
          if (hasSecretName(variable) && !holdsKeyPath(variable)) {
            context.report({ node: member.name, messageId: 'name', data: { name: variable } })
          } else if (looksLikeSecret(value.value)) {
            context.report({ node: member.name, messageId: 'value', data: { name: variable } })
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
