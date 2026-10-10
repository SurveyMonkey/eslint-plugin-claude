// The `timeout` of a hook handler is in seconds (docs/rules/hooks-timeout-units.md). The docs give no
// upper limit. The rule reports a value at or above the option `millisecondsFrom`, which a person more
// likely wrote in milliseconds. The default of the option, 1000, is the choice of the plugin, not a docs value.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf } from '../hooks-config.ts'

const name = 'hooks-timeout-units' as const

const DEFAULT_FROM = 1000

interface Options {
  millisecondsFrom: number
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the timeout of a hook in seconds, not in milliseconds',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { millisecondsFrom: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ millisecondsFrom: DEFAULT_FROM }],
    messages: {
      units:
        '"timeout" is in seconds, so {{value}} waits for {{value}} seconds. For milliseconds, write {{seconds}}.',
      limit:
        '"timeout" is {{value}} seconds, which is at or above the configured limit of {{limit}} seconds.',
    },
  },
  create(context) {
    const [{ millisecondsFrom }] = context.options as [Options]
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const timeout = memberOf(handler, 'timeout')?.value
        if (timeout?.kind !== 'number' || timeout.value < millisecondsFrom) {
          continue
        }
        const { value } = timeout
        context.report({
          loc: timeout.loc,
          messageId: millisecondsFrom === DEFAULT_FROM ? 'units' : 'limit',
          data: {
            value,
            limit: millisecondsFrom,
            seconds: Math.round(value / 1000),
          },
        })
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
