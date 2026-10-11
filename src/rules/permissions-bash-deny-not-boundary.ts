// A deny or ask rule on a command, and a `Read` deny rule, stop the form that Claude usually
// writes and no other. The sandbox or a `PreToolUse` hook is the boundary. The rule reads the
// sandbox and the hooks of one settings source, and makes no report when it cannot read a sibling
// file (docs/rules/permissions-bash-deny-not-boundary.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { BASH_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords, isInputParameterRule } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { pathSpecifier } from '../permission-path.ts'
import { at, type SettingsObject, sourceOf } from '../permission-source.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-deny-not-boundary' as const

/** True when a file of the source turns the sandbox on. A managed file also accepts the string
 *  "true" (the managed settings page, "Invalid values inside sandbox"). */
const hasSandbox = (objects: readonly SettingsObject[], isManaged: boolean) =>
  objects.some((object) => {
    const enabled = at(object, ['sandbox', 'enabled'])
    return enabled === true || (isManaged && enabled === 'true')
  })

/** True when a file of the source holds a `PreToolUse` entry. An empty list holds no hook. */
const hasHook = (objects: readonly SettingsObject[]) =>
  objects.some((object) => {
    const hooks = at(object, ['hooks', 'PreToolUse'])
    return hooks !== undefined && !(Array.isArray(hooks) && hooks.length === 0)
  })

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'boundary' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on a Bash or Read deny rule as a security boundary',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      boundary:
        '`{{rule}}`{{count}} is not a security boundary: it stops the form of the command or the file that Claude usually writes, and not `/usr/bin/<command>`, `sh -c` or `grep -r`. This settings source turns on no sandbox and holds no `PreToolUse` hook. Enable `sandbox.enabled`, or add a hook, where the limit must hold.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const found = entries.filter((entry) => {
        const { list, rule: parsed } = entry
        if (list !== 'deny' && list !== 'ask') {
          return false
        }
        if (parsed.tool === 'Read') {
          return list === 'deny' && pathSpecifier(entry, ['Read']) !== null
        }
        return (
          parsed.specifier !== null &&
          BASH_RULE_TOOLS.includes(parsed.tool) &&
          !isInputParameterRule(list, parsed.specifier) &&
          commandWords(parsed.specifier).join(' ') !== '*'
        )
      })
      const [first] = found
      if (first === undefined) {
        return
      }
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      // A sibling that cannot be read can hold the sandbox or a hook.
      if (
        !complete ||
        hasSandbox(objects, kindOf(context.filename) === 'managed') ||
        hasHook(objects)
      ) {
        return
      }
      context.report({
        loc: first.loc,
        messageId: 'boundary',
        data: {
          rule: `${first.rule.tool}(${first.rule.specifier})`,
          count: found.length > 1 ? ` (this file has ${found.length} such rules)` : '',
        },
      })
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
