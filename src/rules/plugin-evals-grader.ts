// A grader file in the `graders/` directory of an eval case sets its `type`, and may set `weight` and
// `arm`. A `regex` grader takes `target` and `pattern`, and an `llm` grader takes `focus`
// (docs/rules/plugin-evals-grader.md). The lists are in `src/data/plugin-layout.ts`. The rule
// reads the grader files of a case only. `src/plugin-evals.ts` finds them. It makes no report
// when it cannot see the plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { EVAL_GRADER_ARMS, EVAL_GRADER_TARGETS, EVAL_GRADER_TYPES } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { isMap } from '../frontmatter-values.ts'
import { evalFileOf } from '../plugin-evals.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'plugin-evals-grader' as const

// The types as an English list: "`regex`, `tool_used` and so on", with "or" before the last one.
const QUOTED = EVAL_GRADER_TYPES.map((type) => `\`${type}\``)
const TYPE_LIST = `${QUOTED.slice(0, -1).join(', ')} or ${QUOTED.at(-1)}`

// An inline flag group `(?i)` is not in the JavaScript regex syntax of the grader.
const INLINE_FLAG = /\(\?i\)/

/** True when `value` is a form that `target` or `focus` accepts: a name of the table, or the map
 *  `{ source: file, path: <path> }`. */
function isTarget(value: unknown): boolean {
  if (typeof value === 'string') {
    return EVAL_GRADER_TARGETS.includes(value)
  }
  return (
    isMap(value) && value.source === 'file' && typeof value.path === 'string' && value.path !== ''
  )
}

const rule: MarkdownRuleDefinition<{
  MessageIds: 'noType' | 'badType' | 'badWeight' | 'badArm' | 'badTarget' | 'inlineFlag'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give an eval grader a valid type, weight, arm, target and focus',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noType: `The grader has no \`type\`. Set it to one of ${TYPE_LIST}.`,
      badType: `\`type\` is {{value}}, which is not a grader type. Use one of ${TYPE_LIST}.`,
      badWeight: '`weight` is {{value}}. It must be a positive number.',
      badArm: '`arm` is {{value}}. Use `with-only` or `both`, or leave `arm` out.',
      badTarget:
        '`{{key}}` is {{value}}. Use `last_message`, `trace`, `files`, `mock_calls`, or `{ source: file, path: <path> }`.',
      inlineFlag:
        'The pattern uses `(?i)`, which is not supported. Put case-insensitivity in `flags: i`.',
    },
  },
  create(context) {
    if (evalFileOf(context.filename)?.kind !== 'grader') {
      return {}
    }
    const { sourceCode } = context
    let seen = false
    return {
      yaml(node) {
        seen = true
        const fm = readFrontmatter(sourceCode, node)
        if (fm === null) {
          return
        }
        /** Report `messageId` on the value of the field `key`, which is in the block. The data has
         *  the value as it is written in the file. */
        const onValue = (
          key: string,
          messageId: 'badType' | 'badWeight' | 'badArm' | 'badTarget' | 'inlineFlag',
          extra: Record<string, string> = {},
        ) => {
          const field = fm.fields.get(key)
          if (field !== undefined) {
            const value = sourceCode.text.slice(
              fm.base + field.valueStart,
              fm.base + field.valueEnd,
            )
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              messageId,
              data: { value, ...extra },
            })
          }
        }
        const { type } = fm.data
        if (type === null || type === undefined) {
          context.report({ loc: sourceCode.getLoc(node), messageId: 'noType' })
        } else if (!EVAL_GRADER_TYPES.includes(type as string)) {
          onValue('type', 'badType')
        }
        const { weight, arm } = fm.data
        if (
          weight !== null &&
          weight !== undefined &&
          !(typeof weight === 'number' && weight > 0)
        ) {
          onValue('weight', 'badWeight')
        }
        if (arm !== null && arm !== undefined && !EVAL_GRADER_ARMS.includes(arm as string)) {
          onValue('arm', 'badArm')
        }
        // `target` belongs to a `regex` grader, and `focus` to an `llm` grader.
        const view = type === 'regex' ? 'target' : type === 'llm' ? 'focus' : undefined
        const chosen = view === undefined ? undefined : fm.data[view]
        if (view !== undefined && chosen !== null && chosen !== undefined && !isTarget(chosen)) {
          onValue(view, 'badTarget', { key: view })
        }
        const { pattern } = fm.data
        if (type === 'regex' && typeof pattern === 'string' && INLINE_FLAG.test(pattern)) {
          onValue('pattern', 'inlineFlag')
        }
      },
      'root:exit'() {
        // A grader with no frontmatter block has no `type`.
        if (!seen) {
          context.report({ loc: { line: 1, column: 1 }, messageId: 'noType' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/graders/*.md'],
  rule,
}
