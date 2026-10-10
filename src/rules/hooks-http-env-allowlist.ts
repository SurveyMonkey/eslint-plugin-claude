// A header of an `http` hook can hold `$VAR` or `${VAR}`. Claude Code replaces the reference with the
// value of the variable only when `allowedEnvVars` of the same hook lists it. It replaces any other
// reference with an empty string (docs/rules/hooks-http-env-allowlist.md). The rule reads that list
// only. The settings key `httpHookAllowedEnvVars` also limits the list. Its entries merge across
// settings files, so a file out of the repository can widen it. The rule does not read it.
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

const name = 'hooks-http-env-allowlist' as const

const REFERENCE = /\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))/g

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'List each environment variable of an http hook header in allowedEnvVars',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unlisted:
        'Claude Code replaces the reference to {{variable}} in the "{{header}}" header with an empty string, because "allowedEnvVars" does not list {{variable}}.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const headers = memberOf(handler, 'headers')?.value
        const allowed = memberOf(handler, 'allowedEnvVars')?.value
        // A value of the wrong type is a fault of `hooks-config-schema`.
        if (
          stringOf(handler, 'type') !== 'http' ||
          headers?.kind !== 'object' ||
          (allowed !== undefined && allowed.kind !== 'array')
        ) {
          continue
        }
        const listed = (allowed?.items ?? []).flatMap((item) =>
          item.kind === 'string' ? [item.value] : [],
        )
        for (const { key, value } of lastMembers(headers)) {
          if (value.kind !== 'string') {
            continue
          }
          const unlisted = new Set(
            [...value.value.matchAll(REFERENCE)]
              .map((match) => (match[1] ?? match[2]) as string)
              .filter((variable) => !listed.includes(variable)),
          )
          for (const variable of unlisted) {
            context.report({
              loc: value.loc,
              messageId: 'unlisted',
              data: { variable, header: key },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
