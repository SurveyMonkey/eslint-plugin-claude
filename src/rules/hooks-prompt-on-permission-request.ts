// A prompt hook on PermissionRequest cannot deny (docs/rules/hooks-prompt-on-permission-request.md).
// The hooks reference, "Response schema", says that `ok: false` has no effect on that event.
// `hooks-handler-type-event-support` reports the `agent` type on the event, and not this one.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf } from '../hooks-config.ts'

const name = 'hooks-prompt-on-permission-request' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use a command hook, not a prompt hook, to decide on PermissionRequest',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      promptOnPermissionRequest:
        'A prompt hook on PermissionRequest cannot deny: "ok": false has no effect. Use a command hook that returns a decision.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, handler } of handlersOf(source)) {
        const type = memberOf(handler, 'type')?.value
        if (event === 'PermissionRequest' && type?.kind === 'string' && type.value === 'prompt') {
          context.report({ loc: type.loc, messageId: 'promptOnPermissionRequest' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
