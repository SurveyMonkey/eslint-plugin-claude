// Not every event runs every handler type (docs/rules/hooks-handler-type-event-support.md). Claude
// Code skips a hook of a type that its event does not run. The list is in the hooks reference,
// "Prompt-based hooks". The rule also reports an `mcp_tool` hook on `SessionStart` that can only fire
// at launch, because Claude Code skips it there.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  type HandlerType,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  isHandlerType,
  memberOf,
  quotedList,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-handler-type-event-support' as const

/** The events that run `command`, `http` and `mcp_tool` hooks, and no `prompt` or `agent` hook. */
const NO_PROMPT_EVENTS = [
  'ConfigChange',
  'CwdChanged',
  'DirectoryAdded',
  'Elicitation',
  'ElicitationResult',
  'FileChanged',
  'InstructionsLoaded',
  'MessageDisplay',
  'Notification',
  'PostCompact',
  'PostModelSwitch',
  'PreCompact',
  'PreModelSwitch',
  'SessionEnd',
  'StopFailure',
  'SubagentStart',
  'WorktreeCreate',
  'WorktreeRemove',
]
const NO_PROMPT_TYPES: readonly HandlerType[] = ['command', 'http', 'mcp_tool']

/** The handler types that an event runs, for each event that does not run all five. An event
 *  that is not in the map runs all five types, or is not a known event. */
const SUPPORT = new Map<string, readonly HandlerType[]>([
  // Setup runs `command` only: the reference says Claude Code always skips its `mcp_tool` hooks.
  ['Setup', ['command']],
  ['SessionStart', ['command', 'mcp_tool']],
  ['PermissionRequest', ['command', 'http', 'mcp_tool', 'prompt']],
  ...NO_PROMPT_EVENTS.map((event) => [event, NO_PROMPT_TYPES] as const),
])

/** The `SessionStart` matcher values that Claude Code sends at launch. It skips an `mcp_tool` hook
 *  there, because the servers are not up yet. `clear` and `compact` fire later. */
const LAUNCH_SOURCES = ['startup', 'resume']

/** True when the matcher selects launch sources only. A matcher with a character outside the exact
 *  match set is a regular expression, and the rule does not read it. A match-all matcher also fires
 *  on `clear` and `compact`, where the hook runs. */
function launchOnly(matcher: string | undefined): boolean {
  if (matcher === undefined || !/^[\w\- ,|]*$/.test(matcher)) {
    return false
  }
  const names = matcher
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
  return names.length > 0 && names.every((part) => LAUNCH_SOURCES.includes(part))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use a hook handler type that the event runs',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unsupported:
        'Claude Code does not run a "{{type}}" hook on {{event}}. It runs {{allowed}} hooks there.',
      launch:
        'Claude Code skips an "mcp_tool" hook on SessionStart at launch, and this matcher selects launch only. The hook never runs.',
      discarded:
        'Claude Code runs a "{{type}}" hook on PermissionDenied and discards its output. Use a command hook to return "retry".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher, handler } of handlersOf(source)) {
        const type = stringOf(handler, 'type')
        const node = memberOf(handler, 'type')?.value
        if (type === undefined || node === undefined || !isHandlerType(type)) {
          continue
        }
        const allowed = SUPPORT.get(event)
        const loc = node.loc
        if (allowed !== undefined && !allowed.includes(type)) {
          context.report({
            loc,
            messageId: 'unsupported',
            data: { type, event, allowed: quotedList(allowed) },
          })
        } else if (event === 'PermissionDenied' && (type === 'prompt' || type === 'agent')) {
          context.report({ loc, messageId: 'discarded', data: { type } })
        } else if (event === 'SessionStart' && type === 'mcp_tool' && launchOnly(matcher)) {
          context.report({ loc, messageId: 'launch' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
