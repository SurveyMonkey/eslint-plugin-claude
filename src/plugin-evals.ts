// The eval suite of a plugin. `claude plugin eval` reads the cases from the
// eval directory: `evals/`, or the relative path in `experimental.evals` of
// `plugin.json`. The docs say that a path with `..`, an absolute path, or a
// value that is not usable gives a warning, and the run uses `evals/`
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

/** The eval directory that `experimental.evals` of the manifest names, as a
 *  path from the plugin root with `/` separators. The result is `evals` when
 *  the value is not there, is not a string, or is not a relative path of
 *  plain directory names. */
function evalDirName(document: DocumentNode): string {
  const value = lastMember(lastMember(document.body, 'experimental')?.value, 'evals')?.value
  return value?.type === 'String' &&
    !DRIVE.test(value.value) &&
    value.value.split('/').every((name) => PLAIN_NAME.test(name))
    ? value.value
    : DEFAULT_EVAL_DIR
}

/** The eval directory of the plugin whose manifest is `filename`. The result
 *  is null when the manifest is in no plugin root, or when the directory is
 *  not there, is not a directory, or has a real path out of the repository
 *  (ADR 001, Decision 14). A link to a directory of the repository is read
 *  where it leads.
 *
 *  `name` is the path from the plugin root, `real` is the real path of the
 *  directory, and `bound` is the real path of the repository. */
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
