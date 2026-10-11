// While the sandbox is on, Claude can retry a blocked command outside it with
// `dangerouslyDisableSandbox` (docs/rules/sandbox-unsandboxed-retry.md). Two settings stop that:
// `allowUnsandboxedCommands: false`, and an ask rule for `Bash(dangerouslyDisableSandbox:true)`
// (https://code.claude.com/docs/en/sandboxing#the-unsandboxed-retry-escape-hatch). A deny rule for
// the parameter stops it too. The rule adds up the project pair, or one managed source. It makes
// no report when it cannot read a file of the source. A user file is outside the repository (ADR
// 001, Decision 14) and can hold the setting. For this reason the rule is `off` in `recommended`.
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import type { ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { valueAt } from '../permission-sandbox.ts'
import { at, boolOf, listRules, sandboxOn, sourceOf } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-unsandboxed-retry' as const

/** The parameter rule of the docs, with the value `true` or a wildcard. */
const RETRY_PARAMETER = /^dangerouslyDisableSandbox:\s*(?:true|\*)$/

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'retry' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Close the unsandboxed retry of Claude while the sandbox is on',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      retry:
        'The sandbox is on and nothing in this source closes the unsandboxed retry: Claude can retry a blocked command outside the sandbox with `dangerouslyDisableSandbox`. An allow rule that matches the command approves the retry too. Set "allowUnsandboxedCommands" to `false`, or add the ask rule `Bash(dangerouslyDisableSandbox:true)`. A user settings file can hold either, and this rule cannot see it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const enabled = valueAt(node, ['sandbox', 'enabled'])
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        // A file that does not turn the sandbox on is silent. A file that does turn it on reports
        // for itself, so two files of a source can both report.
        if (
          boolOf(at(objects[0], ['sandbox', 'enabled']), isManaged, true) !== true ||
          !complete ||
          !sandboxOn(objects, isManaged)
        ) {
          return
        }
        // A managed value that is invalid counts as `false` for this key.
        const closed = objects.some(
          (object) =>
            boolOf(at(object, ['sandbox', 'allowUnsandboxedCommands']), isManaged, false) === false,
        )
        const ruled = (['ask', 'deny'] as const).some((list) =>
          listRules(objects, list).some(
            (rule_) =>
              COMMAND_RULE_TOOLS.includes(rule_.tool) &&
              RETRY_PARAMETER.test(rule_.specifier?.trim() ?? ''),
          ),
        )
        if (!closed && !ruled) {
          context.report({ node: enabled as ValueNode, messageId: 'retry' })
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
