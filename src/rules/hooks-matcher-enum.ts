// Ten events match on a fixed set of values, such as the source of a session or the trigger of a
// compaction (docs/rules/hooks-matcher-enum.md). A matcher value outside the set never matches.
import type { Rule } from 'eslint'
import {
  MATCHER_VALUES,
  NARROW_MATCHER_EVENTS,
  REMOVED_MATCHER_VALUES,
} from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener, quotedList } from '../hooks-config.ts'

const name = 'hooks-matcher-enum' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use a matcher value that the hook event sends',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown: 'Claude Code never sends "{{segment}}" on {{event}}. The values are {{values}}.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        const known = MATCHER_VALUES.get(event)
        if (matcher === undefined || known === undefined) {
          continue
        }
        // A matcher with another character is a regular expression, and the rule does not read it.
        const segments = exactValues(matcher.value, NARROW_MATCHER_EVENTS.includes(event))
        const removed = REMOVED_MATCHER_VALUES.get(event) ?? []
        for (const segment of segments ?? []) {
          if (!known.includes(segment) && !removed.includes(segment)) {
            context.report({
              loc: matcher.loc,
              messageId: 'unknown',
              data: { segment, event, values: quotedList(known) },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
