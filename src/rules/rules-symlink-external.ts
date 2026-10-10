// A rule file that Claude Code reaches through a link out of the repository
// (docs/rules/rules-symlink-external.md). Claude Code treats such a link like an external import.
// The linked rules do not load until each user approves external imports for the project. The
// rule looks at each part of the path of the linted file, from the `.claude` folder down. It
// reports the first part that is a link whose real path is outside the repository. It reads no
// file content in the target, because ESLint gave it the text. It makes no report for a link that
// leads nowhere, for a path that it cannot read, or for a tree with no `.git` (ADR 001,
// Decision 14).
import { lstatSync, readlinkSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, isNetworkTarget, isScopedRule } from '../memory-files.ts'
import { gitTop } from '../memory-imports.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { isInside, realOf, repositoryRoot } from '../skill-tree.ts'

const name = 'rules-symlink-external' as const

/** The paths of a rule file that can be a link: the `.claude` folder that holds `rules`, each
 *  folder below `rules`, and the file. They come from the top down. */
function entriesOf(file: string): string[] {
  const parts = file.split(path.sep)
  // The classifier gives the kind `rule` only for a path with a `.claude/rules` folder.
  const start = parts.findIndex((part, i) => part === '.claude' && parts[i + 1] === 'rules')
  return parts.slice(start).map((_, i) => parts.slice(0, start + i + 1).join(path.sep))
}

/** The first part of the path of `file` that is a link with a real path out of `bound`, with the
 *  text of the link. The result is null when there is none, and when a part leads nowhere, is a
 *  link to the network, or cannot be read. */
function linkOut(file: string, bound: string): { entry: string; target: string } | null {
  for (const entry of entriesOf(file)) {
    let target: string
    try {
      if (!lstatSync(entry).isSymbolicLink()) {
        continue
      }
      target = readlinkSync(entry)
    } catch {
      return null
    }
    // `memory-symlink-network-target` reports a link to the network.
    const real = isNetworkTarget(target) ? null : realOf(entry)
    if (typeof real !== 'string') {
      return null
    }
    if (!isInside(real, bound)) {
      return { entry, target }
    }
  }
  return null
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'external' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not link a rule file to a folder outside the repository',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      external:
        '`{{link}}` is a link to `{{target}}`, which is outside the repository. Claude Code loads the linked rules only after each user approves external imports. Copy the rules into the repository, or keep them in `~/.claude/rules/`.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    const file = path.resolve(context.filename)
    const top = gitTop(path.dirname(file))
    // With no `.git`, the end of the repository is not known.
    if (top === null) {
      return {}
    }
    const bound = repositoryRoot(path.dirname(file))
    let scoped = false
    return {
      yaml(node) {
        scoped = isScopedRule(readFrontmatter(context.sourceCode, node)?.data.paths)
      },
      'root:exit'() {
        const found = linkOut(file, bound)
        if (found === null) {
          return
        }
        // `rules-symlink-external-scoped` reports a rule with `paths` that sits behind such a link.
        const real = realOf(file)
        if (scoped && typeof real === 'string' && !isInside(real, bound)) {
          return
        }
        context.report({
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          messageId: 'external',
          data: {
            link: path.relative(top, found.entry).split(path.sep).join('/'),
            target: found.target,
          },
        })
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
