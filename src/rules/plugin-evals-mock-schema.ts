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
        const typeField = fm.fields.get('type')
        if (type !== null && type !== undefined && !EVAL_MOCK_TYPES.includes(type as string)) {
          const field = typeField as NonNullable<typeof typeField>
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'badType',
            data: {
              value: context.sourceCode.text.slice(
                fm.base + field.valueStart,
                fm.base + field.valueEnd,
              ),
            },
          })
          return
        }
        const effective = type ?? (isServerFile ? undefined : 'fixed')
        const keyOf = (key: string) => {
          const field = fm.fields.get(key) as NonNullable<typeof typeField>
          return fm.at(field.keyStart, field.keyEnd)
        }
        if (effective === 'agent' && error === true) {
          context.report({ loc: keyOf('error'), messageId: 'errorAgent' })
        }
        if (effective === 'fixed' && abortWhen !== null && abortWhen !== undefined) {
          context.report({ loc: keyOf('abort_when'), messageId: 'abortFixed' })
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
