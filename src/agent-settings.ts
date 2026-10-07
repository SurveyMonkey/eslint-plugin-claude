// The committed settings that apply to a local subagent file. A rule that
// compares an agent with the settings reads them here.
import { classifyAgentFile } from './agent-files.ts'
import { readSettings } from './settings-files.ts'
import { repositoryRoot, type Unreadable } from './skill-tree.ts'

/** The merged settings of the `.claude/` directory of the local agent file
 *  `file`. The result is null for a plugin agent. It is also null for a file
 *  that is no agent file, and when no settings file is there. It is
 *  `UNREADABLE` when a settings file cannot be seen. A rule gives no report
 *  for any of these. */
export function localAgentSettings(file: string): Record<string, unknown> | null | Unreadable {
  const scope = classifyAgentFile(file)
  // `classifyAgentFile` gives null for a file that is no agent file. A plugin agent
  // has no `.claude/` directory. No report is correct for both.
  if (scope === null || scope.plugin) {
    return null
  }
  return readSettings(scope.root, repositoryRoot(scope.root))
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
