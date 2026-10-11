// Claude receives the body of an eval `prompt.md` as it is written. An `@path` mention is not
// expanded into a file attachment (docs/rules/plugin-evals-prompt-no-at-mentions.md). The rule
// reads the mentions with `parseImports` of `src/memory-imports.ts`, which skips code spans, fenced
// blocks and comments. `src/plugin-evals.ts` finds the case. The rule makes no report when it
// cannot see the plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { parseImports } from '../memory-imports.ts'
import { evalFileOf } from '../plugin-evals.ts'

const name = 'plugin-evals-prompt-no-at-mentions' as const

// The end of a sentence is not part of a path.
const END_MARKS = /[.,;:!?)\]}>"']+$/

const rule: MarkdownRuleDefinition<{ MessageIds: 'mention' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not write an @path mention in the body of an eval prompt.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      mention:
        'The text `@{{path}}` in the prompt is not expanded into a file attachment, so Claude receives it as written. To let Claude read the file, list a tool for it in `allowed_tools`, such as `Read`.',
    },
  },
  create(context) {
    if (evalFileOf(context.filename)?.kind !== 'prompt') {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        // The frontmatter is not the body.
        const first = node.children[0]
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        for (const mention of parseImports(sourceCode.text.slice(start))) {
          const path = mention.path.replace(END_MARKS, '')
          if (path === '') {
            continue
          }
          // The source holds `@` and the path, with a `\` before each space.
          const from = start + mention.index
          const length = 1 + path.length + path.split(' ').length - 1
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(from + length),
            },
            messageId: 'mention',
            data: { path },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/prompt.md'],
  rule,
}
