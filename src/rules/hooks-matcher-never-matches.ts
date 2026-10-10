// A tool-event matcher is case-sensitive, and two more values never reach a hook:
// `EndConversation` on `PreToolUse`, `PostToolUse` and `PermissionRequest`, and the advisor tool
// (docs/rules/hooks-matcher-never-matches.md). The rule reports a value that can never match.
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import { TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-never-matches' as const

/** The tool that the hooks reference says `PreToolUse`, `PostToolUse` and `PermissionRequest` skip. */
const END_CONVERSATION = 'EndConversation'
const SKIPS_END_CONVERSATION = ['PreToolUse', 'PostToolUse', 'PermissionRequest']

/** The tool name that `segment` is a case variant of, or undefined. */
function caseVariantOf(segment: string): string | undefined {
  const folded = segment.toLowerCase()
  return TOOL_NAMES.find((tool) => tool.toLowerCase() === folded)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use a matcher value that a tool hook can match',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      caseVariant:
        'Tool names are case-sensitive. The matcher "{{segment}}" matches no tool. Write "{{tool}}".',
      endConversation:
        'Claude Code runs no {{event}} hook for EndConversation, so "{{segment}}" never matches.',
      advisor:
        'The advisor tool has no name that a hook matcher can use, so "{{segment}}" never matches.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (matcher === undefined || !TOOL_EVENTS.includes(event)) {
          continue
        }
        // A matcher with another character is a regular expression, and the rule does not read it.
        for (const segment of exactValues(matcher.value, false) ?? []) {
          const loc = matcher.loc
          const tool = caseVariantOf(segment)
          if (tool === END_CONVERSATION && SKIPS_END_CONVERSATION.includes(event)) {
            // A case variant gets this message too: a fix of the case alone still never matches.
            context.report({ loc, messageId: 'endConversation', data: { event, segment } })
          } else if (segment.toLowerCase() === 'advisor') {
            context.report({ loc, messageId: 'advisor', data: { segment } })
          } else if (tool !== undefined && tool !== segment) {
            context.report({ loc, messageId: 'caseVariant', data: { segment, tool } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
