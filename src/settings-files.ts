// The committed settings of a `.claude/` directory. A rule that checks a
// setting reads both files through `readSettings`.
//
// Order: the settings page says that a key at a higher level overrides the
// same key below it. `.claude/settings.local.json` is above
// `.claude/settings.json`. So the local file wins for one key.
import path from 'node:path'
import { readJson, UNREADABLE, type Unreadable } from './skill-tree.ts'

/** The managed settings files that a repository can hold. The managed settings
 *  page (https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
 *  names `managed-settings.json` and the `managed-settings.d/` directory
 *  beside it. Claude Code reads each `*.json` file in that directory, and
 *  ignores a hidden file and a file that does not end in `.json`.
 *  The globs do not match the legacy Windows path, which is not a repository
 *  path. A drop-in name that does not end in `.json` is not in this list.
 *  This list is not `SETTINGS_FILES` (`src/permission-listener.ts`). The rules
 *  that use that list do not read managed files. */
export const MANAGED_SETTINGS_FILES = ['**/managed-settings.json', '**/managed-settings.d/*.json']

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The fields of one settings file. The result is null when the file is not
 *  there, and `UNREADABLE` when the rule cannot see it. A file that does not
 *  parse to an object is `UNREADABLE`, not absent. It can hold any key, and
 *  Claude Code reports it as a settings error. */
function fieldsOf(file: string, bound: string): Record<string, unknown> | null | Unreadable {
  const parsed = readJson(file, bound)
  if (parsed === null || parsed === UNREADABLE) {
    return parsed
  }
  return isObject(parsed.data) ? parsed.data : UNREADABLE
}

/** The merged top-level fields of `settings.json` and `settings.local.json`
 *  in the `.claude/` directory `dir`. A top-level key of the local file
 *  replaces the same key of the project file.
 *
 *  The `env` key is the one exception. When both values are objects, they
 *  merge by key, and the local value wins for one variable. The settings page
 *  calls `env` an ordinary key, so a local `env` could replace the project
 *  `env`. The merge by key is the choice of the plugin.
 *
 *  This function replaces an array, or an object other than `env`, as a
 *  whole. Do not use it for a list key such as `permissions`.
 *
 *  The result is null when neither file is there. The result is `UNREADABLE`
 *  when one file cannot be seen, because that file can override any key. A file
 *  cannot be seen when the read fails, when the file is a link to a file that
 *  is not there, or when its real path is out of `bound`. A file that does not
 *  parse to an object cannot be seen either. */
export function readSettings(
  dir: string,
  bound: string,
): Record<string, unknown> | null | Unreadable {
  const project = fieldsOf(path.join(dir, 'settings.json'), bound)
  const local = fieldsOf(path.join(dir, 'settings.local.json'), bound)
  if (project === UNREADABLE || local === UNREADABLE) {
    return UNREADABLE
  }
  if (project === null || local === null) {
    return project ?? local
  }
  const merged = { ...project, ...local }
  if (isObject(project.env) && isObject(local.env)) {
    merged.env = { ...project.env, ...local.env }
  }
  return merged
}
