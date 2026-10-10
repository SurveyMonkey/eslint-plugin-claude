// `permissions.defaultMode: "bypassPermissions"` in a committed settings file
// (docs/rules/permissions-bypass-mode-committed.md). Claude Code v2.1.257 and later ignores it
// in a project or local file, and the session starts in Manual mode. Earlier versions honor it.
// In a managed file it starts every session with no prompt. Allow rules have no effect in the
// mode. A file that also locks the mode with `disableBypassPermissionsMode: "disable"` is for
// `permissions-default-mode-conflict`, so one fault gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bypass-mode-committed' as const

type MessageId = 'project' | 'managed'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not commit permissions.defaultMode: "bypassPermissions"',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      project:
        '"defaultMode": "bypassPermissions" has no effect in a project or local settings file since Claude Code v2.1.257: the session starts in Manual mode. Earlier versions honor it and skip every permission check.{{allowNote}} Remove it.',
      managed:
        '"defaultMode": "bypassPermissions" runs every tool call without a prompt. Deny rules still apply.{{allowNote}}',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const messageId = kindOf(context.filename) === 'managed' ? 'managed' : 'project'
    return {
      Document(node) {
        const permissions = lastMember(node.body, 'permissions')?.value
        const value = lastMember(permissions, 'defaultMode')?.value
        if (value?.type !== 'String' || value.value !== 'bypassPermissions') {
          return
        }
        const lock = lastMember(permissions, 'disableBypassPermissionsMode')?.value
        if (lock?.type === 'String' && lock.value === 'disable') {
          return
        }
        const allow = lastMember(permissions, 'allow')?.value
        const allowNote =
          allow?.type === 'Array' && allow.elements.length > 0
            ? ' The allow rules of this file have no effect in that mode.'
            : ''
        context.report({ node: value, messageId, data: { allowNote } })
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
