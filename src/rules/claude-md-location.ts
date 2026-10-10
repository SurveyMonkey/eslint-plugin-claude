// A file at a name or place where Claude Code does not load it
// (docs/rules/claude-md-location.md). The docs list `CLAUDE.md`, `.claude/CLAUDE.md` and
// `CLAUDE.local.md` in a project folder. The rule reports `.claude/CLAUDE.local.md`, and a name
// that differs from those two only in case, such as `claude.md`. The check reads the path only.
// A rule file is checked by the rules of `.claude/rules/`, and a file below `.agents/` by
// `claude-md-agents-md-variant`, so the rule skips both. A file below `commands/`, `agents/`,
// `skills/` or `output-styles/` of a `.claude/` folder is not a memory file, and the rule skips it.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-location' as const

// The two names that Claude Code loads, in a project folder.
const LOADED = new Set(['CLAUDE.md', 'CLAUDE.local.md'])
// A command, subagent, skill or output style may have any name, `claude.md` among them.
const TOOL_FILE = /\/\.claude\/(?:commands|agents|skills|output-styles)\//
const VARIANT = /^claude(?:\.local)?\.md$/i

const rule: MarkdownRuleDefinition<{ MessageIds: 'localInClaude' | 'caseVariant' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put a CLAUDE.md file where Claude Code loads it, with its exact name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      localInClaude:
        'Claude Code loads `CLAUDE.local.md` from the project folder, not from `.claude/`. Move this file next to `.claude/`.',
      caseVariant:
        'Claude Code loads `CLAUDE.md` and `CLAUDE.local.md` by these names, in capitals. It may not load `{{file}}`, and a file system that ignores case cannot hold both names. Rename the file.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    const file = path.resolve(context.filename)
    if (
      kind === 'rule' ||
      kind === 'agents-variant' ||
      TOOL_FILE.test(file.split(path.sep).join('/'))
    ) {
      return {}
    }
    const base = path.basename(file)
    const messageId =
      base === 'CLAUDE.local.md' && path.basename(path.dirname(file)) === '.claude'
        ? 'localInClaude'
        : VARIANT.test(base) && !LOADED.has(base)
          ? 'caseVariant'
          : null
    return {
      root() {
        if (messageId !== null) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            messageId,
            data: { file: base },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/*.md'],
  rule,
}
