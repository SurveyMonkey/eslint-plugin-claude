// `disableClaudeAiConnectors: false` in a managed settings file
// (docs/rules/mcp-disable-connectors-false.md). The value is the same as unset. A `true` in any
// settings file applies, and a `false` cannot turn the connectors back on. The rule
// `settings-project-value-ignored` reports the same value in the two project files, so this rule
// reads the managed files only. The managed settings page merges `managed-settings.json` and the
// drop-ins into one source, and a later file replaces a single value of an earlier one. So a
// `false` after a `true` in a sibling file changes the value. A `false` before a `true` is
// replaced. The rule does not model the order, and makes no report when any sibling holds `true`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'mcp-disable-connectors-false' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unset' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set disableClaudeAiConnectors to false in a managed settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unset:
        'The value false for "disableClaudeAiConnectors" is the same as unset. It cannot turn the connectors back on after a true in another file. Remove the key.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const value = lastMember(node.body, 'disableClaudeAiConnectors')?.value
        if (value?.type !== 'Boolean' || value.value) {
          return
        }
        // A sibling that cannot be read can hold the `true`, so the rule stays silent.
        const siblings = readManagedSource(context.filename)
        if (siblings === UNREADABLE || siblings.some((s) => s.disableClaudeAiConnectors === true)) {
          return
        }
        context.report({ node: value, messageId: 'unset' })
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
