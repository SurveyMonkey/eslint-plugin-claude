// The hooks reference describes the JSON output of a hook (docs/rules/hooks-output-schema.md). A field that sits at
// the wrong level, or that has the wrong value, makes Claude Code ignore it, often with no error. The rule
// reads JSON that a command prints as a literal, inline or from a repository script. It reports these faults:
// - `permissionDecision`, `additionalContext` or `updatedInput` at the top level;
// - a `hookEventName` that is missing or not the event;
// - a top-level `decision` other than "block" (`hooks-output-deprecated-fields` owns the `PreToolUse` one);
// - `suppressOutput`;
// - `defer`, `updatedInput` or `additionalContext` on `PreModelSwitch`;
// - `classifierContext` from a hook in the background;
// - a block on a `ConfigChange` hook that runs for `policy_settings` only.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  exactValues,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  inBackground,
  type Json,
  objectField,
  printedJson,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'

const name = 'hooks-output-schema' as const

type MessageId =
  | 'level'
  | 'eventName'
  | 'eventNameMissing'
  | 'decision'
  | 'suppress'
  | 'modelSwitch'
  | 'classifierAsync'
  | 'policyBlock'

interface Fault {
  messageId: MessageId
  data: Record<string, string>
}

/** The fields that belong inside `hookSpecificOutput`. */
const NESTED = ['permissionDecision', 'additionalContext', 'updatedInput']

/** The faults of the JSON object `json` for a handler on `event` under `matcher`. */
function faultsOf(
  json: Json,
  event: string,
  matcher: string | undefined,
  background: boolean,
): Fault[] {
  const faults: Fault[] = NESTED.filter((field) => field in json).map((field) => ({
    messageId: 'level',
    data: { field },
  }))
  const specific = objectField(json, 'hookSpecificOutput')
  if (specific !== undefined) {
    const named = specific.hookEventName
    if (named === undefined) {
      faults.push({ messageId: 'eventNameMissing', data: { event } })
    } else if (named !== event) {
      faults.push({ messageId: 'eventName', data: { actual: String(named), event } })
    }
    if (event === 'PreModelSwitch') {
      const unsupported = [
        ...(specific.permissionDecision === 'defer' ? ['permissionDecision "defer"'] : []),
        ...['updatedInput', 'additionalContext'].filter((field) => field in specific),
      ]
      faults.push(
        ...unsupported.map((field) => ({ messageId: 'modelSwitch' as const, data: { field } })),
      )
    }
    if (background && 'classifierContext' in specific) {
      faults.push({ messageId: 'classifierAsync', data: {} })
    }
  }
  // `PreToolUse` has its own deprecated form of `decision`.
  if (typeof json.decision === 'string' && json.decision !== 'block' && event !== 'PreToolUse') {
    faults.push({ messageId: 'decision', data: { value: json.decision } })
  }
  if ('suppressOutput' in json) {
    faults.push({ messageId: 'suppress', data: {} })
  }
  const values = exactValues(matcher ?? '', false)
  if (
    event === 'ConfigChange' &&
    json.decision === 'block' &&
    values?.length === 1 &&
    values[0] === 'policy_settings'
  ) {
    faults.push({ messageId: 'policyBlock', data: {} })
  }
  return faults
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Print JSON output that Claude Code reads, with each field at its level',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      level:
        'The JSON output has "{{field}}" at the top level. Claude Code ignores it there. Put it inside "hookSpecificOutput".',
      eventName:
        'The "hookEventName" of the JSON output is "{{actual}}", and this hook runs on {{event}}. Set it to "{{event}}".',
      eventNameMissing:
        'The "hookSpecificOutput" of the JSON output has no "hookEventName". It requires the name of the event, "{{event}}".',
      decision:
        'The top-level "decision" is "{{value}}". The only value is "block". To allow the action, leave "decision" out.',
      suppress:
        'The field "suppressOutput" has no effect. Claude Code accepts it and does not act on it. Remove it.',
      modelSwitch:
        'PreModelSwitch does not accept {{field}}. Its "permissionDecision" takes "allow", "deny" or "ask", and it has no "updatedInput" or "additionalContext".',
      classifierAsync:
        'The "classifierContext" note is in the output of a hook that runs in the background. Claude Code ignores it there, because the response comes after Claude Code records the tool result.',
      policyBlock:
        'This ConfigChange hook runs for "policy_settings" only, and Claude Code ignores a blocking decision for that source. Managed settings always take effect.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, matcher, handler } of handlersOf(source)) {
        const output = commandOutput(handler, folders)
        if (output === undefined) {
          continue
        }
        const seen = new Set<string>()
        for (const json of printedJson(output.texts)) {
          for (const { messageId, data } of faultsOf(json, event, matcher, inBackground(handler))) {
            const key = messageId + JSON.stringify(data)
            if (!seen.has(key)) {
              seen.add(key)
              context.report({ loc: output.loc, messageId, data })
            }
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
