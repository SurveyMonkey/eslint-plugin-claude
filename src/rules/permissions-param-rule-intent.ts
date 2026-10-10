// An allow rule keeps the specifier syntax of its tool, so `Agent(model:opus)` in `allow` is no
// parameter match. Parameter rules work in `deny` and `ask`
// (docs/rules/permissions-param-rule-intent.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS, INPUT_PARAMETERS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMAND_PARAMETERS } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { paramName } from '../permission-rule.ts'
import { isDeadAllow, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-param-rule-intent' as const

/** The parameters that the rule reads for `tool`. The docs name `model`, `isolation` and `skill`.
 *  The command tools use `COMMAND_PARAMETERS`. */
const parametersOf = (tool: string) =>
  COMMAND_RULE_TOOLS.includes(tool) ? COMMAND_PARAMETERS : (INPUT_PARAMETERS.get(tool) ?? [])

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'intent' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a parameter rule in deny or ask, not in allow',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      intent:
        '`{{rule}}` is an allow rule, and an allow rule keeps the specifier syntax of `{{tool}}`: Claude Code does not read `{{parameter}}` as an input parameter. Parameter rules work in `deny` and `ask` only.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const { objects } = sourceOf(context.filename, context.sourceCode.text)
      for (const { list, loc, rule: parsed } of entries) {
        const parameter =
          list === 'allow' && parsed.specifier !== null ? paramName(parsed.specifier) : null
        if (
          parameter === null ||
          !parametersOf(parsed.tool).includes(parameter) ||
          // The colon-star rules report a `:*` in a command rule.
          (COMMAND_RULE_TOOLS.includes(parsed.tool) &&
            /:\*(?:\s|$)/.test(parsed.specifier as string)) ||
          // `permissions-dead-allow` reports an allow rule with the same text as a deny or ask rule, or
          // with a deny or ask rule for the bare tool (`isDeadAllow`).
          isDeadAllow(objects, parsed)
        ) {
          continue
        }
        context.report({
          loc,
          messageId: 'intent',
          data: { rule: `${parsed.tool}(${parsed.specifier})`, tool: parsed.tool, parameter },
        })
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
