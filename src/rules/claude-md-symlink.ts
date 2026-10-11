// A `CLAUDE.md` that is a symlink (docs/rules/claude-md-symlink.md). Git checks a committed
// symlink out as a plain text file on a Windows clone without `core.symlinks`, and that leaves
// the clone with a one-line `CLAUDE.md`. The Edit and Write tools refuse to write through a
// link. The docs name the import `@AGENTS.md` as the safe choice. The rule asks the file system
// if the file is a link. A link on disk is a link, so a clone that checked out a plain file gets
// no report. The rule does not read the Git mode (120000). It makes no report for a file that it
// cannot read (ADR 001, Decision 14).
import { lstatSync, readlinkSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, isNetworkTarget } from '../memory-files.ts'

const name = 'claude-md-symlink' as const

/** The text of the link at `file`, or null when `file` is no link or cannot be read. */
function targetOf(file: string): string | null {
  try {
    return lstatSync(file).isSymbolicLink() ? readlinkSync(file) : null
  } catch {
    return null
  }
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'symlink' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Make a CLAUDE.md a regular file, and import AGENTS.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      symlink:
        'This CLAUDE.md is a link to `{{target}}`. A Windows clone without `core.symlinks` gets a one-line file, and Edit and Write refuse to write through a link. Make it a regular file that holds `@AGENTS.md`.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'claude-md') {
      return {}
    }
    const target = targetOf(path.resolve(context.filename))
    // `memory-symlink-network-target` reports a link to the network.
    if (target === null || isNetworkTarget(target)) {
      return {}
    }
    return {
      root() {
        context.report({
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          messageId: 'symlink',
          data: { target },
        })
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md'],
  rule,
}
