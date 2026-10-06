// The committed settings of a `.claude/` directory. A rule that checks a
// setting reads both files through `readSettings`.
//
// Order: the page "Settings files and precedence" says that a key at a higher
// level overrides the same key below it. `.claude/settings.local.json` is
// above `.claude/settings.json`. So the local file wins for one key.
import path from 'node:path'
import { readJson, UNREADABLE, type Unreadable } from './skill-tree.ts'

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The fields of one settings file. The result is null when the file is not
 *  there, and `UNREADABLE` when the rule cannot see it. A file that does not
 *  parse to an object is `UNREADABLE`, and is not absent: the file can hold
 *  any key, and Claude Code reports it as a settings error. */
function fieldsOf(file: string, bound: string): Record<string, unknown> | null | Unreadable {
  const parsed = readJson(file, bound)
  if (parsed === null || parsed === UNREADABLE) {
    return parsed
  }
  return isObject(parsed.data) ? parsed.data : UNREADABLE
}

/** The merged top-level fields of `settings.json` and `settings.local.json`
 *  in the `.claude/` directory `dir`. A top-level key of the local file
 *  replaces the same key of the project file. The `env` key is the one
 *  exception: when both values are objects, they merge by key, and the local
 *  value wins for one variable. The settings page does not say how `env`
 *  merges, so this is the choice of the plugin. The result is null when
 *  neither file is there. The result is `UNREADABLE` when one file cannot be
 *  seen, because that file can override any key. A file cannot be seen when
 *  the read fails, the file is a dangling link, its real path is out of
 *  `bound`, or its text does not parse to an object. */
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
