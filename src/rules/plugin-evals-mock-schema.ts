// A mock file in `mocks/<server>/` of an eval suite has the type `fixed` or `agent`. The key `error`
// works with `fixed` only, and the key `abort_when` with `agent` only
// (docs/rules/plugin-evals-mock-schema.md). The mock type list is in `src/data/plugin-layout.ts`.
// `src/plugin-evals.ts` finds the mock files. The rule makes no report when it cannot see the
// plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { EVAL_MOCK_TYPES } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { evalFileOf } from '../plugin-evals.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'plugin-evals-mock-schema' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'badType' | 'errorAgent' | 'abortFixed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use the type, error and abort_when keys of an eval mock file as documented',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      badType: '`type` is {{value}}. A mock `type` is `fixed` or `agent`.',
      errorAgent:
        '`error` works with `type: fixed` only, and this mock is `agent`. Set `type: fixed`, or remove `error`.',
      abortFixed:
        '`abort_when` works with `type: agent` only, and this mock is `fixed`. Set `type: agent`, or remove `abort_when`.',
    },
  },
  create(context) {
    if (evalFileOf(context.filename)?.kind !== 'mock') {
      return {}
    }
    // The docs call `_server.md` an agent mock, and do not say that it needs a `type`. So without
    // a `type`, the file has no type that the rule can read.
    const isServerFile = context.filename.endsWith('_server.md')
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const { type, error, abort_when: abortWhen } = fm.data
        // A key that an alias writes is in the data and has no field, so the rule cannot place it.
        const report = (key: string, messageId: 'badType' | 'errorAgent' | 'abortFixed') => {
          const field = fm.fields.get(key)
          if (field === undefined) {
            return
          }
          const onValue = messageId === 'badType'
          context.report({
            loc: onValue
              ? fm.at(field.valueStart, field.valueEnd)
              : fm.at(field.keyStart, field.keyEnd),
            messageId,
            data: {
              value: context.sourceCode.text.slice(
                fm.base + field.valueStart,
                fm.base + field.valueEnd,
              ),
            },
          })
        }
        if (type !== null && type !== undefined && !EVAL_MOCK_TYPES.includes(type as string)) {
          report('type', 'badType')
          return
        }
        const effective = type ?? (isServerFile ? undefined : 'fixed')
        if (effective === 'agent' && error === true) {
          report('error', 'errorAgent')
        }
        if (effective === 'fixed' && abortWhen !== null && abortWhen !== undefined) {
          report('abort_when', 'abortFixed')
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/mocks/*/*.md'],
  rule,
}
