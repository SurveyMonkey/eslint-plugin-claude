// A `*` before the subcommand in an allow rule also matches the options that
// sit at that position, so `Bash(git * main)` approves
// `git -c core.fsmonitor=<script> diff main`
// (docs/rules/permissions-bash-wildcard-before-subcommand.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-wildcard-before-subcommand' as const

/** True when the first word that is a bare `*` stands where the subcommand
 *  goes, and a word follows it. The `*` stands there when it is the first
 *  word, or when only options sit between it and the program. A word that is
 *  not an option, as `log` in `git log * main`, is the subcommand, and the
 *  `*` after it is fine. A rule that ends in the `*` has no word after it. A
 *  word that holds a `*` with other text is for the planned rule `permissions-bash-glued-wildcard`. */
function wildcardBeforeSubcommand(words: readonly string[]): boolean {
  const star = words.indexOf('*')
  if (star === -1 || words.slice(star + 1).every((word) => word === '*')) {
    return false
  }
  return words.slice(1, star).every((word) => word.startsWith('-'))
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'wildcard' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put the * of a Bash allow rule after the subcommand',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      wildcard:
        '`{{rule}}` has a wildcard before the subcommand. The `*` also matches other text at that position, such as options, so the rule approves more than you intend. Write the exact value in place of the `*`, or put every `*` after the subcommand.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (
          list === 'allow' &&
          parsed.specifier !== null &&
          COMMAND_RULE_TOOLS.includes(parsed.tool) &&
          wildcardBeforeSubcommand(commandWords(parsed.specifier))
        ) {
          context.report({
            loc,
            messageId: 'wildcard',
            data: { rule: `${parsed.tool}(${parsed.specifier})` },
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
