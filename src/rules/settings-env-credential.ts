// A credential in the `env` block of a committed settings file
// (docs/rules/settings-env-credential.md). The variables and the header names are in
// `src/data/settings-env.ts`. A message never holds the value.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  CREDENTIAL_ENV_VARS,
  CREDENTIAL_HEADERS,
  CUSTOM_HEADERS_VAR,
} from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-credential' as const

/** The credential header that a `Name: Value` line of `value` names, if any. The first line
 *  that names one counts. A header name is the text before the first colon. HTTP header names
 *  have no letter case, so the match has none. */
function credentialHeader(value: string): string | undefined {
  for (const line of value.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    // A line without a colon has no name.
    if (colon < 0) {
      continue
    }
    const lineName = line.slice(0, colon).trim().toLowerCase()
    const header = CREDENTIAL_HEADERS.find((credential) => credential.toLowerCase() === lineName)
    if (header !== undefined) {
      return header
    }
  }
  return undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'variable' | 'header' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a credential in the env block of a settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      variable:
        'The "env" block sets "{{name}}", a credential, in a committed file. Use "apiKeyHelper" to get a credential at run time.',
      header:
        'The "env" block sets "ANTHROPIC_CUSTOM_HEADERS" with the header "{{header}}", a credential, in a committed file. Use "apiKeyHelper" to get a credential at run time.',
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
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(env, variable) !== member || value.type !== 'String') {
            continue
          }
          if (CREDENTIAL_ENV_VARS.includes(variable) && value.value.trim() !== '') {
            context.report({ node: member.name, messageId: 'variable', data: { name: variable } })
          } else if (variable === CUSTOM_HEADERS_VAR) {
            const header = credentialHeader(value.value)
            if (header !== undefined) {
              context.report({ node: value, messageId: 'header', data: { header } })
            }
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
