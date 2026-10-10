// `managedSourcesBehavior: "merge"` in a drop-in of `managed-settings.d/`
// (docs/rules/settings-managed-merge.md). The settings reference says that Claude Code reads the
// key from the highest-priority source that carries it or a policy key, and that a file in
// `managed-settings.d/` belongs to the file source, which ranks below server-managed settings and
// MDM. So the key in a drop-in combines nothing, and the managed settings page says that `merge`
// adds the lower sources to the policy. `settings-managed-file` owns the same key in
// `managed-settings.json`, so the rule reads drop-ins only. It reads no other file.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isDropIn, isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-managed-merge' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'merge' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set managedSourcesBehavior in the highest-priority managed source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      merge:
        '"managedSourcesBehavior" is "merge" in a drop-in of "managed-settings.d". Claude Code reads the key from the highest-priority managed source, and the file source ranks below server-managed settings and MDM. Set the key in the highest source that you deploy.',
    },
  },
  create(context) {
    if (!isDropIn(context.filename) || isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const value = lastMember(node.body, 'managedSourcesBehavior')?.value
        if (value?.type === 'String' && value.value === 'merge') {
          context.report({ node: value, messageId: 'merge' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
  rule,
}
