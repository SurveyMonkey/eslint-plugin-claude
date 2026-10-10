// A plugin subagent has a name with a colon, such as `my-plugin:reviewer`. The colon puts a matcher on the
// regular-expression path, where it matches anywhere in the agent type
// (docs/rules/hooks-matcher-subagent-anchor.md). `hooks-matcher-syntax` reports a matcher that is not
// a valid regular expression, and this rule skips such a matcher. This rule also skips a colon that
// opens a group, such as `(?:`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-subagent-anchor' as const

const SUBAGENT_EVENTS = ['SubagentStart', 'SubagentStop']

/**
 * Reads a pattern once. `alternatives` are the parts split at each `|` outside a group or a class.
 * `colon` is true when the pattern holds a colon that is not the opener of a group, such as `(?:`
 * or `(?i:`.
 */
function scan(pattern: string): { alternatives: string[]; colon: boolean } {
  const alternatives: string[] = []
  let colon = false
  let depth = 0
  let inClass = false
  let start = 0
  for (let at = 0; at < pattern.length; at += 1) {
    const char = pattern[at]
    if (char === '\\') {
      colon ||= pattern[at + 1] === ':'
      at += 1
    } else if (char === ':') {
      colon = true
    } else if (inClass) {
      inClass = char !== ']'
    } else if (char === '[') {
      inClass = true
    } else if (char === '(') {
      depth += 1
      if (pattern[at + 1] === '?') {
        let end = at + 2
        while (/[A-Za-z-]/.test(pattern.charAt(end))) {
          end += 1
        }
        if (pattern[end] === ':') {
          at = end
        }
      }
    } else if (char === ')') {
      depth -= 1
    } else if (char === '|' && depth === 0) {
      alternatives.push(pattern.slice(start, at))
      start = at + 1
    }
  }
  alternatives.push(pattern.slice(start))
  return { alternatives, colon }
}

/** True when the character at `at` has an odd number of backslashes before it. */
function escapedAt(pattern: string, at: number): boolean {
  let slashes = 0
  while (pattern[at - 1 - slashes] === '\\') {
    slashes += 1
  }
  return slashes % 2 === 1
}

/** True when the pattern ends in a `$` that is an anchor and not a literal. */
function endsAnchored(pattern: string): boolean {
  return pattern.endsWith('$') && !escapedAt(pattern, pattern.length - 1)
}

/** True when the alternative has both anchors, or is one group whose alternatives each have both. */
function anchored(alternative: string): boolean {
  if (alternative.startsWith('^') && endsAnchored(alternative)) {
    return true
  }
  const inner = /^\((?:\?:)?([\s\S]*)\)$/.exec(alternative)?.[1]
  return inner !== undefined && scan(inner).alternatives.every(anchored)
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
        if (matcher === undefined || !SUBAGENT_EVENTS.includes(event)) {
          continue
        }
        const { alternatives, colon } = scan(matcher.value)
        if (!colon || !compiles(matcher.value) || alternatives.every(anchored)) {
          continue
        }
        const bare = matcher.value
          .replace(/^\^/, '')
          .slice(0, endsAnchored(matcher.value) ? -1 : undefined)
        context.report({
          loc: matcher.loc,
          messageId: 'unanchored',
          // A list needs a group, because `^a|b$` anchors one end of each side only.
          data: { matcher: scan(bare).alternatives.length > 1 ? `(${bare})` : bare },
        })
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
