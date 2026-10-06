// The scope of a subagent file: the directory that holds its `agents/`
// directory. A rule that compares an agent with other files of its scope
// reads this.
import { type AgentFile, classifyAgentFile } from './agent-files.ts'

export type AgentScope = AgentFile

/** The scope of the agent file `file`, or null when the file is no agent file.
 *  See `classifyAgentFile` for how the root is found. */
export function agentScope(file: string): AgentScope | null {
  return classifyAgentFile(file)
}
