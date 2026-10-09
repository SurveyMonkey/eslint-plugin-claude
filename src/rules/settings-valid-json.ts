// The top level of a project settings file (docs/rules/settings-valid-json.md).
// The `json/json` language already stops on a comment and on a trailing comma
// with a parse error, so this rule adds the check of the top-level value only.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-valid-json' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'notObject' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the top level of a settings file as a JSON object',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        'Claude Code rejects a settings file whose top level is not a JSON object. The top-level value has the type {{type}}.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const { body } = node
        if (body.type !== 'Object') {
          context.report({
            node: body,
            messageId: 'notObject',
            data: { type: body.type },
          })
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
