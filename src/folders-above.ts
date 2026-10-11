// The folders above a project folder, up to the repository root. The rules
// `agent-name-shadowing` and `output-style-name-unique` walk them.
// ADR 001, Decision 14: a rule reads no file out of the repository. So the walk stops at
// the repository root. Without a repository root, the walk only checks for `.git` in each
// folder above, and it returns no folder.
import { existsSync } from 'node:fs'
import path from 'node:path'

/** The folders strictly above the parent of `scope`, nearest first, up to and including the
 *  first folder that holds `.git`. `scope` is a `.claude` folder, so its parent is the project
 *  folder. The result is empty when `.git` is in `scope` or in the project folder. It is also
 *  empty when no `.git` is at or above `scope`, because the bound is then `scope` itself. The
 *  search checks `.git` in `scope` and in each folder above it, and stops at the first match.
 *  With a repository root, no call reaches a path above it. */
export function foldersAbove(scope: string): string[] {
  const chain: string[] = []
  for (let at = path.resolve(scope); ; at = path.dirname(at)) {
    chain.push(at)
    if (existsSync(path.join(at, '.git'))) {
      // chain[0] is `scope`, and chain[1] is the project folder.
      return chain.slice(2)
    }
    if (path.dirname(at) === at) {
      return []
    }
  }
}
