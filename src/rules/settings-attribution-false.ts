// `attribution: false` in a project or local settings file
// (docs/rules/settings-attribution-false.md). The settings reference says that Claude Code
// before v2.1.281 rejects the value and skips the whole file. It names the user, project and
// local files, and not managed settings. The rule has no option for the version of Claude Code,
// because the row names none.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-attribution-false' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'older' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set attribution to false in a file that an older Claude Code also reads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      older:
        'Claude Code before v2.1.281 rejects "attribution": false and skips this whole file. Use { "commit": "", "pr": "", "sessionUrl": false }.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const value = lastMember(node.body, 'attribution')?.value
        if (value?.type === 'Boolean' && !value.value) {
          context.report({ node: value, messageId: 'older' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
