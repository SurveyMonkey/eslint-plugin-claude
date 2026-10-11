// The keys of `autoMode` and their types (docs/rules/permissions-auto-mode-schema.md). This rule
// owns the value of `autoMode`, so `settings-schema` makes no report there. The docs state no
// limit on how often `"$defaults"` can stand in one array, so the rule reads no such limit.
import type { JSONRuleDefinition } from '@eslint/json'
import { AUTO_MODE_LISTS, isIgnoredInRepoFile } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-auto-mode-schema' as const

type MessageId =
  | 'unknownKey'
  | 'notObject'
  | 'notArray'
  | 'listWithheld'
  | 'notString'
  | 'entryWithheld'
  | 'notBoolean'

/** The lists whose failure makes Claude Code withhold `allow` and `environment` in a managed
 *  file. */
const RESTRICTIONS = ['soft_deny', 'hard_deny']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use only the documented keys in autoMode, each with a value of its type',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknownKey: '"{{key}}" is not a key of "autoMode". Claude Code does not read it.',
      notObject: '"autoMode" must be an object.',
      notArray: '"{{key}}" must be an array of strings.',
      listWithheld:
        '"{{key}}" must be an array of strings. Claude Code cannot read this list, so it withholds "allow" and "environment" in managed settings.',
      notString: 'Each entry of "{{key}}" must be a string.',
      entryWithheld:
        'Each entry of "{{key}}" must be a string. Claude Code drops an invalid entry, and then withholds "allow" and "environment" in managed settings.',
      notBoolean: '"classifyAllShell" must be true or false.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    // Claude Code ignores `autoMode` in a project or local file, and `settings-key-scope` reports
    // it there. A report on its value would be a second report on the same line.
    if (!isManaged && isIgnoredInRepoFile(['autoMode'])) {
      return {}
    }
    return {
      Document(node) {
        const value = lastMember(node.body, 'autoMode')?.value
        if (value === undefined || value.type === 'Null') {
          return
        }
        if (value.type !== 'Object') {
          context.report({ node: value, messageId: 'notObject' })
          return
        }
        for (const member of value.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(value, key) !== member) {
            continue
          }
          const entry = member.value
          const withheld = isManaged && RESTRICTIONS.includes(key)
          if (key === 'classifyAllShell') {
            // In a managed file, a quoted Boolean counts as that Boolean (managed-settings,
            // "Keys that fail closed").
            const quoted =
              isManaged && entry.type === 'String' && ['true', 'false'].includes(entry.value)
            if (entry.type !== 'Null' && entry.type !== 'Boolean' && !quoted) {
              context.report({ node: entry, messageId: 'notBoolean' })
            }
          } else if (!AUTO_MODE_LISTS.includes(key)) {
            context.report({ node: member.name, messageId: 'unknownKey', data: { key } })
          } else if (entry.type === 'Array') {
            for (const { value: item } of entry.elements) {
              if (item.type !== 'String') {
                context.report({
                  node: item,
                  messageId: withheld ? 'entryWithheld' : 'notString',
                  data: { key },
                })
              }
            }
          } else if (entry.type !== 'Null') {
            context.report({
              node: entry,
              messageId: withheld ? 'listWithheld' : 'notArray',
              data: { key },
            })
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
