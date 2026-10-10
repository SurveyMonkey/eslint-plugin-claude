// The committed settings of a `.claude/` directory. A rule that checks a
// setting reads both files through `readSettings`.
//
// Order: the settings page says that a key at a higher level overrides the
// same key below it. `.claude/settings.local.json` is above
// `.claude/settings.json`. So the local file wins for one key.
import path from 'node:path'
import {
  danglingOf,
  entriesOf,
  isInside,
  readJson,
  realOf,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** The managed settings files that a repository can hold. The managed settings
 *  page (https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
 *  names `managed-settings.json` and the `managed-settings.d/` directory
 *  beside it. Claude Code reads each `*.json` file in that directory, and
 *  ignores a hidden file and a file that does not end in `.json`.
 *  The globs do not match the legacy Windows path, which is not a repository
 *  path. A drop-in name that does not end in `.json` is not in this list.
 *  This list is not `SETTINGS_FILES` (`src/permission-listener.ts`). A rule
 *  that lists only `SETTINGS_FILES` does not lint a managed file. */
export const MANAGED_SETTINGS_FILES = ['**/managed-settings.json', '**/managed-settings.d/*.json']

const DROP_IN_DIRECTORY = 'managed-settings.d'
const MAIN_FILE = 'managed-settings.json'

/** The kind of a settings file: the project file, the local file, or a managed file. */
export type FileKind = 'project' | 'local' | 'managed'

/** The kind of the settings file at `filename`. */
export function kindOf(filename: string): FileKind {
  // A drop-in can have any name that the files glob matches, such as `managed-settings.json`
  // or `settings.local.json`, so the directory decides first.
  if (
    path.basename(path.dirname(filename)) === DROP_IN_DIRECTORY ||
    path.basename(filename) === MAIN_FILE
  ) {
    return 'managed'
  }
  return path.basename(filename) === 'settings.local.json' ? 'local' : 'project'
}

/** A hidden file in `managed-settings.d`. Claude Code ignores it, so it reads no key there. */
export const isHiddenDropIn = (filename: string) =>
  path.basename(path.dirname(filename)) === DROP_IN_DIRECTORY &&
  path.basename(filename).startsWith('.')

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The fields of one settings file. The result is null when the file is not
 *  there and its path is in `bound`, and `UNREADABLE` when the rule cannot
 *  see it. A file that is not there, with a path out of `bound`, cannot be
 *  seen. A file that does not parse to an object is `UNREADABLE`, not absent.
 *  It can hold any key, and Claude Code reports it as a settings error. */
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
 *  The result is null when neither file is there and the path of each is in
 *  `bound`. The result is `UNREADABLE` when one file cannot be seen, because
 *  that file can override any key. A file cannot be seen when the read fails,
 *  when the file is a link to a file that is not there, when it is not there
 *  and its path is out of `bound`, or when its real path is out of `bound`. A
 *  file that does not parse to an object cannot be seen either. */
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

/** The parsed objects of the other files of the merged managed source of the
 *  managed file `filename`: the sibling `managed-settings.json`, and each
 *  `*.json` file in the sibling `managed-settings.d/` that is not hidden. The
 *  managed settings page merges these files into one source. The linted file
 *  is not in the result, because the caller holds its text. Claude Code
 *  ignores a hidden file and a file that does not end in `.json`.
 *
 *  A directory or a file that is not there in the repository adds nothing.
 *  The result is `UNREADABLE` when the rule cannot see one part. These cases
 *  count: a read that fails, and a path out of the repository. A file that
 *  does not parse to an object counts too. So does a drop-in that vanished
 *  after the directory read. Such a file can hold any key.
 *
 *  With `skipUnreadable`, a file that cannot be read adds nothing and the others stay. The
 *  directory that cannot be seen still gives `UNREADABLE`. */
export function readManagedSource(
  filename: string,
  skipUnreadable = false,
): Record<string, unknown>[] | Unreadable {
  const self = path.resolve(filename)
  const dir =
    path.basename(path.dirname(self)) === DROP_IN_DIRECTORY
      ? path.dirname(path.dirname(self))
      : path.dirname(self)
  const bound = repositoryRoot(dir)
  const directory = path.join(dir, DROP_IN_DIRECTORY)
  // A link whose target is not there, a link that leads out of the repository, and a path
  // that cannot be resolved are a directory that the rule cannot see.
  const real = realOf(directory)
  if (typeof real === 'string' ? !isInside(real, bound) : danglingOf(directory) === UNREADABLE) {
    return UNREADABLE
  }
  const entries = entriesOf(directory)
  if (entries === UNREADABLE) {
    return UNREADABLE
  }
  const dropIns = (entries ?? [])
    .filter(({ name }) => name.endsWith('.json') && !name.startsWith('.'))
    .map(({ name }) => ({ file: path.join(directory, name), optional: false }))
  const files = [{ file: path.join(dir, MAIN_FILE), optional: true }, ...dropIns].filter(
    ({ file }) => file !== self,
  )
  const objects: Record<string, unknown>[] = []
  for (const { file, optional } of files) {
    const parsed = readJson(file, bound)
    if (parsed === null && optional) {
      continue
    }
    if (parsed === null || parsed === UNREADABLE || !isObject(parsed.data)) {
      if (skipUnreadable) {
        continue
      }
      return UNREADABLE
    }
    objects.push(parsed.data)
  }
  return objects
}

/** The parsed objects of the settings files that merge with the file `filename` for a list key
 *  such as `enabledMcpjsonServers`. The lists of every file add up, so a rule that sums a list
 *  reads the key of each file. For a managed file, these are the other files of the managed
 *  source. For a project file, this is the other project file of the same `.claude/` directory.
 *  The linted file is not in the result, because the caller holds its text.
 *
 *  A file that is not there adds nothing. A file that the rule cannot read adds nothing either:
 *  the read fails, the real path is out of the repository, or the text does not parse to an
 *  object. So a report rests on the files that read (ADR 001, Decision 14). A managed source
 *  gives the files that read. When the drop-in directory itself cannot be seen, it gives none. */
export function readSiblingSettings(filename: string): Record<string, unknown>[] {
  if (kindOf(filename) === 'managed') {
    const others = readManagedSource(filename, true)
    return others === UNREADABLE ? [] : others
  }
  const self = path.resolve(filename)
  const dir = path.dirname(self)
  const other = path.join(
    dir,
    path.basename(self) === 'settings.json' ? 'settings.local.json' : 'settings.json',
  )
  const fields = fieldsOf(other, repositoryRoot(dir))
  return fields === null || fields === UNREADABLE ? [] : [fields]
}
