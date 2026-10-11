// A managed `autoMode.soft_deny` entry is not a hard policy boundary: inside the classifier, an
// `allow` entry of a developer is an exception to a `soft_deny` entry, and a direct request of the
// user can clear one (docs/rules/permissions-auto-mode-allow-overrides.md). A heuristic. A file
// does not show what the author means, so the rule reads the wording of an entry that states a
// rule without exception (`never`, `must not`, `under no circumstances`, `no exceptions`). The
// docs use `Never` in a `soft_deny` example, so the rule is noisy by design and `off`. The
// classifier reads `autoMode` from managed settings and not from the two project files.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-allow-overrides' as const

const ABSOLUTE = /\b(?:never|must not|under no circumstances|no exceptions)\b/i

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'overridable' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not rely on a managed soft_deny entry as a hard boundary, because an allow entry can override it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      overridable:
        'The "autoMode.soft_deny" entry "{{entry}}" states a rule without exception. A soft block is not a hard boundary: an "allow" entry of a developer, or a direct request of the user, can override it. If the rule must hold, move it to "autoMode.hard_deny", or use "permissions.deny" for a tool pattern.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(node) {
        for (const entry of stringEntries(valueAt(node, ['autoMode', 'soft_deny']))) {
          if (ABSOLUTE.test(entry.value)) {
            context.report({
              loc: entry.loc,
              messageId: 'overridable',
              data: { entry: entry.value },
            })
          }
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
