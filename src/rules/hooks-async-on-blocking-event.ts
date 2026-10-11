// A hook with `"async": true` runs in the background. The hooks reference says that its output cannot block or
// decide (docs/rules/hooks-async-on-blocking-event.md). The rule reports the flag on a command hook of an
// event that can block or decide. The rule is `off` in `recommended`: a hook that only logs can use the flag.
import type { Rule } from 'eslint'
import { BLOCKING_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'

const name = 'hooks-async-on-blocking-event' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not run a hook in the background on an event whose hooks can block or decide',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      async:
        'A background hook cannot block or decide, so its output has no effect on {{event}}. Remove "async" if the hook must block.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, handler } of handlersOf(source)) {
        const flag = memberOf(handler, 'async')?.value
        if (
          flag?.kind === 'boolean' &&
          flag.value &&
          stringOf(handler, 'type') === 'command' &&
          BLOCKING_EVENTS.includes(event)
        ) {
          context.report({ loc: flag.loc, messageId: 'async', data: { event } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
