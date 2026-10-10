// Claude Code runs the built-in read-only commands without a prompt, so an allow rule for one adds
// nothing (docs/rules/permissions-bash-readonly-redundant.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { READ_ONLY_COMMANDS, READ_ONLY_WITH_PROMPTS } from '../data/bash-commands.ts'
import { BASH_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { isDeadAllow, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-readonly-redundant' as const

/** The read-only command that the pattern `words` names with no other argument, or undefined. The
 *  bare command is `ls`, and the plain prefix rule is `ls *`. A command that prompts for some
 *  arguments has the bare form only, because its prefix rule can approve a call that prompts
 *  otherwise. */
function redundantCommand(words: readonly string[]): string | undefined {
  const [command] = words
  if (command === undefined || !READ_ONLY_COMMANDS.includes(command)) {
    return undefined
  }
  const prefix = words.length === 2 && words[1] === '*'
  return words.length === 1 || (prefix && !READ_ONLY_WITH_PROMPTS.includes(command))
    ? command
    : undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'redundant' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not write an allow rule for a read-only command that runs without a prompt',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      redundant:
        '`{{rule}}` adds nothing: Claude Code runs `{{command}}` without a prompt, as a built-in read-only command. Remove the rule. To require a prompt, write an `ask` rule.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const { objects } = sourceOf(context.filename, context.sourceCode.text)
      for (const { list, loc, rule: parsed } of entries) {
        const command =
          list === 'allow' && parsed.specifier !== null && BASH_RULE_TOOLS.includes(parsed.tool)
            ? redundantCommand(commandWords(parsed.specifier))
            : undefined
        // `permissions-dead-allow` reports an allow rule that a deny or ask rule covers.
        if (command !== undefined && !isDeadAllow(objects, parsed)) {
          context.report({
            loc,
            messageId: 'redundant',
            data: { rule: `${parsed.tool}(${parsed.specifier})`, command },
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
