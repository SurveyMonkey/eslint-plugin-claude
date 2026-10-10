// A plugin subagent has a name with a colon, such as `my-plugin:reviewer`. The colon puts a matcher on the
// regular-expression path, where it matches anywhere in the agent type
// (docs/rules/hooks-matcher-subagent-anchor.md). `hooks-matcher-syntax` reports only a matcher that
// is not a valid regular expression, and a colon makes a valid one.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-subagent-anchor' as const

const SUBAGENT_EVENTS = ['SubagentStart', 'SubagentStop']

/** True when the pattern has a `|` outside a group or a class. */
function hasTopLevelPipe(pattern: string): boolean {
  let depth = 0
  let inClass = false
  for (let at = 0; at < pattern.length; at += 1) {
    const char = pattern[at]
    if (char === '\\') {
      at += 1
    } else if (inClass) {
      inClass = char !== ']'
    } else if (char === '[') {
      inClass = true
    } else if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
    } else if (char === '|' && depth === 0) {
      return true
    }
  }
  return false
}

/** True when the pattern is a valid regular expression. `hooks-matcher-syntax` reports the others. */
function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

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
          // A colon in a group opener, such as `(?:`, is not the colon of a plugin name.
          matcher.value.replaceAll('(?:', '').includes(':') &&
          compiles(matcher.value)
        ) {
          const bare = matcher.value.replace(/^\^/, '').replace(/\$$/, '')
          // A list needs a group, because `^a|b$` anchors one end of each side only.
          const list = hasTopLevelPipe(bare)
          const anchored = matcher.value.startsWith('^') && matcher.value.endsWith('$') && !list
          if (anchored) {
            continue
          }
          context.report({
            loc: matcher.loc,
            messageId: 'unanchored',
            data: { matcher: list ? `(${bare})` : bare },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
