// The keys and values of a settings file (docs/rules/settings-schema.md). The key catalog is
// `src/data/settings-keys.ts`. The value of each key is in `src/data/settings-schema.ts`. The rule
// makes no report inside `permissions` or `sandbox`: the permissions group owns them. It checks no
// value that another rule checks, and the data says which keys these are. A `null` is no value.
import type { JSONRuleDefinition } from '@eslint/json'
import { hasListedChildren, settingsKeyScope } from '../data/settings-keys.ts'
import {
  ENV_NAME_FORM,
  NOT_UNKNOWN_KEYS,
  SETTINGS_VALUES,
  type ValueSpec,
} from '../data/settings-schema.ts'
import { docsUrl } from '../docs-url.ts'
import {
  keyOf,
  lastMember,
  type MemberNode,
  type ObjectNode,
  type ValueNode,
} from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-schema' as const

type MessageId =
  | 'unknownKey'
  | 'envKey'
  | 'wrongType'
  | 'notOneOf'
  | 'outOfRange'
  | 'badFormat'
  | 'missingField'

/** A fault, before it is reported. */
interface Fault {
  node: ValueNode | MemberNode['name']
  messageId: MessageId
  data: Record<string, string>
}

const NODE_TYPES = {
  any: 'Any',
  boolean: 'Boolean',
  string: 'String',
  number: 'Number',
  array: 'Array',
  object: 'Object',
  map: 'Object',
} as const

/** The node types that `spec` accepts. */
function nodeTypes(spec: ValueSpec): readonly string[] {
  switch (spec.kind) {
    case 'literal':
      return [NODE_TYPES[typeof spec.value as 'boolean' | 'string' | 'number']]
    case 'anyOf':
      return spec.options.flatMap(nodeTypes)
    default:
      return [NODE_TYPES[spec.kind]]
  }
}

/** The range of a number spec, to finish the sentence "must be ...". */
function describeNumber(spec: Extract<ValueSpec, { kind: 'number' }>): string {
  const noun = spec.integer ? 'a whole number' : 'a number'
  if ('above' in spec) {
    return `${noun} above ${spec.above} and at most ${spec.max}`
  }
  return spec.max === undefined
    ? `${noun} of at least ${spec.min}`
    : `${noun} from ${spec.min} to ${spec.max}`
}

/** What `spec` takes, to finish the sentence "must be ...". */
function describe(spec: ValueSpec): string {
  switch (spec.kind) {
    case 'boolean':
      return 'a Boolean'
    case 'literal':
      return JSON.stringify(spec.value)
    case 'anyOf':
      return spec.options.map(describe).join(' or ')
    case 'array':
      return 'an array'
    case 'object':
    case 'map':
      return 'an object'
    case 'number':
      return describeNumber(spec)
    default:
      return (spec.kind === 'string' && spec.form?.expected) || 'a string'
  }
}

