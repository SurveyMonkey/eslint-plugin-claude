// A file in `.claude/rules/` that Claude Code does not discover
// (docs/rules/rules-md-extension.md). The docs say that Claude Code finds all `.md` files in
// the directory, at any depth. The docs name no other extension.
//
// The files globs name every file below `.claude/rules/`, because the file to report is not a
// Markdown file. ESLint lints a file only when a pattern names it and does not end in `/*` or
// `/**`. So one glob names the files with a dot, and one names the files with none.
//
// The rule makes no report on a hidden file such as `.gitkeep`. It reads the extension without
// case, because the docs do not say that Claude Code treats `.MD` differently from `.md`.
//
// One rule object serves two languages. The Markdown tree has a `root` node, and the JSON tree
// has a `Document` node. The `also` block of `target` gives a JSON file below `.claude/rules/`
// the JSON language. The `Document` listener reports on that file.
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'rules-md-extension' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each file in .claude/rules/ the .md extension',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      extension:
        'Claude Code discovers only `.md` files in `.claude/rules/`. It ignores this file. Rename it to end in `.md`, or move it out of the directory.',
    },
  },
  create(context) {
    const base = path.basename(context.filename)
    if (
      classifyMemoryFile(context.filename) !== 'rule' ||
      base.startsWith('.') ||
      path.extname(base).toLowerCase() === '.md'
    ) {
      return {}
    }
    const report = () =>
      context.report({
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
        messageId: 'extension',
      })
    return { root: report, Document: report }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/rules/**/*.*', '**/.claude/rules/**/!(*.*)'],
  // The same rule, for the JSON files below `.claude/rules/`.
  also: { language: 'json' as const, files: ['**/.claude/rules/**/*.json'] },
}

export default rule
