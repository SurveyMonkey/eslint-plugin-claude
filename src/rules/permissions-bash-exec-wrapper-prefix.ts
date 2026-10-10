// A prefix rule such as `Bash(watch *)` cannot auto-approve an exec wrapper:
// in Manual mode the command always prompts. Only an exact-match rule approves
// one invocation (docs/rules/permissions-bash-exec-wrapper-prefix.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { BASH_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-exec-wrapper-prefix' as const

/** The exec wrappers that a prefix rule cannot approve. Source: the "Wrappers"
 *  part of the Bash section
 *  (https://code.claude.com/docs/en/permissions#process-wrappers), checked on
 *  2026-10-10. The docs name `find` with `-exec` or `-delete` in the same
 *  paragraph. A `Bash(find *)` rule still covers plain `find`, so it is no
 *  fault of the rule, and this list does not hold it. */
const EXEC_WRAPPERS = ['watch', 'setsid', 'ionice', 'flock']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'prefix' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write an exact Bash allow rule for an exec wrapper such as watch',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      prefix:
        '`{{rule}}` cannot auto-approve `{{wrapper}}`: in Manual mode the command always prompts. Write an exact-match rule for the full command.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (
          list !== 'allow' ||
          parsed.specifier === null ||
          !BASH_RULE_TOOLS.includes(parsed.tool)
        ) {
          continue
        }
        const words = commandWords(parsed.specifier)
        const wrapper = words[0]
        if (wrapper !== undefined && EXEC_WRAPPERS.includes(wrapper) && words.at(-1) === '*') {
          context.report({
            loc,
            messageId: 'prefix',
            data: { rule: `${parsed.tool}(${parsed.specifier})`, wrapper },
          })
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
