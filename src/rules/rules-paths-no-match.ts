// A `paths` glob of a rule file that matches no file (docs/rules/rules-paths-no-match.md). A
// path-scoped rule loads when Claude works with a file that a glob matches, so a glob that
// matches nothing scopes the rule to nothing. The rule matches each glob against the files on
// disk below the folder that holds `.claude/`, bounded at the repository root (`src/glob-match.ts`
// has the details). It reads the disk, not the files that Git tracks, because the plugin has no
// Git reader. It makes no report for a glob that `rules-paths-glob-valid` reports, and none when
// it cannot read a part of the tree (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { unmatchedGlobs } from '../glob-match.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { gitTop } from '../memory-imports.ts'
import { checkGlobs, patternsOf } from '../paths-glob.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'rules-paths-no-match' as const

/** The folder that holds the `.claude/` directory of the rule file `file`: the nearest
 *  `.claude` that has `rules` below it. */
function projectOf(file: string): string {
  const parts = path.resolve(file).split(path.sep)
  const at = parts.findLastIndex((part, i) => part === '.claude' && parts[i + 1] === 'rules')
  return parts.slice(0, at).join(path.sep)
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'noMatch' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use a paths glob that matches at least one file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noMatch:
        'The glob "{{pattern}}" matches no file below the folder that holds `.claude/`, so Claude Code never loads this rule for it. Fix the glob, or remove it. A glob is relative to that folder.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    const project = projectOf(context.filename)
    // Without a repository, the walk has no bound.
    if (gitTop(project) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('paths')
        if (fm === null || field === undefined) {
          return
        }
        const { broken, overBudget } = checkGlobs(fm.data.paths)
        // `rules-paths-glob-valid` reports a broken glob and a list past the budget.
        if (overBudget) {
          return
        }
        const globs = patternsOf(fm.data.paths).filter(
          (glob) => glob !== '' && !broken.includes(glob),
        )
        const missing =
          globs.length === 0 ? [] : unmatchedGlobs(project, repositoryRoot(project), globs)
        for (const pattern of missing ?? []) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'noMatch',
            data: { pattern },
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
