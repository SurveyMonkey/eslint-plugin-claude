// A git repository on disk, for a test that needs the index mode of a file.
// Each repository is a real directory in a temporary directory, made with
// `git init`. `repo` stages the files, so a test needs no commit and no user
// identity. A test that needs the index and the disk to differ calls `git`.
// `git` reads no global or system config, so a test gives the identity and the
// branch names that it needs.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { devNull, tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll } from 'vitest'

// The real path, so that a bound compares equal where the temporary directory is a link (macOS).
const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'git-tree-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

// The variables that point git at a repository. Git sets some of them when it runs a git hook.
const LOCATION =
  /^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|PREFIX|NAMESPACE)$/
const gitEnv = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !LOCATION.test(key))),
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: '1',
})

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
  stage(root, Object.keys(tracked), executable)
  put(root, untracked)
  return root
}

/** Make `root` a repository, and stage the files `files` in it, which are on
 *  disk. The files in `executable` get index mode `100755`, and the others get
 *  `100644`. */
export function stage(root: string, files: string[], executable: string[] = []) {
  git(root, 'init', '--quiet')
  if (files.length > 0) {
    git(root, 'add', '--force', '--all')
    git(root, 'update-index', '--chmod=-x', '--', ...files)
  }
  if (executable.length > 0) {
    git(root, 'update-index', '--chmod=+x', '--', ...executable)
  }
}

/** Give the rest of the test file no global or system git config. A rule runs
 *  `git` itself, so `git` above does not cover it. Without this, a rule reads
 *  the config of the machine, such as a global excludes file. A test that needs
 *  a global config sets `GIT_CONFIG_GLOBAL` with `vi.stubEnv`. */
export function isolateGitConfig() {
  const saved = { global: process.env.GIT_CONFIG_GLOBAL, system: process.env.GIT_CONFIG_NOSYSTEM }
  beforeAll(() => {
    process.env.GIT_CONFIG_GLOBAL = devNull
    process.env.GIT_CONFIG_NOSYSTEM = '1'
  })
  afterAll(() => {
    for (const [key, value] of [
      ['GIT_CONFIG_GLOBAL', saved.global],
      ['GIT_CONFIG_NOSYSTEM', saved.system],
    ] as const) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })
}
