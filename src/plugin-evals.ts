// The eval suite of a plugin. `claude plugin eval` reads the cases from the
// eval directory. It is `evals/`, or the relative path in `experimental.evals`
// of `plugin.json`. An absolute path, a path with `..` or another unusable
// value prints a `Warning:` line. The run then uses `evals/`
// (https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory).
// A rule that lints the manifest asks here for the directory of its plugin.
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { isMap } from './frontmatter-values.ts'
import { type DocumentNode, lastMember } from './marketplace-json.ts'
import { type Plugin, readPluginAt } from './plugin-manifest.ts'
import { isPluginRoot } from './plugin-root.ts'
import {
  entriesOf,
  isInside,
  realDirectory,
  realOf,
  repositoryRoot,
  SKIPPED,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

const DEFAULT_EVAL_DIR = 'evals'

// One name of a path: not empty, not `.` or `..`, and with no separator or backslash.
const PLAIN_NAME = /^(?!\.{1,2}$)[^/\\]+$/
// The start of a path on a drive of Windows. It is an absolute path.
const DRIVE = /^[A-Za-z]:/

/** True when `value` is a relative path of plain directory names, as the docs
 *  accept for `experimental.evals`. */
export function isEvalDirPath(value: string): boolean {
  return !DRIVE.test(value) && value.split('/').every((name) => PLAIN_NAME.test(name))
}

/** The eval directory that the value `value` of `experimental.evals` names. It is
 *  `evals` in three cases. The value is not there. It is not a string. It is not
 *  a relative path of plain directory names. */
function chosenDir(value: unknown): string {
  return typeof value === 'string' && isEvalDirPath(value) ? value : DEFAULT_EVAL_DIR
}

/** The eval directory that `experimental.evals` of the manifest names. It is
 *  a path from the plugin root with `/` separators. */
function evalDirName(document: DocumentNode): string {
  const value = lastMember(lastMember(document.body, 'experimental')?.value, 'evals')?.value
  return chosenDir(value?.type === 'String' ? value.value : undefined)
}

/** The eval directory that `experimental.evals` names in `fields`, the keys of a
 *  manifest read from disk. The rules of `evalDirName` apply. */
function evalDirNameOf(fields: Readonly<Record<string, unknown>>): string {
  const { experimental } = fields
  return chosenDir(isMap(experimental) ? experimental.evals : undefined)
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

/** The kinds of a file in an eval suite that a rule lints as Markdown. */
export type EvalFileKind = 'prompt' | 'grader' | 'mock'

/** A Markdown file of an eval suite. `evalDir` is the eval directory of the
 *  plugin as an absolute path. `caseDir` is the directory of the case that owns
 *  the file, or null for a mock of the whole suite. `server` is the directory
 *  name of a mock, which names a server of the plugin. */
export interface EvalFile {
  kind: EvalFileKind
  plugin: Plugin
  evalDir: string
  caseDir: string | null
  server?: string
}

/** True when `entries`, the listing of a directory, hold a `prompt.md` or a
 *  `case.yaml`. A link to a file counts as the file. */
const holdsCaseFile = (entries: Dirent[]): boolean =>
  entries.some(
    (entry) =>
      (entry.name === 'prompt.md' || entry.name === 'case.yaml') &&
      (entry.isFile() || entry.isSymbolicLink()),
  )

/** True when `dir` is a case: it holds a `prompt.md` or a `case.yaml`. The
 *  result is `UNREADABLE` when the directory cannot be listed, and false when it
 *  is not there. */
function isCaseDirectory(dir: string): boolean | Unreadable {
  const entries = entriesOf(dir)
  return Array.isArray(entries) ? holdsCaseFile(entries) : (entries ?? false)
}

/** The nearest directory at or above `start` that is a plugin root, or null.
 *  The walk stops at the repository root, so that no call reaches a path above
 *  it (ADR 001, Decision 14). It is also null when a directory cannot be seen. */
function pluginRootAbove(start: string): string | null {
  const bound = repositoryRoot(start)
  for (let at = start; ; at = path.dirname(at)) {
    const root = isPluginRoot(at)
    if (root === UNREADABLE) {
      return null
    }
    if (root || realDirectory(at) === bound || path.dirname(at) === at) {
      return root ? at : null
    }
  }
}

/** What the Markdown file `file` is in an eval suite, or null. The path alone
 *  gives the kind, by the layout of the eval suite reference:
 *  - `graders/<name>.md` in a case is a grader.
 *  - `mocks/<server>/<tool>.md` in a case, or in the eval directory, is a mock.
 *    The directory `.replay` holds saved answers, so it is no server.
 *  - `prompt.md` in a case is a prompt. A `prompt.md` below a case belongs to
 *    that case. A directory `mocks` or `results` at the top of the eval
 *    directory is no case.
 *
 *  The result is null when the file is in no eval directory: the nearest plugin
 *  root is not seen, or the file is out of its eval directory. It is also null
 *  when the directory of the case cannot be listed. */
export function evalFileOf(file: string): EvalFile | null {
  const abs = path.resolve(file)
  const dir = path.dirname(abs)
  const parent = path.dirname(dir)
  let kind: EvalFileKind
  if (!abs.endsWith('.md')) {
    return null
  }
  if (path.basename(dir) === 'graders') {
    kind = 'grader'
  } else if (path.basename(parent) === 'mocks' && path.basename(dir) !== '.replay') {
    kind = 'mock'
  } else if (path.basename(abs) === 'prompt.md') {
    kind = 'prompt'
  } else {
    return null
  }
  const root = pluginRootAbove(dir)
  const plugin = root === null ? undefined : readPluginAt(root)
  if (plugin === undefined) {
    return null
  }
  const evalDir = path.join(plugin.root, evalDirNameOf(plugin.fields))
  const real = realOf(evalDir)
  if (typeof real !== 'string' || !isInside(real, plugin.bound) || !isInside(dir, evalDir)) {
    return null
  }
  // The case that owns a grader or a case mock is the folder above `graders/` or `mocks/`.
  const owner = kind === 'grader' ? parent : path.dirname(parent)
  if (kind === 'prompt') {
    const rel = path.relative(evalDir, dir).split(path.sep)
    if (rel[0] === 'mocks' || rel[0] === 'results') {
      return null
    }
    // A `prompt.md` below a case is a fixture of that case.
    for (let at = parent; isInside(at, evalDir) && at !== evalDir; at = path.dirname(at)) {
      if (isCaseDirectory(at) !== false) {
        return null
      }
    }
    return { kind, plugin, evalDir, caseDir: dir }
  }
  if (kind === 'mock' && owner === evalDir) {
    return { kind, plugin, evalDir, caseDir: null, server: path.basename(dir) }
  }
  if (!isInside(owner, evalDir) || isCaseDirectory(owner) !== true) {
    return null
  }
  return {
    kind,
    plugin,
    evalDir,
    caseDir: owner,
    ...(kind === 'mock' ? { server: path.basename(dir) } : {}),
  }
}

/** The case directories of the eval directory `evalDir`, as absolute paths, in name order. A
 *  directory is a case when it holds a `prompt.md` or a `case.yaml`. Everything
 *  below a case belongs to it, so the walk goes no deeper. The walk skips `.git`,
 *  `node_modules`, and the directories `mocks` and `results` at the top. It does
 *  not enter a link to a directory. A directory that cannot be listed adds no
 *  case. */
export function caseDirectories(evalDir: string): string[] {
  const found: string[] = []
  const visit = (dir: string, top: boolean) => {
    const entries = entriesOf(dir)
    if (!Array.isArray(entries)) {
      return
    }
    if (holdsCaseFile(entries)) {
      found.push(dir)
      return
    }
    // Sorted, so that the result does not depend on the order of the listing.
    for (const entry of entries.toSorted((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const reserved = top && (entry.name === 'mocks' || entry.name === 'results')
      if (entry.isDirectory() && !SKIPPED.has(entry.name) && !reserved) {
        visit(path.join(dir, entry.name), false)
      }
    }
  }
  visit(evalDir, true)
  return found
}
