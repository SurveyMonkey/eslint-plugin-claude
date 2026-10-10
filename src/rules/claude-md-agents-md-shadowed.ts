// An `AGENTS.md` that no `CLAUDE.md` file lets through (docs/rules/claude-md-agents-md-shadowed.md).
// By default Claude Code reads an `AGENTS.md` in one case. No `CLAUDE.md`, `.claude/CLAUDE.md` or
// `CLAUDE.local.md` may exist in the working directory or above it. A CLAUDE.md file that imports
// the `AGENTS.md`, or links to it, loads it. The rule looks at the folder of the linted file and
// each folder above it, up to the repository root. It makes no report when it cannot read a file
// or a folder on the way. Such a file can be the import (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { isAgentsMd } from '../memory-files.ts'
import { followImports, locate, readImported } from '../memory-imports.ts'
import { isInside, realOf, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'claude-md-agents-md-shadowed' as const

// The files in a folder that count as a CLAUDE.md for the check of the docs.
const CLAUDE_FILES = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md']

// The depth of the chain of imports that loads (the same limit as `claude-md-import-max-depth`).
const DEPTH = 4

/** The nearest CLAUDE file, as a path from the repository root, that shadows
 *  the `AGENTS.md` at `file`. The result is null in three cases. No CLAUDE
 *  file shadows it. A CLAUDE file loads it. The rule cannot read what it needs
 *  to tell. `home` is the working directory that the file belongs to. */
function shadowOf(file: string, home: string): string | null {
  const bound = repositoryRoot(home)
  const real = realOf(file)
  if (real === UNREADABLE || (typeof real === 'string' && !isInside(real, bound))) {
    return null
  }
  // A file that is not on disk is read at its own path.
  const key = typeof real === 'string' ? real : path.resolve(file)
  let first: string | null = null
  let dir = home
  for (;;) {
    const here = realOf(dir)
    if (typeof here !== 'string') {
      return null
    }
    for (const claude of CLAUDE_FILES) {
      const candidate = path.join(dir, claude)
      const found = locate(candidate, bound)
      if (found === UNREADABLE) {
        return null
      }
      const text = found === 'missing' ? null : readImported(found.real)
      if (text === UNREADABLE) {
        return null
      }
      if (typeof text === 'string') {
        const chain = followImports(candidate, text, bound, DEPTH)
        if (chain.loaded.has(key) || chain.unreadable) {
          return null
        }
        first ??= candidate
      }
    }
    const parent = path.dirname(dir)
    if (here === bound || parent === dir) {
      return first === null ? null : path.relative(dir, first).split(path.sep).join('/')
    }
    dir = parent
  }
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'shadowed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Import an AGENTS.md from the CLAUDE.md file that shadows it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shadowed:
        'Claude Code does not read this file, because `{{shadow}}` exists in this folder or above it. Import this file from a CLAUDE.md file with `@`, or delete that file.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    if (!isAgentsMd(file)) {
      return {}
    }
    const folder = path.dirname(file)
    // The files `AGENTS.md` and `.claude/AGENTS.md` both belong to the folder above `.claude`.
    const home = path.basename(folder) === '.claude' ? path.dirname(folder) : folder
    return {
      root() {
        const shadow = shadowOf(file, home)
        if (shadow !== null) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            messageId: 'shadowed',
            data: { shadow },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/AGENTS.md'],
  rule,
}
