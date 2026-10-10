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

/** True for an `AGENTS.md` that Claude Code can read: in any directory, or in
 *  a `.claude/` directory. The path `.claude/rules/AGENTS.md` is a rule, and
 *  `.agents/AGENTS.md` is a file that Claude Code never reads. So neither
 *  counts. `classifyMemoryFile` gives null for an `AGENTS.md`, and keeps it. */
export function isAgentsMd(file: string): boolean {
  return path.basename(file) === 'AGENTS.md' && classifyMemoryFile(file) === null
}

/** The number of lines in `text`. A line end ends a line, and does not start a new one. */
export function lineCount(text: string): number {
  const lines = text.split(/\r\n|[\r\n\u2028\u2029]/)
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
}

// A UNC share: two backslashes and a host. The hosts `\\wsl$` and `\\wsl.localhost` lead to a
// Linux distribution on the same machine. The docs say that `\\wsl$` paths are not network
// paths. A long path (`\\?\C:\`) and a device path (`\\.\pipe\`) are local. A long UNC path
// (`\\?\UNC\server\share`) is a share. The rule `memory-symlink-network-target` has the
// same test.
const UNC = /^\\\\(?:\?\\UNC\\|(?![?.]\\)(?!wsl\$(?:\\|$))(?!wsl\.localhost(?:\\|$)))/i
// A path under `/net` or `/Network`, or the folder itself.
const MOUNT = /^\/(?:net|Network)(?:\/|$)/

/** True when `target`, the text of a link, is a network path. Claude Code does not follow such
 *  a link, and `memory-symlink-network-target` reports it. So a rule about links leaves it. */
export function isNetworkTarget(target: string): boolean {
  return UNC.test(target) || MOUNT.test(target)
}

/** True when the value of `paths` sets a scope: a string, or a list, with one glob that is
 *  not empty. An empty value is the same as an absent field. The rule
 *  `rules-symlink-external-scoped` has the same test. */
export function isScopedRule(paths: unknown): boolean {
  const globs = typeof paths === 'string' ? paths.split(',') : Array.isArray(paths) ? paths : []
  return globs.some((glob) => typeof glob === 'string' && glob.trim() !== '')
}
