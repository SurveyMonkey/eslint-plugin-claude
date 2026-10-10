// Find out which instruction file a path is. The globs of the rules are broad,
// so each rule asks here what the file is (ADR 001, Decision 10). The answer
// comes from the path alone, and the check reads no file.
// The source is https://code.claude.com/docs/en/memory.
import path from 'node:path'

/** What an instruction file is:
 *  - `claude-md`: a `CLAUDE.md`, in any directory or in a `.claude/` directory.
 *  - `claude-local`: a `CLAUDE.local.md`.
 *  - `rule`: a file below a `.claude/rules/` directory, at any depth.
 *  - `agents-variant`: an `AGENTS.local.md` or `AGENTS.override.md`, or a
 *    Markdown file below a `.agents/` directory. Claude Code never reads these. */
export type MemoryFileKind = 'claude-md' | 'claude-local' | 'rule' | 'agents-variant'

/** The kind of the file at `file`, or null. A file below `.claude/rules/` is a
 *  rule, even when its name is `CLAUDE.md`. The check keeps the case of the
 *  names, because the docs do not say that Claude Code folds case. */
export function classifyMemoryFile(file: string): MemoryFileKind | null {
  const parts = path.resolve(file).split(path.sep)
  const base = parts[parts.length - 1] as string
  const folders = parts.slice(0, -1)
  if (folders.some((folder, index) => folder === '.claude' && folders[index + 1] === 'rules')) {
    return 'rule'
  }
  if (base === 'CLAUDE.md') {
    return 'claude-md'
  }
  if (base === 'CLAUDE.local.md') {
    return 'claude-local'
  }
  if (
    base === 'AGENTS.local.md' ||
    base === 'AGENTS.override.md' ||
    (folders.includes('.agents') && base.endsWith('.md'))
  ) {
    return 'agents-variant'
  }
  return null
}
