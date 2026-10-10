// The expected values come from the settings page
// (https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository):
// since v2.1.211 Claude Code keeps `.claude/settings.local.json` at the repository root, and
// before that version it kept the file in the directory where the session started. It still reads
// a file that an earlier version left. The rule needs the root of the repository, so each case
// builds a tree on disk. The file globs are in `tests/configs.test.ts`.
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

const ROOT_FILE = '.claude/settings.local.json'

/** The ids of the rule for an empty settings object at `file` in the tree `dir`. */
const ids = (dir: string, file: string) =>
  lintJson('settings-local-location', '{}', path.join(dir, file)).map((m) => m.messageId)

describe('settings-local-location', () => {
  it('reports a local file below the repository root', () => {
    expect(ids(tree({}), `pkg/${ROOT_FILE}`)).toEqual(['leftover'])
    expect(ids(tree({}), `apps/web/${ROOT_FILE}`)).toEqual(['leftover'])
  })

  it('reports on the top-level value, and names the version', () => {
    const dir = tree({})
    const [message] = lintJson(
      'settings-local-location',
      '\n  {}',
      path.join(dir, `pkg/${ROOT_FILE}`),
    )
    expect([message?.line, message?.column]).toEqual([2, 3])
    expect(message?.message).toContain('v2.1.211')
  })

  it('is silent for the local file at the repository root', () => {
    expect(ids(tree({}), ROOT_FILE)).toEqual([])
  })

  it('is silent when the repository has a `.git` file, as a worktree has', () => {
    const dir = tree({ '.git': 'gitdir: ../elsewhere' }, false)
    expect(ids(dir, ROOT_FILE)).toEqual([])
    expect(ids(dir, `pkg/${ROOT_FILE}`)).toEqual(['leftover'])
  })

  it('is silent where no `.git` shows a repository root', () => {
    const dir = tree({}, false)
    expect(ids(dir, `pkg/${ROOT_FILE}`)).toEqual([])
  })

  it('takes a nested repository as a root of its own', () => {
    const dir = tree({})
    mkdirSync(path.join(dir, 'pkg/.git'), { recursive: true })
    expect(ids(dir, `pkg/${ROOT_FILE}`)).toEqual([])
    expect(ids(dir, `pkg/sub/${ROOT_FILE}`)).toEqual(['leftover'])
  })

  it('reads the file path and the `.git` entries only, never a path above the root', () => {
    const outer = tree({})
    const repo = path.join(outer, 'repo')
    mkdirSync(path.join(repo, '.git'), { recursive: true })
    recorded.paths = []
    recorded.on = true
    try {
      expect(ids(outer, `repo/pkg/${ROOT_FILE}`)).toEqual(['leftover'])
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
