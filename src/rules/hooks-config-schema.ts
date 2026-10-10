// The shape of the hooks config: an event holds matcher groups, and a group holds handlers
// (docs/rules/hooks-config-schema.md). The same shape is in `hooks/hooks.json` of a plugin, in the
// `hooks` key of a settings file, and in skill and agent frontmatter. The rule reports the
// shape only. An event name is for `hooks-event-name-known`, and a handler field that it does not
// know is not checked here.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HANDLER_TYPES,
  type HandlerType,
  type HNode,
  HOOKS_TARGET,
  type HookSource,
  hooksListener,
  isHandlerType,
  type Loc,
  lastMembers,
  memberOf,
  quotedList,
} from '../hooks-config.ts'

const name = 'hooks-config-schema' as const

type MessageId =
  | 'fileNotObject'
  | 'hooksMissing'
  | 'unknownKey'
  | 'notObject'
  | 'eventNotArray'
  | 'groupNotObject'
  | 'matcherArray'
  | 'matcherArrayWholeFile'
  | 'matcherType'
  | 'handlersMissing'
  | 'handlerNotObject'
  | 'typeMissing'
  | 'typeInvalid'
  | 'fieldMissing'
  | 'fieldType'
  | 'fieldValue'

interface Problem {
  loc: Loc
  messageId: MessageId
  data?: Record<string, string>
}

/** The handler types, and the fields that each one needs (the hooks reference, "Hook handler
 *  fields"). */
const REQUIRED: Record<HandlerType, readonly string[]> = {
  command: ['command'],
  http: ['url'],
  mcp_tool: ['server', 'tool'],
  prompt: ['prompt'],
  agent: ['prompt'],
}

type Kind = 'string' | 'number' | 'boolean' | 'strings' | 'object'

/** The type of each handler field that has one. This rule does not check another field. */
const FIELDS = new Map<string, Kind>([
  ['if', 'string'],
  ['timeout', 'number'],
  ['statusMessage', 'string'],
  ['once', 'boolean'],
  ['command', 'string'],
  ['args', 'strings'],
  ['async', 'boolean'],
  ['asyncRewake', 'boolean'],
  ['url', 'string'],
  ['headers', 'object'],
  ['allowedEnvVars', 'strings'],
  ['server', 'string'],
  ['tool', 'string'],
  ['input', 'object'],
  ['prompt', 'string'],
  ['model', 'string'],
  ['continueOnBlock', 'boolean'],
])

/** The fields with a fixed set of values. `onFailure` needs Claude Code v2.1.295. */
const ENUMS = new Map([
  ['shell', ['bash', 'powershell']],
  ['onFailure', ['continue', 'block']],
])

const KIND_TEXT: Record<Kind, string> = {
  string: 'a string',
  number: 'a number',
  boolean: 'a boolean',
  strings: 'an array of strings',
  object: 'an object',
}

/** The top-level keys of a plugin `hooks.json` other than `hooks`. */
const FILE_KEYS = new Map<string, Kind>([
  ['description', 'string'],
  ['$schema', 'string'],
  ['modules', 'strings'],
])

/** The events where an array `matcher` also stops the other hooks of the file from loading. */
const WHOLE_FILE = ['PreToolUse', 'PermissionRequest']

function hasKind(kind: Kind, node: HNode): boolean {
  return kind === 'strings'
    ? node.kind === 'array' && node.items.every((item) => item.kind === 'string')
    : node.kind === kind
}

/** The problems with the field `key` of an object, when its value is of the wrong type. */
function typeProblems(key: string, kind: Kind, node: HNode): Problem[] {
  return hasKind(kind, node)
    ? []
    : [{ loc: node.loc, messageId: 'fieldType', data: { field: key, expected: KIND_TEXT[kind] } }]
}

function handlerProblems(handler: HNode): Problem[] {
  if (handler.kind !== 'object') {
    return [{ loc: handler.loc, messageId: 'handlerNotObject' }]
  }
  const problems: Problem[] = []
  const type = memberOf(handler, 'type')?.value
  if (type === undefined) {
    problems.push({ loc: handler.loc, messageId: 'typeMissing' })
  } else if (type.kind !== 'string' || !isHandlerType(type.value)) {
    problems.push({ loc: type.loc, messageId: 'typeInvalid' })
  } else {
    for (const field of REQUIRED[type.value]) {
      if (memberOf(handler, field) === undefined) {
        problems.push({
          loc: type.loc,
          messageId: 'fieldMissing',
          data: { type: type.value, field },
        })
      }
    }
  }
  for (const { key, value } of lastMembers(handler)) {
    const kind = FIELDS.get(key)
    const allowed = ENUMS.get(key)
    if (kind !== undefined) {
      problems.push(...typeProblems(key, kind, value))
    } else if (
      allowed !== undefined &&
      !(value.kind === 'string' && allowed.includes(value.value))
    ) {
      problems.push({
        loc: value.loc,
        messageId: 'fieldValue',
        data: { field: key, allowed: quotedList(allowed) },
      })
    }
  }
  return problems
}

