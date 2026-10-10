// A matcher on the regular expression path matches anywhere in the tool name, so `Edit.*` also matches
// `NotebookEdit` (docs/rules/hooks-matcher-unanchored-regex.md). The rule reports a tool-event regular
// expression that matches a built-in tool which its form with a leading `^` does not. `hooks-matcher-syntax` owns a
// pattern that does not compile and the `Tool(specifier)` form, and this rule skips both.
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import { isFullMcpName, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-unanchored-regex' as const

/** A tool name with a specifier in parentheses, such as `Bash(rm *)`. The same form as in
 *  `hooks-matcher-syntax`, which reports it. */
const TOOL_SPEC = /^([A-Za-z_][\w-]*)\(.*\)$/

/** The regular expression for `pattern`, or undefined when it does not compile. */
function compile(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern)
  } catch {
    return undefined
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Anchor a tool matcher that is a regular expression',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unanchored:
        'The matcher "{{matcher}}" is a regular expression that matches anywhere in the tool name, so it also matches {{tools}}. Start it with "^". End it with "$" for a whole-string match.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (matcher === undefined || !TOOL_EVENTS.includes(event)) {
          continue
        }
        const { value, loc } = matcher
        const spec = TOOL_SPEC.exec(value)?.[1]
        if (
          exactValues(value, false) !== null ||
          (spec !== undefined && (TOOL_NAMES.includes(spec) || isFullMcpName(spec)))
        ) {
          continue
        }
        // A pattern that does not compile is for `hooks-matcher-syntax`. The `*` match-all matcher is one.
        const loose = compile(value)
        if (loose === undefined) {
          continue
        }
        const fromStart = new RegExp(`^(?:${value})`)
        const extra = TOOL_NAMES.filter((tool) => loose.test(tool) && !fromStart.test(tool))
        if (extra.length > 0) {
          context.report({
            loc,
            messageId: 'unanchored',
            data: { matcher: value, tools: extra.join(', ') },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