/** The members of `object` that count: of two keys of one name, the last, as in `JSON.parse`. */
const countedMembers = (object: ObjectNode): MemberNode[] =>
  object.members.filter((member) => lastMember(object, keyOf(member.name)) === member)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set only the settings keys that Claude Code knows, with the values it accepts',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknownKey: 'Claude Code has no settings key "{{key}}".',
      envKey: '"{{key}}" is an environment variable name. Set it in "env", not at the top level.',
      wrongType: 'The value of "{{key}}" must be {{expected}}.',
      notOneOf: 'The value of "{{key}}" must be {{expected}}.',
      outOfRange: 'The value of "{{key}}" must be {{expected}}.',
      badFormat: 'The value of "{{key}}" must be {{expected}}.',
      missingField: '"{{key}}" needs the field "{{field}}".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }

    /** Check the value `node` against `spec`, and add each fault to `out`. `key` is the path of
     *  the value, for the message. */
    function check(node: ValueNode, spec: ValueSpec, key: string, out: Fault[]): void {
      if (spec.kind === 'any' || node.type === 'Null') {
        return
      }
      const fault = (at: Fault['node'], messageId: MessageId, expected: string) =>
        out.push({ node: at, messageId, data: { key, expected } })
      if (!nodeTypes(spec).includes(node.type)) {
        fault(node, 'wrongType', describe(spec))
      } else if (spec.kind === 'anyOf') {
        // The options that take this node type. The value fits if one of them has no fault.
        const options = spec.options.filter((option) => nodeTypes(option).includes(node.type))
        const attempts = options.map((option) => {
          const found: Fault[] = []
          check(node, option, key, found)
          return found
        })
        if (!attempts.some((found) => found.length === 0)) {
          if (options.length === 1) {
            out.push(...(attempts[0] as Fault[]))
          } else {
            fault(node, 'notOneOf', options.map(describe).join(' or '))
          }
        }
      } else if (spec.kind === 'literal') {
        if ((node as { value?: unknown }).value !== spec.value) {
          fault(node, 'notOneOf', describe(spec))
        }
      } else if (spec.kind === 'string' && node.type === 'String') {
        const { form, maxLength } = spec
        if (form && !(form.oneOf?.includes(node.value) || form.pattern?.test(node.value))) {
          fault(node, form.oneOf === undefined ? 'badFormat' : 'notOneOf', form.expected)
        } else if (maxLength !== undefined && node.value.length > maxLength) {
          fault(node, 'outOfRange', `a string of at most ${maxLength} characters`)
        }
      } else if (spec.kind === 'number' && node.type === 'Number') {
        const { value } = node
        const low = 'above' in spec ? value <= spec.above : value < spec.min
        if (
          (spec.integer && !Number.isInteger(value)) ||
          low ||
          (spec.max !== undefined && value > spec.max)
        ) {
          fault(node, 'outOfRange', describeNumber(spec))
        }
      } else if (spec.kind === 'array' && node.type === 'Array') {
        if (spec.maxItems !== undefined && node.elements.length > spec.maxItems) {
          fault(node, 'outOfRange', `an array of at most ${spec.maxItems} entries`)
        }
        node.elements.forEach((element, index) => {
          check(element.value, spec.items, `${key}[${index}]`, out)
        })
      } else if (spec.kind === 'object' && node.type === 'Object') {
        for (const member of countedMembers(node)) {
          const field = keyOf(member.name)
          if (Object.hasOwn(spec.fields, field)) {
            check(member.value, spec.fields[field] as ValueSpec, `${key}.${field}`, out)
          } else {
            out.push({
              node: member.name,
              messageId: 'unknownKey',
              data: { key: `${key}.${field}` },
            })
          }
        }
        for (const field of spec.required ?? []) {
          if ((lastMember(node, field)?.value.type ?? 'Null') === 'Null') {
            out.push({ node, messageId: 'missingField', data: { key, field } })
          }
        }
      } else if (spec.kind === 'map' && node.type === 'Object') {
        for (const member of countedMembers(node)) {
          const field = keyOf(member.name)
          if (spec.keyPattern?.test(field) === false) {
            out.push({
              node: member.name,
              messageId: 'badFormat',
              data: { key: `${key}.${field}`, expected: spec.keyExpected as string },
            })
          }
          check(member.value, spec.values, `${key}.${field}`, out)
        }
      }
    }

    return {
      Document(document) {
        if (document.body.type !== 'Object') {
          return
        }
        for (const member of countedMembers(document.body)) {
          const key = keyOf(member.name)
          if (NOT_UNKNOWN_KEYS.includes(key)) {
            continue
          }
          if (settingsKeyScope([key]) === undefined && !hasListedChildren([key])) {
            context.report({
              node: member.name,
              messageId: ENV_NAME_FORM.test(key) ? 'envKey' : 'unknownKey',
              data: { key },
            })
          } else if (Object.hasOwn(SETTINGS_VALUES, key)) {
            const faults: Fault[] = []
            check(member.value, SETTINGS_VALUES[key] as ValueSpec, key, faults)
            for (const { node, messageId, data } of faults) {
              context.report({ node, messageId, data })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
