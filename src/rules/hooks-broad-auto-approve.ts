// A hook can answer a permission prompt (docs/rules/hooks-broad-auto-approve.md). A `PermissionRequest` hook
// returns `decision.behavior: "allow"`, and a `PreToolUse` hook returns `permissionDecision: "allow"`. The
// hooks guide says to keep the matcher narrow: an empty matcher or `.*` auto-approves every prompt. A
// `setMode` entry in `updatedPermissions` can switch the session to `bypassPermissions`. The output of a
// script is not in the file. So the rule reads the JSON text that an inline command or an `args` item holds.
// A handler with an `if` condition is narrow, and gets no report.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { groupsOf, HOOKS_TARGET, hooksListener, memberOf, stringOf } from '../hooks-config.ts'

const name = 'hooks-broad-auto-approve' as const

/** The matchers that match every tool: omitted, empty, `*` and `.*`. */
const BROAD = [undefined, '', '*', '.*']

/** What an allow looks like, by event, once quotes, backslashes and white space are gone. */
const ALLOW: Record<string, string> = {
  PermissionRequest: 'behavior:allow',
  PreToolUse: 'permissionDecision:allow',
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not auto-approve every tool or set bypassPermissions in a hook',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      allow:
        'This {{event}} hook allows the call under a matcher that matches every tool. It approves every prompt, including file writes and shell commands. Narrow the matcher to the tools that you trust.',
      bypass:
        'This hook sets the permission mode to bypassPermissions with a setMode entry. It turns off the permission prompts of the session, if the session can use that mode.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, group, matcher, handlers } of groupsOf(source)) {
        const matcherValue = memberOf(group, 'matcher')?.value
        const broad =
          matcherValue === undefined || (matcher !== undefined && BROAD.includes(matcher.value))
        for (const handler of handlers) {
          const line = memberOf(handler, 'command')?.value
          const args = memberOf(handler, 'args')?.value
          if (stringOf(handler, 'type') !== 'command' || line?.kind !== 'string') {
            continue
          }
          const text = [
            line.value,
            ...(args?.kind === 'array'
              ? args.items.flatMap((item) => (item.kind === 'string' ? [item.value] : []))
              : []),
          ]
            .join(' ')
            .replace(/[\s"'\\]/g, '')
          if (text.includes('setMode') && text.includes('mode:bypassPermissions')) {
            context.report({ loc: line.loc, messageId: 'bypass' })
          } else if (
            broad &&
            memberOf(handler, 'if') === undefined &&
            ALLOW[event] !== undefined &&
            text.includes(ALLOW[event])
          ) {
            context.report({ loc: line.loc, messageId: 'allow', data: { event } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
