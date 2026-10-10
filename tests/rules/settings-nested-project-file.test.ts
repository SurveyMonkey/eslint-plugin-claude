// The expected values come from the monorepo guide
// (https://code.claude.com/docs/en/large-codebases#choose-where-to-start-claude): "Project settings
// in `.claude/settings.json` aren't inherited from parent directories the way CLAUDE.md files
// are." A file in a package applies to a session that starts there. The rule needs the root of the
// repository, so each case builds a tree on disk. The file globs are in `tests/configs.test.ts`.
import { mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

// ADR 001, Decision 14: no call reaches a path above the repository. The recorder keeps the first
// argument of each file system call that the rule can make, while `recorded.on` is true.
const recorded = vi.hoisted(() => ({ on: false, paths: [] as string[] }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const names = [
    'realpathSync',
    'existsSync',
    'statSync',
    'lstatSync',
    'readdirSync',
    'readFileSync',
  ]
  const wrapped: Record<string, unknown> = {}
  for (const name of names) {
    const original = (actual as unknown as Record<string, (...args: unknown[]) => unknown>)[name]
    if (original === undefined) {
      continue
    }
    wrapped[name] = Object.assign(
      (file: unknown, ...rest: unknown[]) => {
        if (recorded.on) {
          recorded.paths.push(String(file))
        }
        return original(file, ...rest)
      },
      name === 'realpathSync' ? { native: actual.realpathSync.native } : {},
    )
  }
  return { ...actual, ...wrapped, default: { ...actual, ...wrapped } }
})

const ROOT_FILE = '.claude/settings.json'

/** The messages of the rule for an empty settings object at `file` in the tree `dir`. */
const lint = (dir: string, file: string, code = '{}') =>
  lintJson('settings-nested-project-file', code, path.join(dir, file))

const ids = (dir: string, file: string) => lint(dir, file).map((m) => m.messageId)

describe('settings-nested-project-file', () => {
  it('reports a project file below the repository root', () => {
    expect(ids(tree({}), `pkg/${ROOT_FILE}`)).toEqual(['nested'])
    expect(ids(tree({}), `apps/web/${ROOT_FILE}`)).toEqual(['nested'])
  })

  it('reports on the top-level value, and names the directory', () => {
    const dir = tree({})
    const [message] = lint(dir, `apps/web/${ROOT_FILE}`, '\n  {}')
    expect([message?.line, message?.column]).toEqual([2, 3])
    expect(message?.message).toBe(
      'Claude Code reads this file only in a session that starts in "apps/web", and it does not fall back to the settings file of a parent directory. Keep in this file every setting that such a session needs, or move the shared settings to the file at the repository root.',
    )
  })

  it('is silent for the project file at the repository root', () => {
    expect(ids(tree({}), ROOT_FILE)).toEqual([])
  })

  it('is silent when the repository has a `.git` file, as a worktree has', () => {
    const dir = tree({ '.git': 'gitdir: ../elsewhere' }, false)
    expect(ids(dir, ROOT_FILE)).toEqual([])
    expect(ids(dir, `pkg/${ROOT_FILE}`)).toEqual(['nested'])
  })

  it('is silent where no `.git` shows a repository root', () => {
    expect(ids(tree({}, false), `pkg/${ROOT_FILE}`)).toEqual([])
  })

  it('takes a nested repository as a root of its own', () => {
    const dir = tree({})
    mkdirSync(path.join(dir, 'pkg/.git'), { recursive: true })
    expect(ids(dir, `pkg/${ROOT_FILE}`)).toEqual([])
    expect(ids(dir, `pkg/sub/${ROOT_FILE}`)).toEqual(['nested'])
  })

  it('reads the file path and the `.git` entries only, never a path above the root', () => {
    const outer = tree({})
    const repo = path.join(outer, 'repo')
    mkdirSync(path.join(repo, '.git'), { recursive: true })
    recorded.paths = []
    recorded.on = true
    try {
      expect(ids(outer, `repo/pkg/${ROOT_FILE}`)).toEqual(['nested'])
      expect(ids(outer, `repo/${ROOT_FILE}`)).toEqual([])
    } finally {
      recorded.on = false
    }
    const inside = (entry: string) =>
      [repo, realpathSync(repo)].some((root) => entry === root || entry.startsWith(root + path.sep))
    expect(recorded.paths.length).toBeGreaterThan(0)
    expect(recorded.paths.filter((entry) => !inside(entry))).toEqual([])
  })

  it.skipIf(noLinks)('compares the real path, so a link to the root is the root', () => {
    const dir = tree({})
    link(dir, 'alias', '.')
    expect(ids(dir, `alias/${ROOT_FILE}`)).toEqual([])
  })
})
