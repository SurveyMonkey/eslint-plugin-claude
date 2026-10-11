// The classifier reads each `autoMode` entry as prose, and not as a tool pattern
// (docs/rules/permissions-auto-mode-rule-syntax.md). An entry that has the form of a permission
// rule, such as `Bash(git push *)`, belongs in `permissions`. A heuristic: the rule reads the
// start of an entry as a tool name, and a prose entry that opens with one is rare. The classifier
// reads `autoMode` from managed settings and not from the two project files, so the rule reads
// managed files, as `permissions-auto-mode-schema` does.
import type { JSONRuleDefinition } from '@eslint/json'
import { AUTO_MODE_LISTS } from '../data/settings-keys.ts'
import { MCP_PREFIX, OTHER_RULE_TOOL_NAMES, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-rule-syntax' as const

/** True when `tool` is a tool name that a permission rule can hold. */
const isToolName = (tool: string) =>
  TOOL_NAMES.includes(tool) ||
  OTHER_RULE_TOOL_NAMES.includes(tool) ||
  (tool.startsWith(MCP_PREFIX) && tool.length > MCP_PREFIX.length && !/\s/.test(tool))

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'ruleShaped' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write autoMode entries as prose, and put a permission rule in permissions',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ruleShaped:
        'The entry `{{entry}}` of "autoMode.{{list}}" has the form of a permission rule. The classifier reads each entry as prose, and not as a tool pattern. Put the rule in "permissions.allow", "permissions.ask" or "permissions.deny", and write a sentence here.',
    },
  },
  create(context) {
    // A hidden drop-in is ignored. A project file is not read for `autoMode`:
    // `settings-key-scope` reports the key there.
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(node) {
        for (const list of AUTO_MODE_LISTS) {
          for (const entry of stringEntries(valueAt(node, ['autoMode', list]))) {
            const parsed = parsePermissionRule(entry.value.trim())
            if (parsed.ok && parsed.specifier !== null && isToolName(parsed.tool)) {
              context.report({
                loc: entry.loc,
                messageId: 'ruleShaped',
                data: { entry: entry.value.trim(), list },
              })
            }
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
