// `permissions.defaultMode` takes one of seven modes
// (docs/rules/permissions-default-mode-value.md). Claude Code rejects another value. In
// managed settings it reads the key as `default` instead.
import type { JSONRuleDefinition } from '@eslint/json'
import { PERMISSION_MODES } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-default-mode-value' as const

type MessageId = 'invalid' | 'invalidManaged'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set permissions.defaultMode to a permission mode that Claude Code knows',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      invalid: '"defaultMode" must be one of: {{modes}}. Claude Code rejects any other value.',
      invalidManaged:
        '"defaultMode" must be one of: {{modes}}. In managed settings, Claude Code reads it as "default".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const messageId = kindOf(context.filename) === 'managed' ? 'invalidManaged' : 'invalid'
    return {
      Document(node) {
        const member = lastMember(lastMember(node.body, 'permissions')?.value, 'defaultMode')
        const value = member?.value
        if (
          value === undefined ||
          value.type === 'Null' ||
          (value.type === 'String' && PERMISSION_MODES.includes(value.value))
        ) {
          return
        }
        context.report({ node: value, messageId, data: { modes: PERMISSION_MODES.join(', ') } })
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
