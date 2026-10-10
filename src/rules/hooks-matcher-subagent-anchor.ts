// A plugin subagent has a name with a colon, such as `my-plugin:reviewer`. The colon puts a matcher on the
// regular-expression path, where it matches anywhere in the agent type
// (docs/rules/hooks-matcher-subagent-anchor.md). `hooks-matcher-syntax` reports only a matcher that
// is not a valid regular expression, and a colon makes a valid one.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-subagent-anchor' as const

const SUBAGENT_EVENTS = ['SubagentStart', 'SubagentStop']

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Anchor a subagent matcher that holds the colon of a plugin-scoped name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unanchored:
        'A name with a colon is a regular expression, and it matches anywhere in the agent type. Anchor it: "^{{matcher}}$".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (
          matcher !== undefined &&
          SUBAGENT_EVENTS.includes(event) &&
          matcher.value.includes(':') &&
          !(matcher.value.startsWith('^') && matcher.value.endsWith('$'))
        ) {
          // A list needs a group, because `^a|b$` anchors one end of each side only.
          const bare = matcher.value.replace(/^\^/, '').replace(/\$$/, '')
          context.report({
            loc: matcher.loc,
            messageId: 'unanchored',
            data: { matcher: bare.includes('|') ? `(${bare})` : bare },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
