// Ten events run a hook for every occurrence, and Claude Code ignores a `matcher` on them
// (docs/rules/hooks-matcher-unsupported-event.md). The reference lists the events.
import type { Rule } from 'eslint'
import { NO_MATCHER_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-unsupported-event' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set no matcher on a hook event that has no matcher support',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unsupported: 'Claude Code ignores the matcher on {{event}}, which has no matcher support.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        // `*` and an empty string are match-all, which is what Claude Code does without a matcher.
        if (
          matcher !== undefined &&
          matcher.value !== '' &&
          matcher.value !== '*' &&
          NO_MATCHER_EVENTS.includes(event)
        ) {
          context.report({ loc: matcher.loc, messageId: 'unsupported', data: { event } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
