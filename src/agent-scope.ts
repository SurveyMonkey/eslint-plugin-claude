// The scope of a subagent file: the directory that holds its `agents/`
// directory. A rule that compares an agent with other files of its scope
// reads this. `classifyAgentFile` finds the scope in one walk.
import { type AgentFile, classifyAgentFile } from './agent-files.ts'

export type AgentScope = AgentFile

/** The scope of the agent file `file`, or null when the file is no agent file.
 *  The scope is the parent of the deepest `agents/` directory above the file
 *  that fits its kind. */
export function agentScope(file: string): AgentScope | null {
  return classifyAgentFile(file)
}
