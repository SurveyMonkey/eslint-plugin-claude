// A `claudeMdExcludes` pattern that can match (docs/rules/claude-md-excludes-pattern.md).
// The docs say that Claude Code matches each pattern against absolute file paths. A pattern
// that starts with a name, such as `packages/web/**`, can match none of them. A pattern is
// valid when it starts at the root (`/`, or a Windows drive or share) or with `**/`. The
// pattern `**` alone matches every path, so it is valid too. An entry that is not a string is
// the fault of `memory-settings-schema`, so this rule leaves it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'claude-md-excludes-pattern' as const

// `/`, `**/`, a Windows drive (`C:\` or `C:/`), or a Windows share (`\\server`).
const ANCHORED = /^(\/|\*\*\/|[A-Za-z]:[\\/]|\\\\)/

/** True when `pattern` can match an absolute path. */
const isAnchored = (pattern: string) => pattern === '**' || ANCHORED.test(pattern)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'relative' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Start each claudeMdExcludes pattern at the root or with **/',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relative:
        '`claudeMdExcludes` matches absolute file paths, so "{{pattern}}" matches none. Start the pattern with `**/`, or write the absolute path.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const list = lastMember(node.body, 'claudeMdExcludes')?.value
        if (list?.type !== 'Array') {
          return
        }
        for (const { value } of list.elements) {
          if (value.type === 'String' && !isAnchored(value.value)) {
            context.report({ node: value, messageId: 'relative', data: { pattern: value.value } })
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
