// The git index, for a rule that checks the executable bit of a file. The
// bit is the index mode `100755`. The mode on the disk is not the bit. The
// index can keep `100755` while the disk shows `644`. With
// `core.fileMode=false`, git does not see the disk mode at all. A repository
// is what a team commits (ADR 001, Decision 14), so the index is the source.
//
// A lookup has three results: a mode, null for a path that git does not track,
// and `UNREADABLE`. `UNREADABLE` is the result when there is no `.git`, when
// `git` is not installed, and when a `git` command fails. A rule makes no
// report that rests on `UNREADABLE`.
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'
import { UNREADABLE, type Unreadable } from './skill-tree.ts'

/** The index mode of a regular file with no executable bit. The executable bit
 *  is the mode `100755`. A rule reports `100644` only. A link and a submodule
 *  have other modes, and the bit does not apply to them. A path that git does
 *  not track has no mode. */
export const PLAIN_MODE = '100644'

// The variables that point git at a repository. Git sets them when it runs a
// git hook. They would make git read another index.
const LOCATION = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
]

/** The environment of a `git` command: the environment of the process,
 *  without the variables that point git at a repository. */
function gitEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !LOCATION.includes(key)))
}

/** The output of `git` with `args`, run in `root` with no shell. It throws
 *  when `git` is missing, `root` is not there, or the command fails. */
function run(root: string, args: string[]): string {
  // `core.fsmonitor` in the config of a repository names a program. Git runs
  // that program when it reads the index. The reader sets the key to false.
  return execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd: root,
    env: gitEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    // A large repository lists more than the default 1 MiB.
    maxBuffer: 1 << 30,
    timeout: 30_000,
  })
}

// The modes of the tracked files of one root, by path from the root with `/`
// separators. An entry is current while the index file has the same time of
// the last write and the same size.
const cache = new Map<
  string,
  { gitDir: string; stamp: string; modes: ReadonlyMap<string, string> }
>()

/** The stamp of the index file in `gitDir`. Git replaces the index with a new
 *  file, so the inode changes. A change of mode keeps the size, so the stamp
 *  also holds the times. A repository with no index yet, such as one just
 *  after `git init`, has no tracked file. Any other error throws. */
function stampOf(gitDir: string): string {
  try {
    const stat = statSync(path.join(gitDir, 'index'), { bigint: true })
    return `${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}:${stat.size}`
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'no index'
    }
    throw error
  }
}

/** The modes of the tracked files below `root`, which is a directory that
 *  holds `.git`. The result is `UNREADABLE` when git cannot read them. */
function modesOf(root: string): ReadonlyMap<string, string> | Unreadable {
  try {
    const hit = cache.get(root)
    const gitDir = hit?.gitDir ?? run(root, ['rev-parse', '--absolute-git-dir']).trim()
    const stamp = stampOf(gitDir)
    if (hit?.stamp === stamp) {
      return hit.modes
    }
    // Each entry is `<mode> <object> <stage>\t<path>`, and ends with a NUL. A
    // path in conflict has an entry for each stage 1 to 3, and none for stage 0.
    // It has no mode here.
    const modes = new Map<string, string>()
    for (const entry of run(root, ['ls-files', '--stage', '-z']).split('\0')) {
      const tab = entry.indexOf('\t')
      if (tab !== -1 && entry.slice(tab - 1, tab) === '0') {
        modes.set(entry.slice(tab + 1), entry.slice(0, 6))
      }
    }
    cache.set(root, { gitDir, stamp, modes })
    return modes
  } catch {
    cache.delete(root)
    return UNREADABLE
  }
}

/** The index mode of `file`, such as `100755` or `100644`. `root` is the
 *  directory that holds `.git` (`repositoryRoot`), and `file` is a path in it.
 *  The result is null when git does not track `file`. */
export function gitModeOf(root: string, file: string): string | null | Unreadable {
  const modes = modesOf(root)
  if (modes === UNREADABLE) {
    return UNREADABLE
  }
  return modes.get(path.relative(root, file).split(path.sep).join('/')) ?? null
}

/** The name and the index mode of each tracked file directly in `dir`, in the
 *  order of the names. `dir` is below `root`. A tracked file in a directory
 *  below `dir` is not in the list. */
export function gitChildren(root: string, dir: string): [string, string][] | Unreadable {
  const modes = modesOf(root)
  if (modes === UNREADABLE) {
    return UNREADABLE
  }
  const prefix = `${path.relative(root, dir).split(path.sep).join('/')}/`
  return [...modes]
    .filter(([file]) => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
    .map(([file, mode]): [string, string] => [file.slice(prefix.length), mode])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
}
