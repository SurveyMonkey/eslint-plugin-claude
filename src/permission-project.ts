// What the git index shows about the project of a settings file: the project is the folder that
// holds `.claude/`. A rule that asks "does this project use Docker?" or "does a script start
// claude?" reads the names of the tracked files in that folder, and the `scripts` of a tracked
// `package.json`. A file that git does not track is not in the repository (ADR 001, Decision 14).
import path from 'node:path'
import { gitChildren } from './git-state.ts'
import { isObject } from './permission-source.ts'
import {
  readJson,
  realDirectory,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** The tracked files of a project folder, and the commands of its `package.json`. */
export interface ProjectFacts {
  /** The names of the tracked files directly in the folder. */
  readonly names: readonly string[]
  /** The string values of `scripts` in a tracked `package.json`. The list is empty when the file
   *  is not tracked, does not read, or has no `scripts` object. */
  readonly scripts: readonly string[]
}

/** The facts of the project that holds the settings file `filename`, or `UNREADABLE` when git
 *  cannot answer. A `package.json` that does not read adds no script. */
export function projectFacts(filename: string): ProjectFacts | Unreadable {
  const project = realDirectory(path.dirname(path.dirname(path.resolve(filename))))
  const bound = repositoryRoot(project)
  const children = gitChildren(bound, project)
  if (children === UNREADABLE) {
    return UNREADABLE
  }
  const names = children.map(([name]) => name)
  const manifest = names.includes('package.json')
    ? readJson(path.join(project, 'package.json'), bound)
    : null
  const scripts =
    manifest !== null && manifest !== UNREADABLE && isObject(manifest.data)
      ? manifest.data.scripts
      : undefined
  return {
    names,
    scripts: isObject(scripts)
      ? Object.values(scripts).filter((value): value is string => typeof value === 'string')
      : [],
  }
}
