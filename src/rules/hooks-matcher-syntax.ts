// How Claude Code reads a matcher (docs/rules/hooks-matcher-syntax.md): exact values when it holds
// exact-match characters only, and a JavaScript regular expression when it holds any other
// character. `FileChanged` and `StopFailure` have a narrower exact set, and `FileChanged` also
// watches each value as a literal file name.
import type { Rule } from 'eslint'
import {
  HOOK_EVENTS,
  NARROW_MATCHER_EVENTS,
  NO_MATCHER_EVENTS,
  TOOL_EVENTS,
} from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener, type Loc } from '../hooks-config.ts'

const name = 'hooks-matcher-syntax' as const

/** A tool name with a specifier in parentheses, such as `Bash(rm *)`. */
const TOOL_SPEC = /^[A-Za-z_][\w-]*\(.*\)$/
/** A character that makes a `FileChanged` value a pattern. The hooks reference says that Claude Code
 *  watches each value as a literal file name. A dot is part of most file names. */
const PATTERN_CHARACTER = /[\\^$*+?()[\]{}]/

/** The events that read a matcher as a regular expression when it has a character outside the exact
 *  set: every event with matcher support, except `FileChanged`, which watches literal names. */
const REGEX_EVENTS = HOOK_EVENTS.filter(
  (event) => event !== 'FileChanged' && !NO_MATCHER_EVENTS.includes(event),
)

/** The separator characters that someone may mean as a separator, with the name of each. A hyphen
 *  is part of many file names, so only `StopFailure` counts it. */
const STRAY: readonly (readonly [string, 'comma' | 'space' | 'hyphen'])[] = [
  [',', 'comma'],
  [' ', 'space'],
  ['-', 'hyphen'],
]

/** The reason `pattern` is not a regular expression, or undefined when it is one. */
function regexError(pattern: string): string | undefined {
  try {
    new RegExp(pattern)
    return undefined
  } catch (error) {
    return (error as Error).message
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a hook matcher in the form that Claude Code reads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      separator:
        'On {{event}} only "|" separates values. A {{character}} is part of the value, not a separator.',
      literal:
        'FileChanged watches each segment as a literal file name. The segment "{{segment}}" holds a regular expression character. Claude Code watches a file with that exact name.',
      toolSpec:
        'A matcher holds a bare tool name, not "Tool(specifier)". Match the arguments with the "if" field of the handler.',
      invalid: 'The matcher is not a valid regular expression: {{error}}',
    },
  },
  create(context) {
    /** The faults of a `FileChanged` or `StopFailure` matcher, which have the narrow exact set. */
    function checkNarrow(event: string, matcher: string, loc: Loc): void {
      if (event === 'StopFailure') {
        // Inside the wide exact set and outside the narrow one: the matcher is a regular expression.
        if (exactValues(matcher, false) !== null && exactValues(matcher, true) === null) {
          for (const [text, character] of STRAY) {
            if (matcher.includes(text)) {
              context.report({ loc, messageId: 'separator', data: { event, character } })
              break
            }
          }
        }
        return
      }
      const segments = matcher.split('|')
      // A space inside a value is part of a file name. A space at the edge is a mistaken separator.
      const character = segments.some((segment) => segment.includes(','))
        ? 'comma'
        : segments.some((segment) => segment !== segment.trim())
          ? 'space'
          : undefined
      if (character !== undefined) {
        context.report({ loc, messageId: 'separator', data: { event, character } })
      }
      for (const segment of segments) {
        if (segment !== '*' && PATTERN_CHARACTER.test(segment)) {
          context.report({ loc, messageId: 'literal', data: { segment } })
        }
      }
    }

    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (matcher === undefined || matcher.value === '' || matcher.value === '*') {
          continue
        }
        const { value, loc } = matcher
        if (NARROW_MATCHER_EVENTS.includes(event)) {
          checkNarrow(event, value, loc)
        }
        if (!REGEX_EVENTS.includes(event) || exactValues(value, false) !== null) {
          continue
        }
        if (TOOL_EVENTS.includes(event) && TOOL_SPEC.test(value)) {
          context.report({ loc, messageId: 'toolSpec' })
          continue
        }
        const error = regexError(value)
        if (error !== undefined) {
          context.report({ loc, messageId: 'invalid', data: { error } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
