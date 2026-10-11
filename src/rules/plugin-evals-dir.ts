// `experimental.evals` of the manifest names the eval directory of a plugin. The docs accept a
// relative path of plain directory names. For any other value, `claude plugin eval` prints a
// `Warning:` line and uses `evals/` (docs/rules/plugin-evals-dir.md). The rule reads the manifest
// only. The test is `isEvalDirPath` in `src/plugin-evals.ts`, which `plugin-evals-results-gitignored`
// shares.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isEvalDirPath } from '../plugin-evals.ts'

const name = 'plugin-evals-dir' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unusable' | 'notString' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write experimental.evals as a relative path of plain directory names',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unusable:
        'Claude Code does not use {{value}} as the eval directory. It prints a warning and uses "evals/". Write a relative path of plain directory names, such as "qa" or "quality/evals".',
      notString:
        'The value of `experimental.evals` must be a string. Claude Code prints a warning and uses "evals/". Write a relative path of plain directory names, such as "qa" or "quality/evals".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const value = lastMember(lastMember(node.body, 'experimental')?.value, 'evals')?.value
        if (value === undefined) {
          return
        }
        if (value.type !== 'String') {
          context.report({ node: value, messageId: 'notString' })
        } else if (!isEvalDirPath(value.value)) {
          // The message shows the value as the user writes it in the JSON file.
          context.report({
            node: value,
            messageId: 'unusable',
            data: { value: JSON.stringify(value.value) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
