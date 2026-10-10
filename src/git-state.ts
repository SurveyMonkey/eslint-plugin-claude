// The git index, for a rule that checks the executable bit of a file. The
// bit is the index mode `100755`. The mode on the disk is not the bit. The
// index can keep `100755` while the disk shows `644`. With
// `core.fileMode=false`, git does not see the disk mode at all. A repository
// is what a team commits (ADR 001, Decision 14), so the index is the source.
//
// A lookup has three results: a mode, null for a path that has no stage-0
// entry in the index, and `UNREADABLE`. A path that git does not track has no
// entry. A path in a merge conflict has none either. `UNREADABLE` is the
// result when there is no `.git`, when `git` is not installed, when a `git`
// command fails, and when git finds a repository other than the one in `root`.
// A rule makes no report that rests on `UNREADABLE`.
//
// A second question is whether a `.gitignore` file covers a path (`gitIgnores`).
// It uses `git check-ignore`, and has the same `UNREADABLE` result.
import { execFileSync } from 'node:child_process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { devNull } from 'node:os'
import path from 'node:path'
import { UNREADABLE, type Unreadable } from './skill-tree.ts'

/** The index mode of a regular file with no executable bit. The executable bit
 *  is the mode `100755`. A rule reports `100644` only. A link and a submodule
 *  have other modes, and the bit does not apply to them. A path that git does
 *  not track has no mode. */
export const PLAIN_MODE = '100644'

// The variables that point git at a repository. Git sets some of them when it
// runs a git hook. They would make git read another index.
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
 *  when `git` is not installed, `root` is not there, or the command fails. */
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
// separators. An entry is current while the stamp of the index file (`stampOf`)
// is the same.
const cache = new Map<
  string,
  { gitDir: string; stamp: string; modes: ReadonlyMap<string, string> }
>()

/** True for the error of a path that is not there. */
const isMissing = (error: unknown): boolean =>
  ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code as string)

/** The stamp of the index file in `gitDir`. Git replaces the index with a new
 *  file, so the inode changes. A change of mode keeps the size, so the stamp
 *  also holds the times. The change time moves on every write, so a test can
 *  show only that field. The other fields are for a file system with a coarse
 *  change time. A repository with no index yet, such as one just after
 *  `git init`, has no tracked file. The result is null when `gitDir` is gone
 *  or the rule cannot read it. */
function stampOf(gitDir: string): string | null {
  try {
    const stat = statSync(path.join(gitDir, 'index'), { bigint: true })
    return `${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}:${stat.size}`
  } catch (error) {
    return isMissing(error) && existsSync(gitDir) ? 'no index' : null
  }
}

/** The git directory of `root`. It throws when git reads a repository other
 *  than the one in `root`. This is the case for a `.git` directory that is
 *  not a repository, inside another repository. */
function gitDirOf(root: string): string {
  // With no `.git` in `root`, git finds an outer repository or none. Both give no answer
  // for `root`, and the check saves a process.
  if (!existsSync(path.join(root, '.git'))) {
    throw new Error('no .git')
  }
  const [gitDir = '', top = ''] = run(root, [
    'rev-parse',
    '--absolute-git-dir',
    '--show-toplevel',
  ]).split('\n')
  if (realpathSync(top) !== realpathSync(root)) {
    throw new Error('git reads another repository')
  }
  return gitDir
}

/** The modes of the tracked files below `root`, which is a directory that
 *  holds `.git`. The result is `UNREADABLE` when git cannot read them. */
