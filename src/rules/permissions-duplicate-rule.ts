// The same permission rule twice in one settings file. A copy changes nothing and hides which
// entry a later edit should change (docs/rules/permissions-duplicate-rule.md). The rule compares
// the rules after it reads `:*` at the end as a final ` *`, and a trailing `.` in a `WebFetch`
// domain as no dot. `permissions-dead-allow` owns an `allow` rule that an equal `deny` or `ask`
// rule covers, so this rule skips that pair and one fault gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import type { ParsedEntry } from '../permission-entries.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import type { ParsedRule } from '../permission-rule.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-duplicate-rule' as const

/** A rule in the text form of a settings file. */
const textOf = (rule: ParsedRule) =>
  rule.specifier === null ? rule.tool : `${rule.tool}(${rule.specifier})`

/** The text that two equal rules share. A bare command tool is the same as `Tool(*)`. */
function keyOf({ tool, specifier }: ParsedRule): string {
  if (COMMAND_RULE_TOOLS.includes(tool)) {
    return `${tool}(${commandWords(specifier ?? '*').join(' ')})`
  }
  if (tool === 'WebFetch' && specifier?.startsWith('domain:')) {
    return `${tool}(${specifier.replace(/\.$/, '')})`
  }
  return specifier === null ? tool : `${tool}(${specifier})`
}

/** The order in which Claude Code checks the lists. The first rule of an equal group is the one
 *  that applies, and the rest are the copies. */
const ORDER = { deny: 0, ask: 1, allow: 2 }

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'duplicate' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write each permission rule once in a settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        '`{{rule}}` repeats `{{first}}` in the {{list}} list, at line {{line}}. Remove the copy.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const covering = entries.filter(({ list }) => list !== 'allow')
      const groups = new Map<string, ParsedEntry[]>()
      for (const entry of entries) {
        // `permissions-dead-allow` reports an `allow` rule that an equal `deny` or `ask` rule
        // covers. It reads a specifier of a tool that is not a command tool as equal text only.
        const isDead =
          entry.list === 'allow' &&
          covering.some(
            ({ rule: cover }) =>
              keyOf(cover) === keyOf(entry.rule) &&
              (COMMAND_RULE_TOOLS.includes(cover.tool) || cover.specifier === entry.rule.specifier),
          )
        if (!isDead) {
          const key = keyOf(entry.rule)
          groups.set(key, [...(groups.get(key) ?? []), entry])
        }
      }
      for (const group of groups.values()) {
        const sorted = [...group].sort((a, b) => ORDER[a.list] - ORDER[b.list])
        const first = sorted[0] as ParsedEntry
        for (const copy of sorted.slice(1)) {
          context.report({
            loc: copy.loc,
            messageId: 'duplicate',
            data: {
              rule: textOf(copy.rule),
              first: textOf(first.rule),
              list: first.list,
              line: String(first.loc.start.line),
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
