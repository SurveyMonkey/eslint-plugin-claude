// A `:*` that ends a word before the end of a command pattern is a literal colon, so
// `Bash(git:* push)` never matches a git command (docs/rules/permissions-bash-colon-star-mid.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-colon-star-mid' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'mid' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put the :* of a Bash rule at the end of the pattern',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      mid: '`{{rule}}` has a `:*` before the end of the pattern. Claude Code reads that colon as a literal character, so the rule does not match as you intend. Put the wildcard at the end of the pattern, after the subcommand, as in `{{example}}`.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { loc, rule: parsed } of entries) {
        if (parsed.specifier === null || !COMMAND_RULE_TOOLS.includes(parsed.tool)) {
          continue
        }
        // The same end as `commandWords`: a final `:*` is the suffix form, and the rest is text.
        // A `:*` inside a word, as in `localhost:*/health`, is a literal colon and a wildcard.
        const text = parsed.specifier.trim()
        const body = text.length > 2 && text.endsWith(':*') ? text.slice(0, -2) : text
        if (/:\*(?=\s)/.test(body)) {
          context.report({
            loc,
            messageId: 'mid',
            data: {
              rule: `${parsed.tool}(${parsed.specifier})`,
              example: `${parsed.tool}(git push *)`,
            },
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
