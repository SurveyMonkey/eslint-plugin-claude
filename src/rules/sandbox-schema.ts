// The keys inside `sandbox` and their types (docs/rules/sandbox-schema.md). This rule owns every
// key under `sandbox`, so `settings-schema` makes no report inside it. The names of the keys
// are in `src/data/settings-keys.ts`, and the type of each is in `src/data/sandbox-keys.ts`. The
// scope of a key is for `settings-key-scope`. The content of a domain, a command or a path is
// for the rules of that content.
import type { JSONRuleDefinition } from '@eslint/json'
import { ENV_NAME, SANDBOX_SHAPES, type Shape } from '../data/sandbox-keys.ts'
import { hasListedChildren, listedChildren } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { withheldNote } from '../permission-sandbox.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-schema' as const

type MessageId =
  | 'unknownKey'
  | 'wrongType'
  | 'badValue'
  | 'badPort'
  | 'relativePath'
  | 'machWildcard'
  | 'badName'
  | 'missingField'

/** What a value of each type is called in a message. */
const EXPECTED = {
  boolean: 'true or false',
  string: 'a string',
  strings: 'an array of strings',
  machNames: 'an array of strings',
  absolutePath: 'a string',
  port: 'a number',
  envName: 'a string',
  violations: 'an object',
  list: 'an array of objects',
  object: 'an object',
} as const

