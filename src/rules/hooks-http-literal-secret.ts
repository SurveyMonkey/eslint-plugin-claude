// A header value of an `http` hook supports `$VAR_NAME` and `${VAR_NAME}`, and `allowedEnvVars` lists the
// variables that Claude Code may use (docs/rules/hooks-http-literal-secret.md). A literal token in a header of
// a committed hook is a secret in the repository. The rule reads the headers that carry a credential. A message
// never holds the value. `hooks-http-env-allowlist` reads the references.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  lastMembers,
  memberOf,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-http-literal-secret' as const

/** A header name that carries a credential. HTTP header names have no letter case. */
const CREDENTIAL_NAME = /auth|token|secret|password|api[-_]?key|credential/i
const REFERENCE = /\$(?:\{[A-Za-z_]\w*\}|[A-Za-z_])/
/** A value that cannot be a secret: a Boolean word, `none`, `null` and a plain integer. */
const NOT_A_SECRET = /^(?:true|false|yes|no|on|off|none|null|\d+)$/i

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use a variable and not a literal credential in a header of an http hook',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal:
        'The "{{header}}" header holds a literal credential, which is then in the repository. Set the value to a variable such as "Bearer $MY_TOKEN", and list the variable in "allowedEnvVars".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const headers = memberOf(handler, 'headers')?.value
        if (stringOf(handler, 'type') !== 'http' || headers?.kind !== 'object') {
          continue
        }
        for (const { key, value } of lastMembers(headers)) {
          if (
            value.kind !== 'string' ||
            !CREDENTIAL_NAME.test(key) ||
            REFERENCE.test(value.value)
          ) {
            continue
          }
          // The scheme word of an `Authorization` value is not the secret.
          const secret = value.value.replace(/^\s*(?:bearer|basic|token)\b/i, '').trim()
          if (secret !== '' && !NOT_A_SECRET.test(secret)) {
            context.report({ loc: value.loc, messageId: 'literal', data: { header: key } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
