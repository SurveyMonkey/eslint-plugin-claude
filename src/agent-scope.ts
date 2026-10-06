// The scope of a subagent file: the directory that holds its `agents/`
// directory. A rule that compares an agent with other files of its scope
// reads this.
import path from 'node:path'
import { classifyAgentFile } from './agent-files.ts'
import { isPluginRoot } from './plugin-root.ts'

export interface AgentScope {
  /** True when the file is in a plugin. */
  plugin: boolean
  /** The `.claude/` directory of a local agent, or the root of a plugin. */
  root: string
}

/** The scope of the agent file `file`, or null when the file is no agent file.
 *  `classifyAgentFile` decides the kind. The scope is the parent of the
 *  deepest `agents/` directory above the file that fits that kind. */
export function agentScope(file: string): AgentScope | null {
  const kind = classifyAgentFile(file)
  if (kind === null) {
    return null
  }
  const dirs: string[] = []
  for (let dir = path.dirname(path.resolve(file)); dir !== path.dirname(dir); ) {
    dirs.push(dir)
    dir = path.dirname(dir)
  }
  // `classifyAgentFile` found such a directory, so `find` cannot give
  // `undefined`.
  const agents = dirs.find(
    (dir) =>
      path.basename(dir) === 'agents' &&
      (kind.plugin
        ? path.basename(path.dirname(dir)) !== '.claude' && isPluginRoot(path.dirname(dir)) === true
        : path.basename(path.dirname(dir)) === '.claude'),
  ) as string
  return { plugin: kind.plugin, root: path.dirname(agents) }
}
