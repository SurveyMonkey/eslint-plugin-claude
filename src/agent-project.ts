// What the project folders of a local subagent file hold, for a rule that compares the agent with
// them: the `agent` setting, and the names of the agent files. The folders are the project folder
// that holds `.claude/`, and each folder above it up to the repository root. Claude Code finds the
// project agents and the settings from the working directory, and the working directory can be any
// of these folders (https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope). A rule
// reads no file out of the repository (ADR 001, Decision 14).
import path from 'node:path'
import type { AgentFile } from './agent-files.ts'
import { foldersAbove } from './folders-above.ts'
import { readSettings } from './settings-files.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** The project folder of the local agent scope `scope`, and each folder above it. */
function projectFolders(scope: AgentFile): string[] {
  return [path.dirname(scope.root), ...foldersAbove(scope.root)]
}

/** The values of the `agent` setting in the settings files of `.claude/` in each project folder.
 *  The result is `UNREADABLE` when one file cannot be seen, because that file can name any agent.
 *  A value that is not a string names no agent. */
export function mainAgentNames(scope: AgentFile): string[] | Unreadable {
  const bound = repositoryRoot(scope.root)
  const names: string[] = []
  for (const dir of projectFolders(scope)) {
    const settings = readSettings(path.join(dir, '.claude'), bound)
    if (settings === UNREADABLE) {
      return UNREADABLE
    }
    if (typeof settings?.agent === 'string') {
      names.push(settings.agent)
    }
  }
  return names
}

/** The `name` of each agent file in `.claude/agents/` of each project folder. The result is
 *  `UNREADABLE` when a scan meets a link out of the repository, a directory that it cannot read, or
 *  a file that it cannot read, because the missing agent can be there. A file with no `name`, or with
 *  frontmatter that does not parse, defines no agent. */
export function projectAgentNames(scope: AgentFile): string[] | Unreadable {
  const bound = repositoryRoot(scope.root)
  const names: string[] = []
  for (const dir of projectFolders(scope)) {
    const scan = markdownFiles(path.join(dir, '.claude', 'agents'), bound)
    if (scan.outside || scan.unreadable) {
      return UNREADABLE
    }
    for (const file of scan.files) {
      const fields = frontmatterOfFile(file)
      if (fields === UNREADABLE) {
        return UNREADABLE
      }
      if (typeof fields?.name === 'string') {
        names.push(fields.name)
      }
    }
  }
  return names
}
