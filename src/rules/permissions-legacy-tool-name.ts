// A rule can name two legacy tools. `Task` is the old name of `Agent`, renamed in Claude Code
// v2.1.63, and a `Task(...)` rule still works as an alias. A client older than v2.1.63 has no
// `Agent` tool, so the option `minVersion` below 2.1.63 stops the `Task` report. `MultiEdit` is a
// legacy tool, and
// `Edit` rules apply to all built-in tools that edit files
// (docs/rules/permissions-legacy-tool-name.md). `permissions-path-rule-tool` reads a
// `MultiEdit(path)` rule, so this rule skips that form.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-legacy-tool-name' as const

type MessageId = 'task' | 'multiEdit'
type Options = [{ minVersion?: string }]

/** The version that renamed `Task` to `Agent`, from the sub-agents page of the docs. */
const RENAME_VERSION = '2.1.63'

/** True when version `a` is lower than version `b`. Both are `major.minor.patch`. */
function isBelow(a: string, b: string): boolean {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const at = left.findIndex((part, index) => part !== right[index])
  return at !== -1 && (left[at] as number) < (right[at] as number)
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write Agent in place of Task, and Edit in place of MultiEdit',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      task: 'Claude Code renamed the `Task` tool to `Agent` in v2.1.63. `Task` still works as an alias. Write `{{replacement}}`.',
      multiEdit:
        '`MultiEdit` is a legacy tool. Write `Edit`: its rules apply to all built-in tools that edit files.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    const skipTask = minVersion !== undefined && isBelow(minVersion, RENAME_VERSION)
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const { tool, specifier } = entry.rule
        if (tool === 'Task') {
          if (skipTask) {
            continue
          }
          const replacement = specifier === null ? 'Agent' : `Agent(${specifier})`
          context.report({ loc: entry.loc, messageId: 'task', data: { replacement } })
        } else if (tool === 'MultiEdit' && specifier === null) {
          context.report({ loc: entry.loc, messageId: 'multiEdit' })
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
