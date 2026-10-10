// Auto mode drops the allow rules that grant arbitrary code execution, and the classifier reviews
// the action instead (docs/rules/permissions-auto-mode-dropped-allow.md). A file does not show
// whether a session runs in auto mode, so the rule is a heuristic. It reports the rules that
// the docs name, unless the settings source turns auto mode off.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import type { ParsedRule } from '../permission-rule.ts'
import { at, sourceOf } from '../permission-source.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-dropped-allow' as const

const SHELL_TOOLS = ['Bash', 'PowerShell']

/** The interpreters that the rule knows. The docs give `python` as the one example, so this list
 *  is a guess at the same kind of program. */
const INTERPRETERS = ['python', 'python3', 'node', 'ruby', 'perl']

/** The places of the lock that turns auto mode off, as the docs give them. Managed settings fail
 *  closed for the top-level key only: any value but null reads as "disable". */
const LOCKS = [
  { path: ['disableAutoMode'], failsClosed: true },
  { path: ['permissions', 'disableAutoMode'], failsClosed: false },
]

/** Why auto mode drops `rule`, or null when it keeps the rule. A wildcarded interpreter is a rule
 *  with only a `*` after the program name, as in `python*` and `python *`. */
function reasonOf({ tool, specifier }: ParsedRule): string | null {
  if (tool === 'Agent' || tool === 'Monitor') {
    return `is an allow rule for ${tool}`
  }
  if (!SHELL_TOOLS.includes(tool)) {
    return null
  }
  if (specifier === null || specifier === '*') {
    return 'matches every command'
  }
  const [program = '', ...rest] = commandWords(specifier)
  const glued = program.endsWith('*')
  const bare = glued ? program.slice(0, -1) : program
  const wildcard = glued ? rest.length === 0 : rest.length === 1 && rest[0] === '*'
  return INTERPRETERS.includes(bare) && wildcard ? 'is a wildcarded interpreter rule' : null
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'dropped' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on an allow rule that auto mode drops',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      dropped:
        '`{{rule}}` {{reason}}. In auto mode, Claude Code drops this allow rule, and the classifier reviews each action instead. Claude Code restores it when you leave auto mode.',
    },
  },
  create(context) {
    const isManaged = kindOf(context.filename) === 'managed'
    return settingsListener(context, (entries) => {
      const dropped = entries.flatMap((entry) => {
        const reason = entry.list === 'allow' ? reasonOf(entry.rule) : null
        return reason === null ? [] : [{ ...entry, reason }]
      })
      if (dropped.length === 0) {
        return
      }
      // A lock in any file of the source means no session runs in auto mode. The check rests on
      // an absence, so a file that the rule cannot read makes it silent.
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      const isLocked = objects.some((object) =>
        LOCKS.some(({ path, failsClosed }) => {
          const value = at(object, path)
          return isManaged && failsClosed
            ? value !== undefined && value !== null
            : value === 'disable'
        }),
      )
      if (isLocked || !complete) {
        return
      }
      for (const { loc, rule: parsed, reason } of dropped) {
        const text = parsed.specifier === null ? parsed.tool : `${parsed.tool}(${parsed.specifier})`
        context.report({ loc, messageId: 'dropped', data: { rule: text, reason } })
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
