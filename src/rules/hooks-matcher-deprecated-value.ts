// A matcher value that Claude Code no longer sends (docs/rules/hooks-matcher-deprecated-value.md).
// `bypass_permissions_disabled` was a SessionEnd reason. Claude Code removed it in v2.1.234.
// `hooks-matcher-enum` makes no report for a removed value, so the two rules do not report the same segment.
import type { Rule } from 'eslint'
import { REMOVED_MATCHER_VALUES } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-deprecated-value' as const

/** The version in which Claude Code removed the value (the hooks reference, "SessionEnd"). */
const REMOVED_IN = 'v2.1.234'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Drop the matcher value that Claude Code no longer sends',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      removed:
        'Claude Code removed "{{segment}}" in {{version}} and does not send it on {{event}}. Drop it from the matcher.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        const removed = REMOVED_MATCHER_VALUES.get(event)
        if (matcher === undefined || removed === undefined) {
          continue
        }
        // A matcher with another character is a regular expression, and the rule does not read it.
        for (const segment of exactValues(matcher.value, false) ?? []) {
          if (removed.includes(segment)) {
            context.report({
              loc: matcher.loc,
              messageId: 'removed',
              data: { segment, version: REMOVED_IN, event },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
