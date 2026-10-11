// An `excludedCommands` entry has the syntax of the content of a `Bash(...)` rule, with no
// `Bash(` wrapper (docs/rules/sandbox-excluded-commands-syntax.md). Claude Code keeps a call
// sandboxed when it starts with one of a few words, however an entry is written. The grammar of a
// rule is in `src/permission-rule.ts`, and the words of a pattern are in
// `src/permission-command.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-excluded-commands-syntax' as const

type MessageId = 'wrapper' | 'neverExcluded'

/** The first words of a call that Claude Code keeps sandboxed. A `cd`, `pushd` or `popd` does so
 *  wherever it stands in the call. An entry is a pattern for the whole call, so the rule reads the
 *  first word only. */
const NEVER_EXCLUDED = ['sudo', 'eval', 'xargs', 'cd', 'pushd', 'popd']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each excludedCommands entry as a command pattern, with no Bash( wrapper',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      wrapper:
        '`{{entry}}` has the `Bash(...)` wrapper of a permission rule. An excludedCommands entry is the command pattern only. Write `{{inner}}`.',
      neverExcluded:
        '`{{entry}}` starts with `{{word}}`. Claude Code keeps a call that starts with `{{word}}` in the sandbox, so this entry takes no call out of it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const entry of stringEntries(valueAt(node, ['sandbox', 'excludedCommands']))) {
          const text = entry.value.trim()
          const parsed = parsePermissionRule(text)
          if (parsed.ok && parsed.tool === 'Bash' && parsed.specifier !== null) {
            context.report({
              node: entry,
              messageId: 'wrapper',
              data: { entry: text, inner: parsed.specifier },
            })
            continue
          }
          const word = commandWords(text)[0]
          if (word !== undefined && NEVER_EXCLUDED.includes(word)) {
            context.report({ node: entry, messageId: 'neverExcluded', data: { entry: text, word } })
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
