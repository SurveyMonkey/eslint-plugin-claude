// `sandbox` keys in a file where no file of the source sets `sandbox.enabled` to `true`. The
// default is `false`, and then Claude Code runs commands unsandboxed
// (docs/rules/sandbox-settings-without-enabled.md). The rule adds up the project pair, or one
// managed source, and makes no report when it cannot read a file of the source, because that file
// can set `enabled`. A user file is outside the repository (ADR 001, Decision 14) and can set it
// too, which is why the rule is `off` in `recommended`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { valueAt } from '../permission-sandbox.ts'
import { enabledValues, sourceOf } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-settings-without-enabled' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'noEnabled' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set sandbox.enabled to true in a source that sets other sandbox keys',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noEnabled:
        'This file sets "sandbox" keys, but no file of its source sets "sandbox.enabled" to `true`. The default is `false`, and then Claude Code runs commands unsandboxed, so the other keys limit nothing. Set "enabled" to `true`. A user settings file can enable the sandbox, and this rule cannot see it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const sandbox = valueAt(node, ['sandbox'])
        if (
          sandbox?.type !== 'Object' ||
          sandbox.members.every((member) => keyOf(member.name) === 'enabled')
        ) {
          return
        }
        const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
        if (complete && !enabledValues(objects, isManaged).includes(true)) {
          context.report({ node: sandbox, messageId: 'noEnabled' })
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
