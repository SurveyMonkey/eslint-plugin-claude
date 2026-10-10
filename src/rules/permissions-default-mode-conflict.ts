// `permissions.defaultMode: "bypassPermissions"` in a file that also sets
// `permissions.disableBypassPermissionsMode: "disable"`
// (docs/rules/permissions-default-mode-conflict.md). The lock stops anyone from entering the
// mode, so the session never starts in it. The pair of `disableAutoMode` with
// `defaultMode: "auto"` is for `settings-conflicting-keys`. Within a managed source, the later
// file replaces a single value of an earlier file. So a sibling file that sets `defaultMode` or
// the lock again can change the outcome, and the rule makes no report then.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'permissions-default-mode-conflict' as const

/** True when the parsed settings object `fields` sets `permissions.defaultMode` or the lock. */
function setsPair(fields: Record<string, unknown>): boolean {
  const { permissions } = fields
  return (
    typeof permissions === 'object' &&
    permissions !== null &&
    ('defaultMode' in permissions || 'disableBypassPermissionsMode' in permissions)
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'bypass' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not set permissions.defaultMode to bypassPermissions while the mode is locked',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bypass:
        '"defaultMode": "bypassPermissions" has no effect while "disableBypassPermissionsMode" is "disable". Claude Code never enters the mode.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const permissions = lastMember(node.body, 'permissions')?.value
        const mode = lastMember(permissions, 'defaultMode')
        const lock = lastMember(permissions, 'disableBypassPermissionsMode')?.value
        if (
          mode?.value.type !== 'String' ||
          mode.value.value !== 'bypassPermissions' ||
          lock?.type !== 'String' ||
          lock.value !== 'disable'
        ) {
          return
        }
        if (isManaged) {
          // A sibling that the rule cannot read can set a key of the pair again.
          const siblings = readManagedSource(context.filename)
          if (siblings === UNREADABLE || siblings.some(setsPair)) {
            return
          }
        }
        context.report({ node: mode.name, messageId: 'bypass' })
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