const STRINGS: Shape = { type: 'strings' }
const OBJECT: Shape = { type: 'object' }

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use only the documented keys in sandbox, each with a value of its type',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknownKey: '"{{key}}" is not a key of the sandbox settings. Claude Code does not read it.',
      wrongType: '"{{key}}" must be {{expected}}.{{note}}',
      badValue: '"{{key}}" must be one of {{values}}.{{note}}',
      badPort: '"{{key}}" must be a whole number from 1 to 65535, a TCP port.',
      relativePath:
        '"{{key}}" must be an absolute path. Claude Code drops `{{value}}` and finds the binary on PATH.',
      machWildcard:
        '`{{value}}` in "{{key}}" has a `*` that does not end the name. Only a trailing `*` matches a prefix, and `*` alone matches every service.',
      badName:
        '"{{key}}" must start with a letter or an underscore, and hold letters, digits and underscores only.',
      missingField: '"{{key}}" needs "{{field}}".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'

    /** Check `node` against `shape`. `key` names the value in a message, and `note` is the text
     *  that a managed file adds. */
    function check(shape: Shape, node: ValueNode, key: string, note: string): void {
      const wrongType = (expected: string) =>
        context.report({ node, messageId: 'wrongType', data: { key, expected, note } })
      switch (shape.type) {
        case 'boolean': {
          // Claude Code reads a quoted Boolean in a managed `sandbox` block as that Boolean.
          const quoted =
            isManaged && node.type === 'String' && (node.value === 'true' || node.value === 'false')
          if (node.type !== 'Boolean' && !quoted) {
            wrongType(EXPECTED.boolean)
          }
          break
        }
        case 'string':
          if (node.type !== 'String') {
            wrongType(EXPECTED.string)
          }
          break
        case 'strings':
        case 'machNames':
          if (node.type !== 'Array') {
            wrongType(EXPECTED[shape.type])
            break
          }
          node.elements.forEach(({ value }, index) => {
            const entryKey = `${key}[${index}]`
            if (value.type !== 'String') {
              context.report({
                node: value,
                messageId: 'wrongType',
                data: { key: entryKey, expected: EXPECTED.string, note },
              })
              return
            }
            const stars = value.value.split('*').length - 1
            if (
              shape.type === 'machNames' &&
              (stars > 1 || (stars === 1 && !value.value.endsWith('*')))
            ) {
              context.report({
                node: value,
                messageId: 'machWildcard',
                data: { key, value: value.value },
              })
            }
          })
          break
        case 'absolutePath':
          if (node.type !== 'String') {
            wrongType(EXPECTED.absolutePath)
          } else if (!node.value.startsWith('/')) {
            context.report({ node, messageId: 'relativePath', data: { key, value: node.value } })
          }
          break
        case 'port':
          if (node.type !== 'Number') {
            wrongType(EXPECTED.port)
          } else if (!Number.isInteger(node.value) || node.value < 1 || node.value > 65535) {
            context.report({ node, messageId: 'badPort', data: { key } })
          }
          break
        case 'enum':
          if (node.type !== 'String' || !shape.values.includes(node.value)) {
            context.report({
              node,
              messageId: 'badValue',
              data: { key, values: shape.values.map((value) => `"${value}"`).join(', '), note },
            })
          }
          break
        case 'envName':
          if (node.type !== 'String') {
            wrongType(EXPECTED.envName)
          } else if (!ENV_NAME.test(node.value)) {
            context.report({ node, messageId: 'badName', data: { key } })
          }
          break
        case 'violations':
          if (node.type !== 'Object') {
            wrongType(EXPECTED.violations)
            break
          }
          checkMembers(
            node,
            (member) => ({ shape: STRINGS, key: `${key}.${keyOf(member.name)}` }),
            note,
          )
          break
        case 'list':
          if (node.type !== 'Array') {
            wrongType(EXPECTED.list)
            break
          }
          node.elements.forEach(({ value }, index) => {
            check(shape.item, value, `${key}[${index}]`, note)
          })
          break
        case 'object':
          if (node.type !== 'Object') {
            wrongType(EXPECTED.object)
            break
          }
          checkMembers(
            node,
            (member) => {
              const field = shape.fields?.[keyOf(member.name)]
              return field && { shape: field, key: `${key}.${keyOf(member.name)}` }
            },
            note,
          )
          for (const field of shape.required ?? []) {
            const present = lastMember(node, field)?.value
            if (present === undefined || present.type === 'Null') {
              context.report({ node, messageId: 'missingField', data: { key, field } })
            }
          }
          break
      }
    }

    /** Check the last member of each name of `object`. `pick` gives the shape and the name of a
     *  member, or nothing for a member that the rule does not read. A `null` removes the key. */
    function checkMembers(
      object: ObjectNode,
      pick: (member: ObjectNode['members'][number]) => { shape: Shape; key: string } | undefined,
      note: string,
    ): void {
      for (const member of object.members) {
        const picked = pick(member)
        // Two keys of one name: the last counts, as in `JSON.parse`.
        if (
          picked !== undefined &&
          member.value.type !== 'Null' &&
          lastMember(object, keyOf(member.name)) === member
        ) {
          check(picked.shape, member.value, picked.key, note)
        }
      }
    }

    /** Check the keys of `object`, the value at `path` below the top level. A key that the index
     *  does not list below `path` is unknown. */
    function checkLevel(object: ObjectNode, path: readonly string[]): void {
      const known = listedChildren(path)
      for (const member of object.members) {
        const key = keyOf(member.name)
        if (lastMember(object, key) !== member) {
          continue
        }
        const child = [...path, key]
        const dotted = child.join('.')
        if (!known.includes(key)) {
          context.report({ node: member.name, messageId: 'unknownKey', data: { key: dotted } })
          continue
        }
        const value = member.value
        if (value.type === 'Null') {
          continue
        }
        // `tests/data/sandbox-keys.test.ts` checks that every listed key has a type.
        const note = isManaged ? withheldNote(dotted) : ''
        check(SANDBOX_SHAPES[dotted] as Shape, value, dotted, note)
        if (value.type === 'Object' && hasListedChildren(child)) {
          checkLevel(value, child)
        }
      }
    }

    return {
      Document(node) {
        const value = lastMember(node.body, 'sandbox')?.value
        if (value === undefined || value.type === 'Null') {
          return
        }
        check(OBJECT, value, 'sandbox', '')
        if (value.type === 'Object') {
          checkLevel(value, ['sandbox'])
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
