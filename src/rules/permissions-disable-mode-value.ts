// The lock keys `permissions.disableBypassPermissionsMode`, `permissions.disableAutoMode` and
// `disableAutoMode` take the string "disable" (docs/rules/permissions-disable-mode-value.md).
// Claude Code rejects `true` and any other value. In managed settings it reads the lock as
// "disable" instead.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-disable-mode-value' as const

type MessageId = 'invalid' | 'invalidManaged'

/** The places of a lock: the path of the object that holds the key, and the key. */
const LOCKS: readonly (readonly [parent: readonly string[], key: string])[] = [
  [['permissions'], 'disableBypassPermissionsMode'],
  [['permissions'], 'disableAutoMode'],
  [[], 'disableAutoMode'],
]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set a permission mode lock to the string "disable"',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      invalid:
        '"{{key}}" must be the string "disable". Claude Code rejects any other value, such as true.',
      invalidManaged:
        '"{{key}}" must be the string "disable". In managed settings, Claude Code reads any other value as "disable".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const messageId = kindOf(context.filename) === 'managed' ? 'invalidManaged' : 'invalid'
    return {
      Document(node) {
        for (const [parent, key] of LOCKS) {
          const holder = parent.reduce<typeof node.body | undefined>(
            (object, step) => lastMember(object, step)?.value,
            node.body,
          )
          const value = lastMember(holder, key)?.value
          if (
            value !== undefined &&
            value.type !== 'Null' &&
            !(value.type === 'String' && value.value === 'disable')
          ) {
            context.report({ node: value, messageId, data: { key: [...parent, key].join('.') } })
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
