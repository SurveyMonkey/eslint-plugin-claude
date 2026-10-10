// A git repository on disk, for a test that needs the index mode of a file.
// Each repository is a real directory in a temporary directory, made with
// `git init`. `repo` stages the files, so a test needs no commit and no user
// identity. A test that needs the index and the disk to differ calls `git`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { gitEnv } from '../src/git-state.ts'

// The real path, so that a bound compares equal where the temporary directory is a link (macOS).
const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'git-tree-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** Run `git` with `args` in `root`. */
export function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, env: gitEnv(), encoding: 'utf8' })
}

/** Write the files `files`, each keyed by its path below `root`. */
export function put(root: string, files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
}

let count = 0
/** A fresh directory, with no `.git`. */
export function plain(files: Record<string, string> = {}): string {
  const root = path.join(scratch, `tree${count++}`)
  mkdirSync(root, { recursive: true })
  put(root, files)
  return root
}

/** A fresh repository. `tracked` holds the files that it stages, and
 *  `executable` names those with index mode `100755`. Every other staged file
 *  has `100644`. `untracked` holds files that git does not know. The result is
 *  the top directory. */
export function repo(
  tracked: Record<string, string>,
  executable: string[] = [],
  untracked: Record<string, string> = {},
): string {
  const root = plain(tracked)
  git(root, 'init', '--quiet')
  if (Object.keys(tracked).length > 0) {
    git(root, 'add', '--all')
    git(root, 'update-index', '--chmod=-x', '--', ...Object.keys(tracked))
  }
  if (executable.length > 0) {
    git(root, 'update-index', '--chmod=+x', '--', ...executable)
  }
  put(root, untracked)
  return root
}
