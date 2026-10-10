// What the project folders of a local subagent file hold, for a rule that compares the agent with
// them: the `agent` setting, and the names of the agent files. The folders are the project folder
// that holds `.claude/`, and each folder above it up to the repository root. Claude Code finds the
// project agents and the settings from the working directory, and the working directory can be any
// of these folders (https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope). A rule
// reads no file out of the repository (ADR 001, Decision 14).
import path from 'node:path'
import { type AgentFile, agentFileState, manifestAgents } from './agent-files.ts'
import { foldersAbove } from './folders-above.ts'
import { readSettings } from './settings-files.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  missingOf,
  realOf,
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

/** The agent files of the scope `scope`, as absolute paths. A local scope holds each `.md` file
 *  below its `agents/` directory. A plugin scope holds the files that its manifest key `agents`
 *  names, or the files below `agents/` when the key is not there. The result is `UNREADABLE` when
 *  the scope has a part that the check cannot see: a manifest that it cannot read, a path that is
 *  a dangling link, a link out of the repository, or a directory that it cannot list. A named
 *  file that is not there adds nothing, as in Claude Code. */
export function scopeAgentFiles(scope: AgentFile): string[] | Unreadable {
  const bound = repositoryRoot(scope.root)
  const named = scope.plugin ? manifestAgents(scope.root, bound) : null
  if (named === UNREADABLE) {
    return UNREADABLE
  }
  if (named !== null) {
    const files: string[] = []
    for (const file of named) {
      const state = agentFileState(file, bound)
      if (state === UNREADABLE) {
        return UNREADABLE
      }
      if (state === 'present') {
        files.push(file)
      }
    }
    return files
  }
  const agents = path.join(scope.root, 'agents')
  // `markdownFiles` reads a directory that is not there as empty. Such a directory behind a
  // dangling link, or out of the repository, is a part that the check cannot see.
  if (realOf(agents) === null && missingOf(agents, bound) === UNREADABLE) {
    return UNREADABLE
  }
  const scan = markdownFiles(agents, bound)
  return scan.outside || scan.unreadable ? UNREADABLE : scan.files
}
