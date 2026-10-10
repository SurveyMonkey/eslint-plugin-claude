// `blockReadsOutsideWorkingDirectories: false` is the same as unset. A `true` in any other file
// still applies (docs/rules/permissions-block-reads-false.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-block-reads-false' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'sameAsUnset' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set blockReadsOutsideWorkingDirectories to false',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      sameAsUnset:
        '`false` is the same as unset. It cannot lift a `true` that another file sets. Remove the key.',
    },
  },
  create(context) {
    return settingsListener(context, (_entries, document) => {
      const permissions = lastMember(document.body, 'permissions')?.value
      const value = lastMember(permissions, 'blockReadsOutsideWorkingDirectories')?.value
      if (value?.type === 'Boolean' && !value.value) {
        context.report({ loc: value.loc, messageId: 'sameAsUnset' })
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
