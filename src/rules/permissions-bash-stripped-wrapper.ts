// Claude Code strips a fixed set of wrappers before it matches a Bash rule, so a rule for the inner
// command works (docs/rules/permissions-bash-stripped-wrapper.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { STRIPPED_WRAPPERS } from '../data/bash-commands.ts'
import { BASH_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords, isInputParameterRule } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-stripped-wrapper' as const

/** The wrapper that Claude Code strips from the start of a command that `words` match, or
 *  undefined. `command -v` is a query, and Claude Code does not strip it. Bare `xargs` is
 *  stripped, but `xargs` with a flag is not. The rule `xargs *` is silent, because its `*` can
 *  match a flag. The rule `xargs` alone is silent too, and so is a bare wrapper such as
 *  `timeout`: there is no inner command to write the rule for. */
function strippedWrapper(words: readonly string[]): string | undefined {
  const [first, second] = words
  if (first === 'xargs') {
    return second !== undefined && second !== '*' && !second.startsWith('-') ? first : undefined
  }
  if (first === undefined || second === undefined || !STRIPPED_WRAPPERS.includes(first)) {
    return undefined
  }
  return first === 'command' && second === '-v' ? undefined : first
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'stripped' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a Bash rule for the inner command, not for a wrapper that is stripped',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      stripped:
        '`{{rule}}` starts with `{{wrapper}}`, which Claude Code strips before it matches Bash rules. Write the rule for the inner command.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        const wrapper =
          parsed.specifier !== null &&
          BASH_RULE_TOOLS.includes(parsed.tool) &&
          !isInputParameterRule(list, parsed.specifier)
            ? strippedWrapper(commandWords(parsed.specifier))
            : undefined
        if (wrapper !== undefined) {
          context.report({
            loc,
            messageId: 'stripped',
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
