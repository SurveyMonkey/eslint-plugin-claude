// A `paths` glob of a skill must be one that Claude Code can use
// (docs/rules/skill-paths-glob-valid.md). The rule checks the three faults that
// the docs name. These are a `[` with no bracket expression, brace groups that
// expand past the budget, and a `..` that leads out of the working directory.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { checkGlobs, patternsOf } from '../paths-glob.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-paths-glob-valid' as const

/** True when a `..` segment of `pattern` leads above the start of the pattern. The docs say that a
 *  skill pattern is relative to the working directory, and that no file outside it matches. An
 *  absolute pattern is not checked: the docs do not say that it never matches. A `.` segment and
 *  an empty segment stay at the same level. Each other segment, such as `*` or `**`, goes down one
 *  level. The check does not expand brace groups. */
function leavesStart(pattern: string): boolean {
  if (pattern.startsWith('/')) {
    return false
  }
  let depth = 0
  for (const segment of pattern.split('/')) {
    if (segment === '..') {
      depth--
      if (depth < 0) {
        return true
      }
    } else if (segment !== '.' && segment !== '') {
      depth++
    }
  }
  return false
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'bracket' | 'budget' | 'parent' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use valid globs in the `paths` field of a skill',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bracket:
        '`{{pattern}}` has a `[` that starts no bracket expression. Claude Code matches no file with it. Escape the `[` as `\\[`.',
      parent:
        '`{{pattern}}` has a `..` that leads out of the working directory. Claude Code matches no file outside that directory, so the pattern matches nothing. Write the pattern from the working directory.',
      budget:
        'The brace groups in `paths` expand to {{count}} patterns and {{bytes}} bytes. The limit is 1,000 patterns or 4 MiB. Claude Code then keeps the patterns that exceed the budget as they are, and their braces match no file.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const field = fm.fields.get('paths')
        if (field === undefined) {
          return
        }
        const loc = fm.at(field.valueStart, field.valueEnd)
        const { broken, count, bytes, overBudget } = checkGlobs(fm.data.paths)
        for (const pattern of broken) {
          context.report({ loc, messageId: 'bracket', data: { pattern } })
        }
        for (const pattern of patternsOf(fm.data.paths).filter(leavesStart)) {
          context.report({ loc, messageId: 'parent', data: { pattern } })
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

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md'],
}

export default rule
