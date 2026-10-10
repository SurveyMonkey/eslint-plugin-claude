// An `allow` rule that a `deny` or `ask` rule covers never applies: Claude Code checks deny, then
// ask, then allow, and specificity does not change the order
// (https://code.claude.com/docs/en/permissions#manage-permissions). The rule adds up the lists
// of one source: the project pair, or one managed source (`src/permission-source.ts`). Each case
// below is a limit of the rule (docs/rules/permissions-dead-allow.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { type ParsedRule, parsePermissionRule } from '../permission-rule.ts'
import { at, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-dead-allow' as const

/** A rule in the text form of a settings file. */
const textOf = (rule: ParsedRule) =>
  rule.specifier === null ? rule.tool : `${rule.tool}(${rule.specifier})`

/** True when the command pattern `cover` matches every command that the pattern `allow` matches.
 *  The `*` of `allow` is a literal character here, and `cover` matches it only with a `*` of its
 *  own, so the answer holds for every command of `allow`. A final ` *` that is the only wildcard
 *  of `cover` also matches the bare command. */
function commandCovers(cover: string, allow: string): boolean {
  const words = commandWords(cover)
  if (words.join(' ') === '*') {
    return true
  }
  const text = commandWords(allow).join(' ')
  const wildcards = words.filter((word) => word.includes('*')).length
  const last = words.at(-1)
  if (wildcards === 1 && last === '*' && text === words.slice(0, -1).join(' ')) {
    return true
  }
  const source = words
    .join(' ')
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${source}$`).test(text)
}

/** True when the `deny` or `ask` rule `cover` covers the `allow` rule. */
function covers(cover: ParsedRule, allow: ParsedRule): boolean {
  if (cover.tool !== allow.tool) {
    return false
  }
  if (cover.specifier === null) {
    return true
  }
  if (COMMAND_RULE_TOOLS.includes(cover.tool)) {
    return commandCovers(cover.specifier, allow.specifier ?? '*')
  }
  return cover.specifier === allow.specifier
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'dead' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not write an allow rule that a deny or ask rule covers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      dead: '`{{allow}}` never applies. The {{list}} rule `{{cover}}` covers it, and Claude Code checks deny, then ask, then allow.',
    },
  },
  create(context) {
    return settingsListener(context, (entries, document) => {
      const covering = entries.filter(({ list }) => list !== 'allow')
      const others = sourceOf(context.filename, context.sourceCode.text).slice(1)
      for (const list of ['deny', 'ask'] as const) {
        for (const object of others) {
          const texts = at(object, ['permissions', list])
          for (const text of Array.isArray(texts) ? texts : []) {
            const parsed = typeof text === 'string' ? parsePermissionRule(text) : undefined
            if (parsed?.ok) {
              covering.push({ list, loc: document.loc, rule: parsed })
            }
          }
        }
      }
      for (const entry of entries) {
        if (entry.list !== 'allow') {
          continue
        }
        const found = covering.find(({ rule: cover }) => covers(cover, entry.rule))
        if (found !== undefined) {
          context.report({
            loc: entry.loc,
            messageId: 'dead',
            data: { allow: textOf(entry.rule), list: found.list, cover: textOf(found.rule) },
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
