// The eval suite of a plugin. `claude plugin eval` reads the cases from the
// eval directory. It is `evals/`, or the relative path in `experimental.evals`
// of `plugin.json`. An absolute path, a path with `..` or another unusable
// value prints a `Warning:` line. The run then uses `evals/`
// (https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory).
// A rule that lints the manifest asks here for the directory of its plugin.
import path from 'node:path'
import { type DocumentNode, lastMember } from './marketplace-json.ts'
import { isPluginRoot } from './plugin-root.ts'
import { entriesOf, isInside, realOf, repositoryRoot } from './skill-tree.ts'

const DEFAULT_EVAL_DIR = 'evals'

// One name of a path: not empty, not `.` or `..`, and with no separator or backslash.
const PLAIN_NAME = /^(?!\.{1,2}$)[^/\\]+$/
// The start of a path on a drive of Windows. It is an absolute path.
const DRIVE = /^[A-Za-z]:/

/** The eval directory that `experimental.evals` of the manifest names. It is
 *  a path from the plugin root with `/` separators. The result is `evals` in
 *  three cases. The value is not there. It is not a string. It is not a
 *  relative path of plain directory names. */
function evalDirName(document: DocumentNode): string {
  const value = lastMember(lastMember(document.body, 'experimental')?.value, 'evals')?.value
  return value?.type === 'String' &&
    !DRIVE.test(value.value) &&
    value.value.split('/').every((name) => PLAIN_NAME.test(name))
    ? value.value
    : DEFAULT_EVAL_DIR
}

/** The eval directory of the plugin whose manifest is `filename`. The result
 *  is null in four cases. The manifest is in no plugin root. The directory is
 *  not there. It is not a directory. Its real path is out of the repository
 *  (ADR 001, Decision 14). The rule reads a link to a directory of the
 *  repository where it leads.
 *
 *  `name` is the path from the plugin root. `real` is the real path of the
 *  directory. `bound` is the real path of the repository. */
export function evalDirectoryOf(
  filename: string,
  document: DocumentNode,
): { name: string; real: string; bound: string } | null {
  const root = path.dirname(path.dirname(path.resolve(filename)))
  if (isPluginRoot(root) !== true) {
    return null
  }
  const name = evalDirName(document)
  const bound = repositoryRoot(root)
  const real = realOf(path.join(root, name))
  if (typeof real !== 'string' || !isInside(real, bound) || !Array.isArray(entriesOf(real))) {
    return null
  }
  return { name, real, bound }
}

/** True when `dir` holds a file at any depth. A link counts as a file. A
 *  directory that has only directories, or cannot be read, holds none. Git
 *  cannot track an empty directory. */
export function holdsFile(dir: string): boolean {
  const entries = entriesOf(dir)
  return (
    Array.isArray(entries) &&
    entries.some((entry) => !entry.isDirectory() || holdsFile(path.join(dir, entry.name)))
  )
}
