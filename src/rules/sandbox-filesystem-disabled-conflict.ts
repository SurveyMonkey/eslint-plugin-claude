// `sandbox.filesystem.disabled: true` switches filesystem isolation off, so Claude Code does not
// enforce `filesystem.denyRead` or a `deny` entry of `credentials.files`
// (docs/rules/sandbox-filesystem-disabled-conflict.md). Only user settings, managed settings and
// `--settings` can set the key. A project or local file cannot, so its `denyRead` stays in force
// and there is no conflict. The rule reads the managed files. `settings-key-scope` reports the
// key in a project file.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-filesystem-disabled-conflict' as const

type MessageId = 'conflict'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set sandbox.filesystem.disabled with entries that it switches off',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      conflict:
        '"sandbox.filesystem.disabled" is on, so Claude Code does not enforce {{entries}} of this file. Remove "disabled", or remove the entries.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(node) {
        const disabled = valueAt(node, ['sandbox', 'filesystem', 'disabled'])
        // A quoted Boolean in a managed `sandbox` block counts as that Boolean.
        const isOn =
          (disabled?.type === 'Boolean' && disabled.value) ||
          (disabled?.type === 'String' && disabled.value === 'true')
        if (disabled === undefined || !isOn) {
          return
        }
        const entries: string[] = []
        if (stringEntries(valueAt(node, ['sandbox', 'filesystem', 'denyRead'])).length > 0) {
          entries.push('the `filesystem.denyRead` entries')
        }
        const files = valueAt(node, ['sandbox', 'credentials', 'files'])
        const hasDeny =
          files?.type === 'Array' &&
          files.elements.some((element) => {
            const mode = lastMember(element.value, 'mode')?.value
            return mode?.type === 'String' && mode.value === 'deny'
          })
        if (hasDeny) {
          entries.push('the `credentials.files` entries with `"mode": "deny"`')
        }
        if (entries.length > 0) {
          context.report({
            node: disabled,
            messageId: 'conflict',
            data: { entries: entries.join(' and ') },
          })
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
