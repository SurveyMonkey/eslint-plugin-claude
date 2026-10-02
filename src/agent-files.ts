// Find out if a file is a subagent file or an output style file. The globs of
// the rules are broad, so each rule asks here where the file sits (ADR 001,
// Decision 10). A plugin root is found by its manifest. A root that the check
// cannot see gives null.
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import { UNREADABLE, type Unreadable } from './skill-tree.ts'

export interface ClaudeFile {
  /** True when the file is in a plugin. */
  plugin: boolean
}

/** Where the directory `dir` sits: in `.claude/`, in a plugin root, or
 *  neither. The result is `UNREADABLE` when the check cannot see the plugin
 *  root. */
function scopeOf(dir: string): ClaudeFile | null | Unreadable {
  const parent = path.dirname(dir)
  if (path.basename(parent) === '.claude') {
    return { plugin: false }
  }
  const root = isPluginRoot(parent)
  return root === UNREADABLE ? UNREADABLE : root ? { plugin: true } : null
}

/** What `file` is: a subagent file in `.claude/agents/` or in the `agents/`
 *  directory of a plugin, at any depth, or null. */
export function classifyAgentFile(file: string): ClaudeFile | null {
  // The deepest `agents/` directory that fits is the one that counts. The
  // loop ends at the root of the file system, which is its own parent.
  for (
    let dir = path.dirname(path.resolve(file));
    dir !== path.dirname(dir);
    dir = path.dirname(dir)
  ) {
    if (path.basename(dir) !== 'agents') {
      continue
    }
    const scope = scopeOf(dir)
    // The walk stops at a root that the check cannot see. It does not go on to an
    // `agents/` directory above it.
    if (scope === UNREADABLE) {
      return null
    }
    if (scope !== null) {
      return scope
    }
  }
  return null
}

/** What `file` is: an output style file directly in `.claude/output-styles/`
 *  or in the `output-styles/` directory of a plugin, or null. */
export function classifyOutputStyle(file: string): ClaudeFile | null {
  const dir = path.dirname(path.resolve(file))
  if (path.basename(dir) !== 'output-styles') {
    return null
  }
  const scope = scopeOf(dir)
  return scope === UNREADABLE ? null : scope
}
