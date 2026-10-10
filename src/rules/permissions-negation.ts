// A `!` pattern in a `Read` or `Edit` deny or ask rule carves paths out of the `path` or
// `./path` rules listed before it, in the same list of the same file
// (docs/rules/permissions-negation.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import type { ParsedEntry } from '../permission-entries.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { GITIGNORE_TOOLS, isAnchored, pathSpecifier } from '../permission-path.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-negation' as const

type MessageId = 'bare' | 'anchored' | 'carvesNothing' | 'reopen'

/** `path` without a `./` at the start. */
const relative = (path: string) => (path.startsWith('./') ? path.slice(2) : path)

/** The specifier of `entry` when Claude Code can carve a path out of the rule, or null. The rule
 *  is a `Read` or `Edit` rule that is not a `!` rule and starts at the current directory. */
function carvable(entry: ParsedEntry): string | null {
  const specifier = pathSpecifier(entry, GITIGNORE_TOOLS)
  return specifier !== null && !specifier.startsWith('!') && !isAnchored(specifier)
    ? specifier
    : null
}

/** True when one of the `earlier` specifiers is `directory/**` and `pattern` is a path inside
 *  `directory`. The docs say that a carve-out cannot reopen a file inside a directory that a
 *  rule blocks as a whole. */
function reopens(earlier: readonly string[], pattern: string): boolean {
  return earlier.some(
    (specifier) =>
      specifier.endsWith('/**') &&
      relative(pattern).startsWith(`${relative(specifier.slice(0, -3))}/`),
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a ! rule after the path rule that it carves, and not before an anchor',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bare: '`{{rule}}` is a bare `!`. Claude Code ignores it.',
      anchored:
        'Claude Code reads `{{rule}}` relative to the current directory, whatever follows the `!`. It cannot carve a path out of a rule that starts with `/`, `~/` or `//`.',
      carvesNothing:
        '`{{rule}}` carves nothing out. No `path` or `./path` rule comes before it in this list.',
      reopen:
        '`{{rule}}` cannot reopen a path inside a directory that an earlier rule blocks whole. Claude Code still blocks the path.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      entries.forEach((entry, index) => {
        const specifier = pathSpecifier(entry, GITIGNORE_TOOLS)
        // The docs describe a `!` pattern for deny and ask rules only.
        if (entry.list === 'allow' || specifier === null || !specifier.startsWith('!')) {
          return
        }
        const pattern = specifier.slice(1)
        const earlier = entries
          .slice(0, index)
          .filter((other) => other.list === entry.list)
          .flatMap((other) => carvable(other) ?? [])
        let messageId: MessageId | null = null
        if (pattern === '') {
          messageId = 'bare'
        } else if (isAnchored(pattern)) {
          messageId = 'anchored'
        } else if (earlier.length === 0) {
          messageId = 'carvesNothing'
        } else if (reopens(earlier, pattern)) {
          messageId = 'reopen'
        }
        if (messageId !== null) {
          context.report({
            loc: entry.loc,
            messageId,
            data: { rule: `${entry.rule.tool}(${specifier})` },
          })
        }
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
