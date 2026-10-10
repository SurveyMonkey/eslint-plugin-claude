// The reader of the git index. The tests make real repositories with `git init`.
// The executable bit is the index mode, so some cases make the disk mode and the
// index mode differ.
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { gitChildren, gitIgnores, gitModeOf, gitTracksBelow, PLAIN_MODE } from '../src/git-state.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { git, isolateGitConfig, plain, put, repo } from './git-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

const at = (root: string, file: string) => path.join(root, file)

isolateGitConfig()

describe('gitModeOf', () => {
  it('gives the mode of a tracked file: 100755 and 100644', () => {
    const root = repo({ 'run.sh': '#!/bin/sh\n', 'plain.txt': 'x\n' }, ['run.sh'])
    expect(PLAIN_MODE).toBe('100644')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    expect(gitModeOf(root, at(root, 'plain.txt'))).toBe('100644')
  })

  it('gives null for a file that git does not track', () => {
    const root = repo({ 'a.txt': 'a' }, [], { 'loose.sh': '#!/bin/sh\n' })
    expect(gitModeOf(root, at(root, 'loose.sh'))).toBeNull()
    expect(gitModeOf(root, at(root, 'missing.sh'))).toBeNull()
  })

  it('reads a path below a directory, and a name with a space', () => {
    const root = repo({ 'a/b/my script.sh': 'x' }, ['a/b/my script.sh'])
    expect(gitModeOf(root, at(root, 'a/b/my script.sh'))).toBe('100755')
  })

  it('gives UNREADABLE for a directory with no .git', () => {
    const root = plain({ 'run.sh': 'x' })
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe(UNREADABLE)
  })

  it('gives UNREADABLE when git fails: a directory that does not exist', () => {
    const root = path.join(plain(), 'gone')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe(UNREADABLE)
  })

  it('gives UNREADABLE when git is not on the PATH', () => {
    const root = repo({ 'run.sh': 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(gitModeOf(root, at(root, 'run.sh'))).toBe(UNREADABLE)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('gives null for every file of a repository with no index yet', () => {
    const root = repo({})
    expect(gitModeOf(root, at(root, 'a.txt'))).toBeNull()
  })

  it('gives the index mode, not the disk mode', () => {
    // The index keeps 100755 while the disk shows 644.
    const root = repo({ 'run.sh': 'x' }, ['run.sh'])
    chmodSync(at(root, 'run.sh'), 0o644)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
  })

  it.skipIf(process.platform === 'win32')(
    'does not see the disk mode when core.fileMode is false',
    () => {
      const root = repo({})
      git(root, 'config', 'core.fileMode', 'false')
      put(root, { 'x.sh': 'x' })
      chmodSync(at(root, 'x.sh'), 0o755)
      git(root, 'add', 'x.sh')
      expect(gitModeOf(root, at(root, 'x.sh'))).toBe('100644')
    },
  )

  it('reads the index again after it changes', () => {
    const root = repo({ 'run.sh': 'x' })
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    git(root, 'update-index', '--chmod=+x', 'run.sh')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    put(root, { 'new.sh': 'x' })
    git(root, 'add', 'new.sh')
    expect(gitModeOf(root, at(root, 'new.sh'))).toBe('100644')
  })

  it('keeps one result for each root while the index is the same', () => {
    const root = repo({ 'run.sh': 'x' }, ['run.sh'])
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    // With no git on the PATH, only a cached result can answer.
    vi.stubEnv('PATH', '')
    try {
      expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('gives UNREADABLE after a failed refresh, and recovers', () => {
    const root = repo({ 'run.sh': 'x' })
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    git(root, 'update-index', '--chmod=+x', 'run.sh')
    vi.stubEnv('PATH', '')
    try {
      expect(gitModeOf(root, at(root, 'run.sh'))).toBe(UNREADABLE)
    } finally {
      vi.unstubAllEnvs()
    }
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
  })

  it('reads a linked worktree, where .git is a file', () => {
    const main = repo({ 'run.sh': 'x' }, ['run.sh'])
    git(main, '-c', 'user.name=t', '-c', 'user.email=t@t.test', 'commit', '--quiet', '-m', 'm')
    const linked = path.join(plain(), 'linked')
    git(main, 'worktree', 'add', '--quiet', '-b', 'other', linked)
    expect(gitModeOf(linked, at(linked, 'run.sh'))).toBe('100755')
  })

  it('reads a linked worktree again after its index changes', () => {
    const main = repo({ 'run.sh': 'x' })
    git(main, '-c', 'user.name=t', '-c', 'user.email=t@t.test', 'commit', '--quiet', '-m', 'm')
    const linked = path.join(plain(), 'linked')
    git(main, 'worktree', 'add', '--quiet', '-b', 'other', linked)
    expect(gitModeOf(linked, at(linked, 'run.sh'))).toBe('100644')
    git(linked, 'update-index', '--chmod=+x', 'run.sh')
    expect(gitModeOf(linked, at(linked, 'run.sh'))).toBe('100755')
  })

  it('reads the index again when the change time differs', () => {
    // The old index has the same size and the same modification time. Only the
    // change time differs, and it moves on each write. A test cannot show the
    // inode or the other fields alone, so the stamp keeps them as defence.
    const root = repo({ 'run.sh': 'x' })
    const index = path.join(root, '.git', 'index')
    const old = path.join(root, 'old-index')
    copyFileSync(index, old)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    git(root, 'update-index', '--chmod=+x', 'run.sh')
    utimesSync(index, 1e9, 1e9)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    // A file system with a coarse change time needs a pause between two writes.
    const until = Date.now() + 50
    while (Date.now() < until) {
      // Wait.
    }
    writeFileSync(index, readFileSync(old))
    utimesSync(index, 1e9, 1e9)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
  })

  it('finds the git directory again after a linked worktree is made again', () => {
    const main = repo({ 'run.sh': 'x' })
    git(main, '-c', 'user.name=t', '-c', 'user.email=t@t.test', 'commit', '--quiet', '-m', 'm')
    const first = path.join(plain(), 'linked')
    const second = path.join(plain(), 'linked')
    git(main, 'worktree', 'add', '--quiet', '-b', 'one', first)
    git(main, 'worktree', 'add', '--quiet', '-b', 'two', second)
    expect(gitModeOf(second, at(second, 'run.sh'))).toBe('100644')
    // The second worktree has the git directory "linked1". Making it again, with
    // the first one gone, gives the git directory "linked".
    git(main, 'worktree', 'remove', '--force', first)
    git(main, 'worktree', 'remove', '--force', second)
    git(main, 'worktree', 'add', '--quiet', '-b', 'three', second)
    expect(gitModeOf(second, at(second, 'run.sh'))).toBe('100644')
    git(second, 'update-index', '--chmod=+x', 'run.sh')
    expect(gitModeOf(second, at(second, 'run.sh'))).toBe('100755')
  })

  it('gives UNREADABLE when git reads another repository', () => {
    // A `.git` directory that is not a repository: git walks up to the outer one.
    const outer = repo({ 'inner/run.sh': 'x' })
    const inner = at(outer, 'inner')
    put(outer, { 'inner/.git/keep': '' })
    expect(git(inner, 'rev-parse', '--show-toplevel').trim()).toBe(outer)
    expect(gitModeOf(inner, at(inner, 'run.sh'))).toBe(UNREADABLE)
  })

  it.skipIf(chmodCannotBlock)('gives UNREADABLE when the git directory is not readable', () => {
    const root = repo({ 'run.sh': 'x' })
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    withoutAccess(path.join(root, '.git'), () => {
      expect(gitModeOf(root, at(root, 'run.sh'))).toBe(UNREADABLE)
    })
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
  })

  it('does not run the program of core.fsmonitor', () => {
    const root = repo({ 'run.sh': 'x' })
    const mark = path.join(root, 'ran')
    const hook = path.join(root, 'fsmonitor.sh')
    writeFileSync(hook, `#!/bin/sh\ntouch '${mark}'\n`)
    chmodSync(hook, 0o755)
    git(root, 'config', 'core.fsmonitor', hook)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    expect(existsSync(mark)).toBe(false)
  })

  it('gives null for a path in conflict', () => {
    // Each command sets what it needs, so the test needs no global git config.
    const who = ['-c', 'user.name=t', '-c', 'user.email=t@t.test']
    const root = repo({ 'run.sh': 'base\n' })
    git(root, ...who, 'commit', '--quiet', '-am', 'base')
    git(root, 'checkout', '--quiet', '-B', 'side')
    put(root, { 'run.sh': 'side\n' })
    git(root, ...who, 'commit', '--quiet', '-am', 'side')
    git(root, 'checkout', '--quiet', '-B', 'trunk', 'HEAD~1')
    put(root, { 'run.sh': 'trunk\n' })
    git(root, ...who, 'commit', '--quiet', '-am', 'trunk')
    expect(() => git(root, ...who, 'merge', '--no-edit', 'side')).toThrow()
    expect(git(root, 'ls-files', '--unmerged')).toContain('run.sh')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBeNull()
  })

  it('ignores the git variables of a calling hook', () => {
    const root = repo({ 'run.sh': 'x' }, ['run.sh'])
    const other = repo({ 'other.sh': 'x' })
    vi.stubEnv('GIT_INDEX_FILE', path.join(other, '.git', 'index'))
    vi.stubEnv('GIT_DIR', path.join(other, '.git'))
    try {
      expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('gitChildren', () => {
  it('lists the tracked files directly in a directory, with their modes', () => {
    const root = repo(
      {
        'bin/b': 'x',
        'bin/a': 'x',
        'bin/.keep': '',
        'bin/sub/deep': 'x',
        'binary/c': 'x',
        'other/d': 'x',
      },
      ['bin/a'],
      { 'bin/untracked': 'x' },
    )
    expect(gitChildren(root, at(root, 'bin'))).toEqual([
      ['.keep', '100644'],
      ['a', '100755'],
      ['b', '100644'],
    ])
  })

  it('lists the files directly in the root', () => {
    const root = repo({ 'b.txt': 'x', 'a.txt': 'x', 'dir/c.txt': 'x' }, ['a.txt'])
    expect(gitChildren(root, root)).toEqual([
      ['a.txt', '100755'],
      ['b.txt', '100644'],
    ])
  })

  it('gives an empty list for a directory with no tracked file', () => {
    const root = repo({ 'a.txt': 'x' })
    expect(gitChildren(root, at(root, 'bin'))).toEqual([])
  })

  it('gives UNREADABLE for a directory with no .git', () => {
    const root = plain({ 'bin/a': 'x' })
    expect(gitChildren(root, at(root, 'bin'))).toBe(UNREADABLE)
  })
})

describe('gitTracksBelow', () => {
  it('is true when git tracks a file below the directory, at any depth', () => {
    const root = repo({ 'mem/a/deep/x.md': 'x', 'other/y.md': 'y' })
    expect(gitTracksBelow(root, at(root, 'mem'))).toBe(true)
    expect(gitTracksBelow(root, at(root, 'mem/a'))).toBe(true)
  })

  it('is false for a directory with no tracked file, and for a name that only starts the same', () => {
    const root = repo({ 'binary/c': 'x', 'a.txt': 'x' }, [], { 'bin/loose': 'x' })
    expect(gitTracksBelow(root, at(root, 'bin'))).toBe(false)
    expect(gitTracksBelow(root, at(root, 'gone'))).toBe(false)
  })

  it('is true for the root of a repository that tracks a file, false for one with none', () => {
    const root = repo({ 'a.txt': 'x' })
    expect(gitTracksBelow(root, root)).toBe(true)
    const empty = repo({})
    expect(gitTracksBelow(empty, empty)).toBe(false)
  })

  it('gives UNREADABLE for a directory with no .git', () => {
    const root = plain({ 'mem/a': 'x' })
    expect(gitTracksBelow(root, at(root, 'mem'))).toBe(UNREADABLE)
  })
})

describe('gitIgnores', () => {
  const ignores = (root: string, file: string) => gitIgnores(root, at(root, file))

  it('is true for a path that a .gitignore pattern covers, and false for one it does not', () => {
    const root = repo({ '.gitignore': 'CLAUDE.local.md\n' })
    expect(ignores(root, 'CLAUDE.local.md')).toBe(true)
    expect(ignores(root, 'CLAUDE.md')).toBe(false)
  })

  it('answers for a file that is not there', () => {
    const root = repo({ '.gitignore': '.claude/settings.local.json\n' })
    expect(ignores(root, '.claude/settings.local.json')).toBe(true)
    expect(ignores(root, '.claude/settings.json')).toBe(false)
  })

  it('is true for a tracked file that a pattern covers: the answer is the pattern only', () => {
    const root = repo({ '.gitignore': 'a.txt\n', 'a.txt': 'x' })
    expect(ignores(root, 'a.txt')).toBe(true)
  })

  it('reads a .gitignore in a directory below the root', () => {
    const root = repo({ 'sub/.gitignore': 'q\n' })
    expect(ignores(root, 'sub/q')).toBe(true)
    expect(ignores(root, 'q')).toBe(false)
  })

  it('is true for a path below a directory that a directory pattern covers', () => {
    const root = repo({ '.gitignore': 'results/\n' })
    expect(ignores(root, 'evals/results/run/out.json')).toBe(true)
    expect(ignores(root, 'evals/other/run/out.json')).toBe(false)
  })

  it('is false for a path that a later negation takes back', () => {
    const root = repo({ '.gitignore': '*.md\n!keep.md\n' })
    expect(ignores(root, 'drop.md')).toBe(true)
    expect(ignores(root, 'keep.md')).toBe(false)
  })

  it('is false for a pattern in .git/info/exclude, which no clone shares', () => {
    const root = repo({ 'a.txt': 'x' })
    put(root, { '.git/info/exclude': 'private.md\n' })
    expect(ignores(root, 'private.md')).toBe(false)
  })

  it('is false for a pattern in the global excludes file of the machine', () => {
    const root = repo({ 'a.txt': 'x' })
    // The name `.gitignore` is common for a global file, so the name of the source is not enough.
    const global = plain({ '.gitignore': 'machine.md\n' })
    put(global, { config: `[core]\n\texcludesFile = ${path.join(global, '.gitignore')}\n` })
    // The helper `git` reads the same config, so this shows that the config does ignore the path.
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(global, 'config'))
    try {
      expect(ignores(root, 'machine.md')).toBe(false)
      expect(
        execFileSync('git', ['check-ignore', '--no-index', '--', 'machine.md'], {
          cwd: root,
          encoding: 'utf8',
          env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(global, 'config') },
        }).trim(),
      ).toBe('machine.md')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('is false for the default global excludes file under XDG_CONFIG_HOME', () => {
    const root = repo({ 'a.txt': 'x' })
    const home = plain({ 'git/ignore': 'xdg.md\n' })
    vi.stubEnv('XDG_CONFIG_HOME', home)
    try {
      expect(ignores(root, 'xdg.md')).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('reads the source of a pattern in a directory with a colon in its name', () => {
    const root = repo({ ':(top)pkg/.gitignore': 'z\n' })
    expect(ignores(root, ':(top)pkg/z')).toBe(true)
  })

  it('takes a path with a space, a leading dash, a colon and a glob character as a literal', () => {
    const root = repo({
      '.gitignore': 'target\n-x\n',
      'a b/.gitignore': 'z\n',
    })
    expect(ignores(root, 'a b/z')).toBe(true)
    expect(ignores(root, '-x')).toBe(true)
    // A leading colon starts pathspec magic, and git would read the path as `target`.
    expect(ignores(root, ':(top)target')).toBe(false)
    expect(ignores(root, 'sub/:(top)target')).toBe(false)
    expect(ignores(root, 'a*')).toBe(false)
  })

  it.skipIf(process.platform === 'win32')(
    'names the source of a pattern that git quotes, such as a directory with a tab',
    () => {
      const root = repo({ 'a\tb/.gitignore': 'z\n' })
      expect(ignores(root, 'a\tb/z')).toBe(true)
    },
  )

  it('gives UNREADABLE for a directory with no .git', () => {
    const root = plain({ '.gitignore': 'a\n' })
    expect(ignores(root, 'a')).toBe(UNREADABLE)
  })

  it('gives UNREADABLE when git is not on the PATH', () => {
    const root = repo({ '.gitignore': 'a\n' })
    vi.stubEnv('PATH', '')
    try {
      expect(ignores(root, 'a')).toBe(UNREADABLE)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('gives UNREADABLE when git reads another repository', () => {
    const outer = repo({ '.gitignore': 'a\n', 'inner/x': 'x' })
    put(outer, { 'inner/.git/keep': '' })
    const inner = at(outer, 'inner')
    expect(ignores(inner, 'a')).toBe(UNREADABLE)
  })

  it.skipIf(process.platform === 'win32')(
    'gives UNREADABLE for a path beyond a symbolic link, where git stops with a fatal error',
    () => {
      const root = repo({ '.gitignore': 'a\n' })
      const outside = plain()
      symlinkSync(outside, at(root, '.claude'))
      mkdirSync(at(outside, 'sub'))
      expect(ignores(root, '.claude/settings.local.json')).toBe(UNREADABLE)
    },
  )

  it('does not stop on the status of a pattern that matches nothing', () => {
    const root = repo({ '.gitignore': '# only a comment\n' })
    expect(ignores(root, 'a')).toBe(false)
  })
})
