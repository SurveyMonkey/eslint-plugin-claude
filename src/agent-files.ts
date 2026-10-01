// Find out if a file is a subagent file or an output style file. The globs of
// the rules are broad, so each rule asks here where the file sits (ADR 001,
// Decision 10). A plugin root is found by its manifest.
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'

/** The frontmatter fields of a subagent file. The source is the Frontmatter
 *  reference of the Claude Code docs (docs/rules/agent-frontmatter-schema.md). */
export const AGENT_FIELDS = [
  'name',
  'description',
  'tools',
  'disallowedTools',
  'model',
  'permissionMode',
  'maxTurns',
  'skills',
  'mcpServers',
  'hooks',
  'memory',
  'background',
  'omitClaudeMd',
  'effort',
  'isolation',
  'color',
  'initialPrompt',
  'experimental',
] as const

/** The frontmatter fields of an output style file. */
export const OUTPUT_STYLE_FIELDS = [
  'name',
  'description',
  'keep-coding-instructions',
  'force-for-plugin',
] as const

export interface ClaudeFile {
  /** True when the file is in a plugin. */
  plugin: boolean
}

/** Where the directory `dir` sits: in `.claude/`, in a plugin root, or
 *  neither. */
function scopeOf(dir: string): ClaudeFile | null {
  const parent = path.dirname(dir)
  if (path.basename(parent) === '.claude') {
    return { plugin: false }
  }
  return isPluginRoot(parent) ? { plugin: true } : null
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
  return path.basename(dir) === 'output-styles' ? scopeOf(dir) : null
}
