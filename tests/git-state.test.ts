// The reader of the git index. The tests make real repositories with `git init`.
// The executable bit is the index mode, so some cases make the disk mode and the
// index mode differ.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { gitChildren, gitModeOf, PLAIN_MODE } from '../src/git-state.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { git, plain, put, repo } from './git-tree.test-support.ts'

const at = (root: string, file: string) => path.join(root, file)

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

  it('reads the index again when only the file identity changes', () => {
    // The old index has the same size and the same time of the last write.
    const root = repo({ 'run.sh': 'x' })
    const index = path.join(root, '.git', 'index')
    const old = path.join(root, 'old-index')
    copyFileSync(index, old)
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100644')
    git(root, 'update-index', '--chmod=+x', 'run.sh')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
    const { mtime } = statSync(index)
    writeFileSync(index, readFileSync(old))
    utimesSync(index, mtime, mtime)
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
    const root = repo({ 'run.sh': 'base\n' })
    const commit = (message: string) =>
      git(
        root,
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t.test',
        'commit',
        '--quiet',
        '-am',
        message,
      )
    commit('base')
    const main = git(root, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
    git(root, 'checkout', '--quiet', '-b', 'side')
    put(root, { 'run.sh': 'side\n' })
    commit('side')
    git(root, 'checkout', '--quiet', main)
    put(root, { 'run.sh': 'main\n' })
    commit('main')
    expect(() => git(root, 'merge', 'side')).toThrow()
    expect(git(root, 'ls-files', '--unmerged')).toContain('run.sh')
    expect(gitModeOf(root, at(root, 'run.sh'))).toBeNull()
  })

  it.each(['GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE'])(
    'ignores %s of a calling hook',
    (name) => {
      const root = repo({ 'run.sh': 'x' }, ['run.sh'])
      const other = repo({ 'other.sh': 'x' })
      vi.stubEnv(name, name === 'GIT_NAMESPACE' ? 'other' : path.join(other, '.git'))
      try {
        expect(gitModeOf(root, at(root, 'run.sh'))).toBe('100755')
      } finally {
        vi.unstubAllEnvs()
      }
    },
  )

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

  it('gives an empty list for a directory with no tracked file', () => {
    const root = repo({ 'a.txt': 'x' })
    expect(gitChildren(root, at(root, 'bin'))).toEqual([])
  })

  it('gives UNREADABLE for a directory with no .git', () => {
    const root = plain({ 'bin/a': 'x' })
    expect(gitChildren(root, at(root, 'bin'))).toBe(UNREADABLE)
  })
})
