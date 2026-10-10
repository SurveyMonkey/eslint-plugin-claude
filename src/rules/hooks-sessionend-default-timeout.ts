// A SessionEnd hook has a default timeout of 1.5 seconds (docs/rules/hooks-sessionend-default-timeout.md).
// A hook that sets no `timeout` keeps the default, even when another hook raises the overall budget. A
// timeout on a plugin hook does not raise the budget, so the rule reads no plugin `hooks.json`. The
// rule checks that `timeout` is set, and compares no number: `hooks-handler-field-ignored` reports a
// number over the budget.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  isTrue,
  memberOf,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-sessionend-default-timeout' as const

/** The handler types that SessionEnd runs (`hooks-handler-type-event-support`). */
const RUN_TYPES = ['command', 'http', 'mcp_tool']

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Set a timeout on a SessionEnd hook, which Claude Code cancels after 1.5 seconds',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      timeout:
        'Claude Code cancels a SessionEnd hook after 1.5 seconds unless the hook sets "timeout". Set "timeout" on this handler.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      if (source.kind === 'plugin') {
        return
      }
      for (const { event, handler } of handlersOf(source)) {
        const type = stringOf(handler, 'type')
        // A command hook in the background has no timeout (`hooks-handler-field-ignored`).
        const background = isTrue(handler, 'async') && !isTrue(handler, 'asyncRewake')
        if (
          event === 'SessionEnd' &&
          type !== undefined &&
          RUN_TYPES.includes(type) &&
          !(type === 'command' && background) &&
          memberOf(handler, 'timeout') === undefined
        ) {
          context.report({ loc: handler.loc, messageId: 'timeout' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
