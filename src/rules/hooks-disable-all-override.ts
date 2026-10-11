// `"disableAllHooks": false` in the committed `.claude/settings.json` (docs/rules/hooks-disable-all-override.md).
// Claude Code reads the value that is left after settings precedence. The project file is above the
// user file. So the committed `false` overrides a `true` in the user settings of each person who
// clones the repository, and turns their hooks back on. The local file is the person's own. A managed
// file is the policy of the administrator. The rule reads neither.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { kindOf } from '../settings-files.ts'

const name = 'hooks-disable-all-override' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'override' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set disableAllHooks to false in the committed project settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      override:
        'The committed "disableAllHooks": false overrides the user setting of each person who clones the repository, and turns their hooks back on. Remove the key.',
    },
  },
  create(context) {
    if (
      path.basename(context.filename) !== 'settings.json' ||
      kindOf(context.filename) !== 'project'
    ) {
      return {}
    }
    return {
      Document(node) {
        const value = lastMember(node.body, 'disableAllHooks')?.value
        if (value?.type === 'Boolean' && !value.value) {
          context.report({ node: value, messageId: 'override' })
        }
      },
    }
  },
}

export default { name, language: 'json' as const, files: ['**/.claude/settings.json'], rule }
