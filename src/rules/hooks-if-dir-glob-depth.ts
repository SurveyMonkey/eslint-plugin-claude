// A single-segment directory pattern in an `if` condition, such as `Edit(src/**)`, matches only the directory in the
// working directory since v2.1.214 (docs/rules/hooks-if-dir-glob-depth.md). Before that version it matched a directory of
// that name at any depth. The hooks reference states both behaviors, but a repository file does not say which version runs
// it. So the rule reports only with the option `minVersion` at v2.1.214 or later, and nothing when it is unset.
// `hooks-if-condition` owns an `if` that is no rule, and an `if` on an event that is no tool event.
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf } from '../hooks-config.ts'
import { parsePermissionRule } from '../permission-rule.ts'

const name = 'hooks-if-dir-glob-depth' as const

/** The first version with the behavior. Source: the hooks reference, "Common fields". */
const SINCE = '2.1.214'

/** The tools whose `if` rule is a path pattern: the Read family and the Edit family of the tools reference. */
const FILE_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'NotebookEdit']

/** A directory name, then `/**` and nothing more. The name has no slash and no glob character. It does not start
 *  with `!` (a negation), `~` (a home path) or `.` alone, and `.` and `..` are not names. */
const SINGLE_SEGMENT = /^(?![.]{1,2}\/)([^/*?[\]{}!~\\][^/*?[\]{}\\]*)\/\*\*$/

interface Options {
  minVersion?: string
}

/** True when the version `version` is `limit` or later. Both are `major.minor.patch`. */
function atLeast(version: string, limit: string): boolean {
  const have = version.split('.').map(Number)
  const want = limit.split('.').map(Number)
  const index = have.findIndex((part, at) => part !== want[at])
  return index === -1 || (have[index] as number) > (want[index] as number)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Write a directory pattern in a hook if condition so that it matches at the depth you mean',
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
      depth: `Since v${SINCE}, "{{rule}}" matches only the "{{dir}}" directory in the working directory. The option minVersion is {{min}}. To match a directory named "{{dir}}" at any depth, write "{{tool}}(**/{{dir}}/**)".`,
    },
  },
  create(context) {
    const [{ minVersion }] = context.options as [Options]
    if (minVersion === undefined || !atLeast(minVersion, SINCE)) {
      return {}
    }
    return hooksListener(context, (source) => {
      for (const { event, handler } of handlersOf(source)) {
        const node = memberOf(handler, 'if')?.value
        if (node?.kind !== 'string' || !TOOL_EVENTS.includes(event)) {
          continue
        }
        const parsed = parsePermissionRule(node.value)
        const dir = parsed.ok ? SINGLE_SEGMENT.exec(parsed.specifier ?? '')?.[1] : undefined
        if (parsed.ok && dir !== undefined && FILE_TOOLS.includes(parsed.tool)) {
          context.report({
            loc: node.loc,
            messageId: 'depth',
            data: { rule: node.value, dir, min: minVersion, tool: parsed.tool },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
