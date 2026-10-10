// The key `permissions.deny` replaces the deprecated `ignorePatterns` configuration
// (docs/rules/permissions-ignore-patterns.md). The settings reference does not say that Claude
// Code ignores the key, so the message says deprecated and no more. `settings-schema` skips the
// key, so no other rule reports it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-ignore-patterns' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'deprecated' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use permissions.deny Read rules in place of the deprecated ignorePatterns',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      deprecated:
        '"ignorePatterns" is deprecated. "permissions.deny" replaces it: write a `Read(...)` rule for each pattern.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const member = lastMember(node.body, 'ignorePatterns')
        if (member !== undefined) {
          context.report({ node: member.name, messageId: 'deprecated' })
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
