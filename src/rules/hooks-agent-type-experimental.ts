// Agent hooks (`type: "agent"`) are experimental (docs/rules/hooks-agent-type-experimental.md). The
// hooks reference, "Agent-based hooks", says that they may change and that production work should prefer
// command hooks. The rule reports an agent hook on an event that runs it. `hooks-handler-type-event-support`
// owns the events that do not run an agent hook, or that discard its output. The two rules never report
// the same handler.
import type { Rule } from 'eslint'
import { AGENT_HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf } from '../hooks-config.ts'

const name = 'hooks-agent-type-experimental' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use a command hook, not an experimental agent hook',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      experimental:
        'Agent hooks are experimental and may change. Use a command hook for production work.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, handler } of handlersOf(source)) {
        const type = memberOf(handler, 'type')?.value
        if (
          AGENT_HOOK_EVENTS.includes(event) &&
          type?.kind === 'string' &&
          type.value === 'agent'
        ) {
          context.report({ loc: type.loc, messageId: 'experimental' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