function modesOf(root: string): ReadonlyMap<string, string> | Unreadable {
  try {
    const hit = cache.get(root)
    if (hit !== undefined && stampOf(hit.gitDir) === hit.stamp) {
      return hit.modes
    }
    // The git directory can move while the process runs, so a refresh finds it again.
    const gitDir = gitDirOf(root)
    // A null stamp becomes the text "null". It never equals a later stamp, so
    // the next lookup reads the index again.
    const stamp = String(stampOf(gitDir))
    // Each entry is `<mode> <object> <stage>\t<path>`, and ends with a NUL. A
    // path in conflict has entries at stages 1 to 3, and none at stage 0. It
    // has no mode here.
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
 *  The result is null when `file` has no stage-0 entry: git does not track it,
 *  or it is in a merge conflict. */
export function gitModeOf(root: string, file: string): string | null | Unreadable {
  const modes = modesOf(root)
  if (modes === UNREADABLE) {
    return UNREADABLE
  }
  return modes.get(path.relative(root, file).split(path.sep).join('/')) ?? null
}

/** The start of the index path of each file below `dir`: `dir` from `root`
 *  with `/` separators and a final `/`, or the empty text for `root` itself. */
function prefixOf(root: string, dir: string): string {
  const below = path.relative(root, dir).split(path.sep).join('/')
  return below === '' ? '' : `${below}/`
}

/** The name and the index mode of each tracked file directly in `dir`, in the
 *  order of the names. `dir` is below `root`. A tracked file in a directory
 *  below `dir` is not in the list. */
export function gitChildren(root: string, dir: string): [string, string][] | Unreadable {
  const modes = modesOf(root)
  if (modes === UNREADABLE) {
    return UNREADABLE
  }
  const prefix = prefixOf(root, dir)
  return [...modes]
    .filter(([file]) => file.startsWith(prefix) && !file.slice(prefix.length).includes('/'))
    .map(([file, mode]): [string, string] => [file.slice(prefix.length), mode])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
}

/** True when git tracks a file at any depth below `dir`, and false when it
 *  tracks none. `dir` is below `root`, or is `root`. The result is
 *  `UNREADABLE` when git cannot read the index. */
export function gitTracksBelow(root: string, dir: string): boolean | Unreadable {
  const modes = modesOf(root)
  if (modes === UNREADABLE) {
    return UNREADABLE
  }
  const prefix = prefixOf(root, dir)
  return [...modes.keys()].some((file) => file.startsWith(prefix))
}

/** True when a `.gitignore` file has a pattern that covers `file`, and false
 *  when none does. `root` is the directory that holds `.git`, and `file` is a
 *  path in it. The file need not be there. The answer comes from the patterns
 *  only: git tracks the file or not, and the answer is the same. A negated
 *  pattern that takes the file back gives false.
 *
 *  Two other sources of patterns give false. A pattern in `.git/info/exclude`
 *  stays in one clone. A pattern in the global excludes file stays on one
 *  machine. A team shares only a `.gitignore` file. The result is
 *  `UNREADABLE` when git cannot answer, as for `gitModeOf`. It is also
 *  `UNREADABLE` for a path below a link, where git stops with an error. */
export function gitIgnores(root: string, file: string): boolean | Unreadable {
  try {
    gitDirOf(root)
  } catch {
    return UNREADABLE
  }
  // The path starts with `./`, so that git reads no leading `:` as pathspec
  // magic. `--literal-pathspecs` is not an option here: this command refuses it.
  const target = `./${path.relative(root, file).split(path.sep).join('/')}`
  try {
    // `-v` names the source of the pattern, in the form `source:line:pattern<TAB>path`.
    // With `-c core.excludesFile`, git reads no global excludes file, not even the
    // default one. A global file can have the name `.gitignore`, so the name is not enough.
    const out = run(root, [
      '-c',
      `core.excludesFile=${devNull}`,
      'check-ignore',
      '--no-index',
      '-v',
      '--',
      target,
    ])
    // A directory name can hold a colon, so the source ends at the first `:<digits>:`.
    const source = out.replace(/:\d+:.*/s, '')
    const negated = /^:\d+:!/.test(out.slice(source.length))
    // Git quotes a source that holds a control character, and a quote ends it.
    return !negated && path.posix.basename(source.replace(/"$/, '')) === '.gitignore'
  } catch (error) {
    // Status 1 is the answer "no path is ignored". Another status is a failure.
    return (error as { status?: number }).status === 1 ? false : UNREADABLE
  }
}
