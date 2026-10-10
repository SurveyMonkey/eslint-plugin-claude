// `autoContinueAtUsageLimit` (docs/rules/settings-project-autocontinue-off.md). The settings
// reference gives the scope "User or managed". Suppose user, `--settings` and managed settings
// leave the key unset. A project or local file that sets it then turns the feature off. Claude
// Code does not ignore the file. `settings-key-scope` skips the key, and `settings-schema` checks no type for it. So
// this rule checks the type in every file that it reads, a managed file too.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-project-autocontinue-off' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'turnsOff' | 'wrongType' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set autoContinueAtUsageLimit in a project or local settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      turnsOff:
        'A project or local file that sets "autoContinueAtUsageLimit" turns automatic continue off for everyone whose user and managed settings leave the key unset. Remove the key from this file.',
      wrongType: 'The value of "autoContinueAtUsageLimit" must be a Boolean.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const value = lastMember(node.body, 'autoContinueAtUsageLimit')?.value
        // A `null` is no value.
        if (value === undefined || value.type === 'Null') {
          return
        }
        if (value.type !== 'Boolean') {
          context.report({ node: value, messageId: 'wrongType' })
        } else if (!isManaged) {
          context.report({ node: value, messageId: 'turnsOff' })
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
