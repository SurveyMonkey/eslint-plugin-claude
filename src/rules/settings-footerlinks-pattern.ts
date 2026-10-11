// The `footerLinksRegexes` entries of a managed settings file (docs/rules/settings-footerlinks-pattern.md).
// Claude Code runs each `pattern` on the main thread, so a slow regex freezes the session. It
// drops a constructed URL of more than 2048 characters, and cuts a label to 28 display columns.
// The rule never runs a `pattern`: it scans the text of the pattern for a quantifier in a group
// that another quantifier follows. The settings reference gives the scope "User or managed". A
// user file is not in a repository, so the rule reads the managed files only.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-footerlinks-pattern' as const

// The limits in the docs, and the defaults of the options. No Claude Code setting moves them, so
// the schema sets each as the maximum of its option (CONTRIBUTING.md, "Rule thresholds").
const URL_MAX = 2048
const LABEL_MAX = 28

type Options = [{ maxUrlChars: number; maxLabelColumns: number }]

/** A `{name}` placeholder. Claude Code fills it from a capture group, so the literal text of a
 *  template is the template without its placeholders. */
const PLACEHOLDER = /\{\w+\}/g

/** True when the `pattern` text has a group that holds `+` or `*` and that `+` or `*` follows,
 *  as in `(a+)+`. The scan skips an escaped character and the inside of a character class. */
function hasNestedQuantifier(pattern: string): boolean {
  // One flag for each open group: true when the group holds a `+` or `*`.
  const open: boolean[] = []
  let inClass = false
  for (let at = 0; at < pattern.length; at += 1) {
    const char = pattern.charAt(at)
    if (char === '\\') {
      at += 1
    } else if (inClass) {
      inClass = char !== ']'
    } else if (char === '[') {
      inClass = true
    } else if (char === '(') {
      open.push(false)
    } else if ((char === '+' || char === '*') && open.length > 0) {
      open[open.length - 1] = true
    } else if (char === ')' && open.pop() === true) {
      const next = pattern.charAt(at + 1)
      if (next === '+' || next === '*') {
        return true
      }
      if (open.length > 0) {
        open[open.length - 1] = true
      }
    }
  }
  return false
}

// A mark or a format character takes no column. A character of the East Asian wide blocks, and an
// emoji, takes two. The docs say "display columns" and give no table, so this is an approximation.
const NO_COLUMN = /^[\p{Mn}\p{Me}\p{Cf}]$/u
const TWO_COLUMNS = /^[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]$/u

/** The display columns of `text`. */
function columnsOf(text: string): number {
  let columns = 0
  for (const char of text) {
    columns += NO_COLUMN.test(char) ? 0 : TWO_COLUMNS.test(char) ? 2 : 1
  }
  return columns
}

/** The string node of the field `key` of the entry, or undefined. */
function stringField(entry: ValueNode, key: string) {
  const value = lastMember(entry, key)?.value
  return value?.type === 'String' ? value : undefined
}

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds:
    | 'nested'
    | 'urlTooLong'
    | 'overConfiguredUrlLimit'
    | 'labelTooWide'
    | 'overConfiguredLabelLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep the footerLinksRegexes entries of a managed settings file within the limits',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxUrlChars: { type: 'integer', minimum: 1, maximum: URL_MAX },
          maxLabelColumns: { type: 'integer', minimum: 1, maximum: LABEL_MAX },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxUrlChars: URL_MAX, maxLabelColumns: LABEL_MAX }],
    messages: {
      nested:
        'This pattern nests a quantifier in a quantified group. Claude Code runs the pattern on the main thread, and a nested + or * can freeze the session. Keep the pattern linear.',
      urlTooLong:
        'This URL template has {{length}} characters without its placeholders. Claude Code drops a constructed URL of more than {{max}} characters.',
      overConfiguredUrlLimit:
        'This URL template has {{length}} characters without its placeholders. The configured limit is {{max}} characters.',
      labelTooWide:
        'This label is {{columns}} columns wide without its placeholders. Claude Code cuts a label to {{max}} display columns.',
      overConfiguredLabelLimit:
        'This label is {{columns}} columns wide without its placeholders. The configured limit is {{max}} columns.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ maxUrlChars, maxLabelColumns }] = context.options
    return {
      Document(node) {
        const list = lastMember(node.body, 'footerLinksRegexes')?.value
        if (list?.type !== 'Array') {
          return
        }
        for (const { value: entry } of list.elements) {
          const pattern = stringField(entry, 'pattern')
          if (pattern !== undefined && hasNestedQuantifier(pattern.value)) {
            context.report({ node: pattern, messageId: 'nested' })
          }
          const url = stringField(entry, 'url')
          const length = (url?.value ?? '').replaceAll(PLACEHOLDER, '').length
          if (url !== undefined && length > maxUrlChars) {
            context.report({
              node: url,
              // At another value, the message names the configured limit and claims no docs limit.
              messageId: maxUrlChars === URL_MAX ? 'urlTooLong' : 'overConfiguredUrlLimit',
              data: { length: String(length), max: String(maxUrlChars) },
            })
          }
          const label = stringField(entry, 'label')
          const columns = columnsOf((label?.value ?? '').replaceAll(PLACEHOLDER, ''))
          if (label !== undefined && columns > maxLabelColumns) {
            context.report({
              node: label,
              messageId:
                maxLabelColumns === LABEL_MAX ? 'labelTooWide' : 'overConfiguredLabelLimit',
              data: { columns: String(columns), max: String(maxLabelColumns) },
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
  files: MANAGED_SETTINGS_FILES,
  rule,
}