function groupProblems(event: string, group: HNode): Problem[] {
  if (group.kind !== 'object') {
    return [{ loc: group.loc, messageId: 'groupNotObject' }]
  }
  const problems: Problem[] = []
  const matcher = memberOf(group, 'matcher')?.value
  if (matcher !== undefined && matcher.kind !== 'string') {
    const messageId =
      matcher.kind !== 'array'
        ? 'matcherType'
        : WHOLE_FILE.includes(event)
          ? 'matcherArrayWholeFile'
          : 'matcherArray'
    problems.push({ loc: matcher.loc, messageId })
  }
  const handlers = memberOf(group, 'hooks')?.value
  if (handlers?.kind !== 'array') {
    problems.push({ loc: handlers?.loc ?? group.loc, messageId: 'handlersMissing' })
    return problems
  }
  return [...problems, ...handlers.items.flatMap(handlerProblems)]
}

/** The problems with the `hooks` value. A `null` value removes the key, so it is no fault. */
function hooksProblems(hooks: HNode): Problem[] {
  if (hooks.kind === 'null') {
    return []
  }
  if (hooks.kind !== 'object') {
    return [{ loc: hooks.loc, messageId: 'notObject' }]
  }
  return lastMembers(hooks).flatMap(({ key: event, value: groups }) =>
    groups.kind === 'array'
      ? groups.items.flatMap((group) => groupProblems(event, group))
      : [{ loc: groups.loc, messageId: 'eventNotArray' as const, data: { event } }],
  )
}

/** The problems with the top level of a plugin `hooks.json`. */
function fileProblems(file: HNode): Problem[] {
  if (file.kind !== 'object') {
    return [{ loc: file.loc, messageId: 'fileNotObject' }]
  }
  const members = lastMembers(file)
  const problems: Problem[] = []
  for (const { key, keyLoc, value } of members) {
    const kind = FILE_KEYS.get(key)
    if (kind !== undefined) {
      problems.push(...typeProblems(key, kind, value))
    } else if (key !== 'hooks') {
      problems.push({ loc: keyLoc, messageId: 'unknownKey', data: { key } })
    }
  }
  if (!members.some(({ key }) => key === 'hooks' || key === 'modules')) {
    problems.push({ loc: file.loc, messageId: 'hooksMissing' })
  }
  return problems
}

function problemsOf(source: HookSource): Problem[] {
  const own = source.file === undefined ? [] : fileProblems(source.file)
  return [...own, ...(source.hooks === undefined ? [] : hooksProblems(source.hooks))]
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the hooks config as events, matcher groups and handlers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      fileNotObject: 'hooks.json must hold a JSON object with a "hooks" key.',
      hooksMissing:
        'hooks.json needs a top-level "hooks" key, or a "modules" key. Claude Code does not load an event map that has no "hooks" wrapper.',
      unknownKey:
        'hooks.json has the top-level key "{{key}}", which the docs do not list. The known keys are "hooks", "description", "$schema" and "modules".',
      notObject:
        'The "hooks" value must be an object that maps event names to arrays of matcher groups.',
      eventNotArray: 'The event "{{event}}" must hold an array of matcher groups.',
      groupNotObject: 'A matcher group must be an object with a "hooks" array.',
      matcherArray:
        'The "matcher" is an array. Claude Code lists the entry as an invalid setting. Write one string, such as "Edit|Write".',
      matcherArrayWholeFile:
        'The "matcher" is an array. Claude Code lists the entry as an invalid setting, and loads none of the other hooks of this file. Write one string, such as "Edit|Write".',
      matcherType: 'The "matcher" must be a string.',
      handlersMissing: 'A matcher group needs a "hooks" array of handlers.',
      handlerNotObject: 'A hook handler must be an object with a "type".',
      typeMissing: 'A hook handler needs a "type".',
      typeInvalid: `The hook "type" must be one of ${quotedList(HANDLER_TYPES)}.`,
      fieldMissing: 'The "{{type}}" hook type needs the field "{{field}}".',
      fieldType: 'The "{{field}}" field must be {{expected}}.',
      fieldValue: 'The "{{field}}" field must be one of {{allowed}}.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const problem of problemsOf(source)) {
        context.report(problem)
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
