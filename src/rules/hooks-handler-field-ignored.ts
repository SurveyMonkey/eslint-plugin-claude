// A handler field that Claude Code reads and does not act on
// (docs/rules/hooks-handler-field-ignored.md). The reference gives each case: the field
// works for one handler type, one event, one place, or without another field.
// A handler with no type or an unknown type is for `hooks-config-schema`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  type HookHandler,
  handlersOf,
  hooksListener,
  isHandlerType,
  isTrue,
  type Loc,
  memberOf,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-handler-field-ignored' as const

type MessageId =
  | 'asyncType'
  | 'continueOnBlockType'
  | 'continueOnBlockEvent'
  | 'shellWithArgs'
  | 'onceIgnored'
  | 'timeoutAsync'
  | 'timeoutSessionEnd'
  | 'timeoutSessionEndPlugin'
  | 'timeoutSessionEndLimit'
  | 'onFailureType'
  | 'onFailureEvent'
  | 'onFailureAsync'

interface Problem {
  loc: Loc
  messageId: MessageId
  data?: Record<string, string>
}

/** The events where `continueOnBlock` has no effect. The reason goes to Claude as a tool error
 *  and the turn continues, whatever the field says (the hooks reference, "Response schema"). */
const CONTINUE_IGNORED = ['PostToolUseFailure', 'TaskCreated']

/** The events where exit code 2 sends Claude back to work, so `onFailure` has no effect
 *  (the hooks reference, "Block the action when a hook fails"). */
const ON_FAILURE_IGNORED = ['Stop', 'SubagentStop', 'TaskCompleted', 'TeammateIdle']

/** The most seconds that the SessionEnd budget rises to (the hooks reference, "SessionEnd"),
 *  and the budget that a plugin hook cannot raise. The environment variable
 *  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` moves the budget, so each number is an option. */
const SESSION_END_MAX = 60
const SESSION_END_PLUGIN = 1.5

interface Options {
  sessionEndMax: number
  sessionEndPluginMax: number
}

/** Where Claude Code ignores `once`, by the kind of the source. */
const ONCE_PLACE = new Map([
  ['settings', 'a settings file'],
  ['agent', 'agent frontmatter'],
])

function problemsOf({ source, event, handler }: HookHandler, limits: Options): Problem[] {
  const problems: Problem[] = []
  const add = (key: string, messageId: MessageId, data?: Record<string, string>) => {
    const member = memberOf(handler, key)
    if (member !== undefined) {
      problems.push({ loc: member.keyLoc, messageId, data })
    }
  }
  const type = stringOf(handler, 'type')
  const known = type !== undefined && isHandlerType(type)
  const async = isTrue(handler, 'async')
  const background = type === 'command' && (async || isTrue(handler, 'asyncRewake'))

  if (known && type !== 'command') {
    add('async', 'asyncType', { field: 'async', type })
    add('asyncRewake', 'asyncType', { field: 'asyncRewake', type })
  }
  if (known && type !== 'prompt') {
    add('continueOnBlock', 'continueOnBlockType', { type })
  } else if (CONTINUE_IGNORED.includes(event)) {
    add('continueOnBlock', 'continueOnBlockEvent', { event })
  }
  if (memberOf(handler, 'args')?.value.kind === 'array') {
    add('shell', 'shellWithArgs')
  }
  const place = ONCE_PLACE.get(source.kind)
  if (place !== undefined && isTrue(handler, 'once')) {
    add('once', 'onceIgnored', { where: place })
  }
  const timeout = memberOf(handler, 'timeout')?.value
  if (type === 'command' && async && !isTrue(handler, 'asyncRewake')) {
    add('timeout', 'timeoutAsync')
  } else if (event === 'SessionEnd' && timeout?.kind === 'number') {
    const plugin = source.kind === 'plugin'
    const max = plugin ? limits.sessionEndPluginMax : limits.sessionEndMax
    if (timeout.value > max) {
      const docs = plugin ? SESSION_END_PLUGIN : SESSION_END_MAX
      // At another value, the message names the configured limit and claims no cut by Claude Code.
      add(
        'timeout',
        max !== docs
          ? 'timeoutSessionEndLimit'
          : plugin
            ? 'timeoutSessionEndPlugin'
            : 'timeoutSessionEnd',
        { max: String(max) },
      )
    }
  }
  if (known && type !== 'command' && type !== 'http') {
    add('onFailure', 'onFailureType', { type })
  } else if (ON_FAILURE_IGNORED.includes(event)) {
    add('onFailure', 'onFailureEvent', { event })
  } else if (background) {
    add('onFailure', 'onFailureAsync')
  }
  return problems
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Leave out the hook handler fields that Claude Code ignores',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          sessionEndMax: { type: 'number', exclusiveMinimum: 0 },
          sessionEndPluginMax: { type: 'number', exclusiveMinimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ sessionEndMax: SESSION_END_MAX, sessionEndPluginMax: SESSION_END_PLUGIN }],
    messages: {
      asyncType:
        '"{{field}}" works on a command hook only. Claude Code ignores it on a "{{type}}" hook.',
      continueOnBlockType:
        '"continueOnBlock" works on a prompt hook only. Claude Code ignores it on a "{{type}}" hook.',
      continueOnBlockEvent:
        'Claude Code ignores "continueOnBlock" on {{event}}. It returns the reason to Claude as a tool error, and the turn continues.',
      shellWithArgs:
        'Claude Code ignores "shell" when "args" is set. The hook runs in exec form, with no shell.',
      onceIgnored: '"once" works in skill frontmatter only. Claude Code ignores it in {{where}}.',
      timeoutAsync:
        'Claude Code does not enforce "timeout" on a command hook that runs with "async": true.',
      timeoutSessionEnd: `Claude Code raises the SessionEnd budget to ${SESSION_END_MAX} seconds at most. This "timeout" has no effect above ${SESSION_END_MAX}.`,
      timeoutSessionEndPlugin: `A "timeout" on a plugin hook does not raise the SessionEnd budget of ${SESSION_END_PLUGIN} seconds.`,
      timeoutSessionEndLimit:
        'This SessionEnd "timeout" is above the configured limit of {{max}} seconds.',
      onFailureType:
        '"onFailure" works on a command or http hook only. Claude Code ignores it on a "{{type}}" hook.',
      onFailureEvent:
        'Claude Code ignores "onFailure" on {{event}}. Exit code 2 on this event sends Claude back to work.',
      onFailureAsync: 'Claude Code ignores "onFailure" on a hook that runs in the background.',
    },
  },
  create(context) {
    const [limits] = context.options as [Options]
    return hooksListener(context, (source) => {
      for (const handler of handlersOf(source)) {
        for (const problem of problemsOf(handler, limits)) {
          context.report(problem)
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
