// An `autoMode` array without the entry "$defaults" replaces the built-in list of its section
// (docs/rules/permissions-auto-mode-defaults.md). The classifier does not read `autoMode` from the
// two project files, so the rule reads managed files only, as `permissions-auto-mode-schema`
// does. Claude Code adds up the arrays of the files that set one list, so the rule reads the
// managed source. It makes no report when it cannot read a file of that source.
import type { JSONRuleDefinition } from '@eslint/json'
import { AUTO_MODE_LISTS, isIgnoredInRepoFile } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { valueAt } from '../permission-sandbox.ts'
import { sourceOf, stringsAt } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-defaults' as const

/** What the built-in list of each section holds, from the auto mode page. */
const DROPPED: Readonly<Record<string, string>> = {
  environment: 'the built-in environment entries: the context, trust and sensitivity slots',
  allow: 'the built-in allow exceptions',
  soft_deny:
    'every built-in soft block rule, including force push, `curl | bash`, production deploys, and auto-mode bypass',
  hard_deny: 'the built-in data exfiltration rule',
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'replaced' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep the built-in auto mode rules with "$defaults" in each autoMode array',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      replaced:
        '"autoMode.{{list}}" has no "$defaults" entry, so it replaces {{dropped}}. Add "$defaults", or keep it out only to own the whole list.',
    },
  },
  create(context) {
    // Claude Code ignores `autoMode` in a project or local file, and `settings-key-scope` reports
    // it there.
    if (
      isHiddenDropIn(context.filename) ||
      (kindOf(context.filename) !== 'managed' && isIgnoredInRepoFile(['autoMode']))
    ) {
      return {}
    }
    return {
      Document(node) {
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        for (const list of AUTO_MODE_LISTS) {
          const value = valueAt(node, ['autoMode', list])
          if (value?.type !== 'Array') {
            continue
          }
          // A file that cannot be read can hold the entry.
          if (complete && !stringsAt(objects, ['autoMode', list]).includes('$defaults')) {
            context.report({
              node: value,
              messageId: 'replaced',
              data: { list, dropped: DROPPED[list] as string },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
