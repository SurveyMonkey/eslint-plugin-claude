// A `paths` glob of a rule file must be one that Claude Code can use
// (docs/rules/rules-paths-glob-valid.md). A rule file takes the same `paths` as a skill, so
// the checks are the ones of `skill-paths-glob-valid`, in `src/paths-glob.ts`. These are a `[`
// with no bracket expression, and brace groups that expand past the budget.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { checkGlobs } from '../paths-glob.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'rules-paths-glob-valid' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'bracket' | 'budget' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use valid globs in the `paths` field of a rule file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bracket:
        '`{{pattern}}` has a `[` that starts no bracket expression. Claude Code matches no file with it. Escape the `[` as `\\[`.',
      budget:
        'The brace groups in `paths` expand to {{count}} patterns and {{bytes}} bytes. The limit is 1,000 patterns or 4 MiB. Claude Code then keeps the patterns that exceed the budget as they are, and their braces match no file.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('paths')
        if (fm === null || field === undefined) {
          return
        }
        const loc = fm.at(field.valueStart, field.valueEnd)
        const { broken, count, bytes, overBudget } = checkGlobs(fm.data.paths)
        for (const pattern of broken) {
          context.report({ loc, messageId: 'bracket', data: { pattern } })
        }
        if (overBudget) {
          context.report({
            loc,
            messageId: 'budget',
            data: { count: String(count), bytes: String(bytes) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/rules/**/*.md'],
  rule,
}
