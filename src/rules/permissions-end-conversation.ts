// A deny or ask rule that names `EndConversation` has no effect while any
// other tool remains: the tool never prompts, and a deny rule cannot remove it
// (docs/rules/permissions-end-conversation.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-end-conversation' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'noEffect' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not name EndConversation in a deny or ask rule',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noEffect:
        'A {{list}} rule that names `EndConversation` has no effect while any other tool remains. The tool never prompts, and a deny rule cannot remove it. Remove the rule.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      // A rule with a specifier is for `permissions-specifier-unsupported`, and a glob such as
      // `*` can remove the tool when no other tool remains.
      for (const { list, loc, rule: parsed } of entries) {
        if (list !== 'allow' && parsed.tool === 'EndConversation' && parsed.specifier === null) {
          context.report({ loc, messageId: 'noEffect', data: { list } })
        }
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
