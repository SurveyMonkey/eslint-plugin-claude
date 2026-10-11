// The frontmatter of an eval `prompt.md` takes 13 fields. The docs say that an unknown key is an
// error. They give limits for `runs`, `max_turns` and `timeout_seconds`, and a pattern for the keys of
// `env` (docs/rules/plugin-evals-prompt-frontmatter.md). The lists are in `src/data/plugin-layout.ts`.
// The rule reads the `prompt.md` of a case only. `src/plugin-evals.ts` finds the case. The rule
// makes no report when it cannot see the plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { EVAL_ENV_KEY, EVAL_PROMPT_FIELDS, EVAL_PROMPT_LIMITS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { isMap, nearMissOf } from '../frontmatter-values.ts'
import { evalFileOf } from '../plugin-evals.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'plugin-evals-prompt-frontmatter' as const

const KNOWN: ReadonlySet<string> = new Set(EVAL_PROMPT_FIELDS)

/** The limit of a number field as the docs write it: "1 to 50", or "at most 200". */
function limitText({ min, max }: { min?: number; max: number }): string {
  return min === undefined ? `at most ${max}` : `${min} to ${max}`
}

const rule: MarkdownRuleDefinition<{
  MessageIds: 'unknownKey' | 'nearMiss' | 'outOfRange' | 'envKey'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use the documented frontmatter fields, limits and env keys in an eval prompt.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknownKey:
        '`{{key}}` is not a frontmatter field of an eval `prompt.md`. The docs say that an unknown key is an error.',
      nearMiss:
        '`{{key}}` is not a frontmatter field of an eval `prompt.md`. The docs say that an unknown key is an error. Use `{{expected}}`.',
      outOfRange: '`{{key}}` is {{value}}, and the docs give the limit {{limit}}.',
      envKey:
        '`env` has the key "{{key}}". A key must match `EVAL_[A-Z0-9_]*`, and Claude Code fails the run for any other key.',
    },
  },
  create(context) {
    if (evalFileOf(context.filename)?.kind !== 'prompt') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const field of fm.fields.values()) {
          const { key } = field
          if (!KNOWN.has(key)) {
            const expected = nearMissOf(key, EVAL_PROMPT_FIELDS)
            context.report({
              loc: fm.at(field.keyStart, field.keyEnd),
              messageId: expected === undefined ? 'unknownKey' : 'nearMiss',
              data: { key, ...(expected === undefined ? {} : { expected }) },
            })
            continue
          }
          const value = fm.data[key]
          const limit = EVAL_PROMPT_LIMITS.get(key)
          if (
            limit !== undefined &&
            typeof value === 'number' &&
            (value > limit.max || value < (limit.min ?? Number.NEGATIVE_INFINITY))
          ) {
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              messageId: 'outOfRange',
              data: { key, value: String(value), limit: limitText(limit) },
            })
          }
          if (key === 'env' && isMap(value)) {
            for (const envKey of Object.keys(value)) {
              if (!EVAL_ENV_KEY.test(envKey)) {
                context.report({
                  loc: fm.at(field.valueStart, field.valueEnd),
                  messageId: 'envKey',
                  data: { key: envKey },
                })
              }
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/prompt.md'],
}

export default rule
