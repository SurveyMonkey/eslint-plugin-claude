// The committed settings that apply to a local subagent file. A rule that
// compares an agent with the settings reads them here.
import path from 'node:path'
import { classifyAgentFile } from './agent-files.ts'
import { readSettings } from './settings-files.ts'
import { repositoryRoot, type Unreadable } from './skill-tree.ts'

/** The `.claude/` directory that holds the agent file `file`, or null when
 *  no `agents/` directory of `file` is a child of `.claude/`. */
function claudeDirOf(file: string): string | null {
  for (
    let dir = path.dirname(path.resolve(file));
    dir !== path.dirname(dir);
    dir = path.dirname(dir)
  ) {
    const parent = path.dirname(dir)
    if (path.basename(dir) === 'agents' && path.basename(parent) === '.claude') {
      return parent
    }
  }
  return null
}

/** The merged settings of the `.claude/` directory of the local agent file
 *  `file`. The result is null for a plugin agent, for a file that is no
 *  agent file, and when no settings file is there. It is `UNREADABLE` when a
 *  settings file cannot be seen. A rule gives no report for any of these. */
export function localAgentSettings(file: string): Record<string, unknown> | null | Unreadable {
  const dir = claudeDirOf(file)
  // `classifyAgentFile` gives null for a file that the rule cannot place, and
  // `plugin: true` for a plugin agent. No report is correct for both.
  if (dir === null || classifyAgentFile(file)?.plugin !== false) {
    return null
  }
  return readSettings(dir, repositoryRoot(dir))
}

/** True when `value` turns an environment variable on: the string `1` or
 *  `true`, in any case. The settings `env` holds strings. */
export function isOn(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true'].includes(value.trim().toLowerCase())
}

/** The `env` object of `settings`, or an empty object when `env` is not an object.
 *  An empty object is correct here: a variable that is not set has no effect. */
export function envOf(settings: Record<string, unknown>): Record<string, unknown> {
  const { env } = settings
  return env !== null && typeof env === 'object' && !Array.isArray(env)
    ? (env as Record<string, unknown>)
    : {}
}
