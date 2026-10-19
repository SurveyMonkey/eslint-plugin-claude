// Claude Code preloads only the first 32 distinct names of the `skills` field of a subagent. It
// skips the rest with no error (docs/rules/agent-skills-preload-limit.md). No setting moves that
// number, so the option `max` has a schema maximum.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { listEntries } from '../frontmatter-list.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-skills-preload-limit' as const

// The number from the docs, the default of `max`, and its schema maximum.
const PRELOAD_LIMIT = 32

type Options = [{ max: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'overPreloadLimit' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Preload at most 32 distinct skills in a subagent',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            description: 'The most distinct names in the skills of a subagent.',
            type: 'integer',
            minimum: 1,
            maximum: PRELOAD_LIMIT,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: PRELOAD_LIMIT }],
    messages: {
      overPreloadLimit:
        '`skills` lists {{count}} distinct names. Claude Code preloads only the first {{max}}, so it does not preload `{{first}}` or a later distinct name, and shows no error.',
      overConfiguredLimit:
        '`skills` lists {{count}} distinct names. The configured limit is {{max}}, and `{{first}}` is over it.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    const [{ max }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        // A value that is not a list is the business of `agent-frontmatter-schema`.
        if (fm === null || !Array.isArray(fm.data.skills)) {
          return
        }
        // The docs do not say if Claude Code treats upper and lower case as different. The rule
        // counts two names that differ only in case as one, so it reports only a sure fault.
        const seen = new Set<string>()
        const distinct = listEntries(fm, node.value, 'skills', () => false).filter(({ text }) => {
          const key = text.toLowerCase()
          const added = !seen.has(key)
          seen.add(key)
          return added
        })
        const first = distinct[max]?.text
        if (first === undefined) {
          return
        }
        // An entry came from the field, so the field exists.
        const field = fm.fields.get('skills') as { valueStart: number; valueEnd: number }
        context.report({
          loc: fm.at(field.valueStart, field.valueEnd),
          // At another value, the message names the configured limit and claims no skip.
          messageId: max === PRELOAD_LIMIT ? 'overPreloadLimit' : 'overConfiguredLimit',
          data: { count: String(distinct.length), max: String(max), first },
        })
      },
    }
  },
}

export const target = { name, language: 'markdown' as const, files: ['**/agents/**/*.md'] }

export default rule
