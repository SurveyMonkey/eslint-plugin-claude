// A rule file with `paths` that Claude Code reaches through a link out of the repository
// (docs/rules/rules-symlink-external-scoped.md). Claude Code treats such a link as an external
// import. The linked rules do not load until you approve external imports. After that, only the
// rules with no `paths` load. So a rule with `paths` never loads. The rule asks where the real
// path of the linted file is. It reads nothing in the target, because ESLint gave it the text.
// It makes no report for a link that leads nowhere. It makes none for a path that it cannot read
// (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { isInside, realOf, repositoryRoot } from '../skill-tree.ts'

const name = 'rules-symlink-external-scoped' as const

/** True when `paths` sets a scope: a string, or a list, with one glob that is not empty. An empty
 *  value is the same as an absent field. */
function isScoped(paths: unknown): boolean {
  const globs = typeof paths === 'string' ? paths.split(',') : Array.isArray(paths) ? paths : []
  return globs.some((glob) => typeof glob === 'string' && glob.trim() !== '')
}

/** True when the real path of `file` is out of the repository that holds its path. */
function leavesRepository(file: string): boolean {
  const real = realOf(file)
  return typeof real === 'string' && !isInside(real, repositoryRoot(path.dirname(file)))
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'neverLoads' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not scope a rule that is a link out of the repository with paths',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      neverLoads:
        'Claude Code reaches this rule through a link that leads out of the repository. It loads such a rule only after you approve external imports, and only if the rule has no `paths`. So this rule never loads. Remove `paths`, or move the file into the repository.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    const file = path.resolve(context.filename)
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('paths')
        if (
          fm === null ||
          field === undefined ||
          !isScoped(fm.data.paths) ||
          !leavesRepository(file)
        ) {
          return
        }
        context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId: 'neverLoads' })
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
