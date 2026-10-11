// The keys inside `permissions` and their types (docs/rules/permissions-schema.md). This rule
// owns the keys inside `permissions`, so `settings-schema` makes no report there. The values of
// `defaultMode` and of the lock keys are for `permissions-default-mode-value` and
// `permissions-disable-mode-value`. A NUL byte in an entry is for `permissions-rule-syntax`.
import type { JSONRuleDefinition } from '@eslint/json'
import { isPermissionsKey } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-schema' as const

type MessageId = 'unknownKey' | 'notArray' | 'listWithheld' | 'notString' | 'notBoolean'

/** The keys that hold an array of strings. */
const LISTS = ['allow', 'ask', 'deny', 'additionalDirectories']

/** The lists whose failure makes Claude Code withhold `allow` and `additionalDirectories` in a
 *  managed file. */
const RESTRICTIONS = ['deny', 'ask']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use only the documented keys in permissions, each with a value of its type',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknownKey: '"{{key}}" is not a key of "permissions". Claude Code does not read it.',
      notArray: '"{{key}}" must be an array of strings. Claude Code rejects any other value.',
      listWithheld:
        '"{{key}}" must be an array of strings. Claude Code cannot read this list, so it withholds "allow" and "additionalDirectories" in managed settings.',
      notString: 'Each entry of "{{key}}" must be a string.',
      notBoolean: '"{{key}}" must be true or false.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'

    /** Check the member `key` of `permissions`, whose last value is `value`. */
    function checkValue(key: string, value: ObjectNode['members'][number]['value']): void {
      if (value.type === 'Null') {
        return
      }
      if (LISTS.includes(key)) {
        if (value.type !== 'Array') {
          const withheld = isManaged && RESTRICTIONS.includes(key)
          context.report({
            node: value,
            messageId: withheld ? 'listWithheld' : 'notArray',
            data: { key },
          })
          return
        }
        for (const { value: entry } of value.elements) {
          if (entry.type !== 'String') {
            context.report({ node: entry, messageId: 'notString', data: { key } })
          }
        }
      } else if (key === 'blockReadsOutsideWorkingDirectories' && value.type !== 'Boolean') {
        context.report({ node: value, messageId: 'notBoolean', data: { key } })
      }
    }

    return {
      Document(node) {
        const permissions = lastMember(node.body, 'permissions')?.value
        if (permissions?.type !== 'Object') {
          return
        }
        for (const member of permissions.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(permissions, key) !== member) {
            continue
          }
          if (isPermissionsKey(key)) {
            checkValue(key, member.value)
          } else {
            context.report({ node: member.name, messageId: 'unknownKey', data: { key } })
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
