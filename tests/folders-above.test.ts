// ADR 001, Decision 14: a rule reads no file out of the repository. The two rules that walk
// up from a project folder must stop at the repository root. The wrapper below records the
// path of each file system call and sends it to the real function. The boundary is the thing
// under test: a folder above the root with a clashing file gives no report even when the
// rule reads it, so a report cannot prove that no call reaches it.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { foldersAbove } from '../src/folders-above.ts'
import { agent, repo } from './agent-settings.test-support.ts'
import { lintMarkdown } from './rule-tester.test-support.ts'

const calls = vi.hoisted(() => ({ paths: [] as string[] }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const record =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      calls.paths.push(String(args[0]))
      return fn(...args)
    }
  const wrapped = {
    existsSync: record(actual.existsSync),
    readdirSync: record(actual.readdirSync as (...args: unknown[]) => unknown),
    readFileSync: record(actual.readFileSync as (...args: unknown[]) => unknown),
    statSync: record(actual.statSync as (...args: unknown[]) => unknown),
    realpathSync: Object.assign(record(actual.realpathSync), {
      native: actual.realpathSync.native,
    }),
  }
  return { ...actual, ...wrapped, default: { ...actual, ...wrapped } }
})

const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'folders-above-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

beforeEach(() => {
  calls.paths = []
})

/** The recorded paths that are strictly above `root`. */
const above = (root: string) =>
  calls.paths.filter((file) => path.relative(root, file).startsWith('..'))

describe('foldersAbove', () => {
  it('lists the folders between the project folder and the repository root, nearest first', () => {
    const root = repo({})
    const scope = path.join(root, 'a', 'b', '.claude')
    mkdirSync(scope, { recursive: true })
    expect(foldersAbove(scope)).toEqual([path.join(root, 'a'), root])
  })

  it('is empty for a project folder that is the repository root', () => {
    const root = repo({})
    expect(foldersAbove(path.join(root, '.claude'))).toEqual([])
  })

  it('stops at a .git that is a file, as in a worktree', () => {
    const root = path.join(scratch, 'gitfile')
    const scope = path.join(root, 'a', '.claude')
    mkdirSync(scope, { recursive: true })
    writeFileSync(path.join(root, '.git'), 'gitdir: elsewhere\n')
    expect(foldersAbove(scope)).toEqual([root])
  })

  it('is empty when .git is in the .claude folder itself', () => {
    const scope = path.join(scratch, 'ingit', 'pkg', '.claude')
    mkdirSync(path.join(scope, '.git'), { recursive: true })
    expect(foldersAbove(scope)).toEqual([])
  })

  it('stops at the nearest of two nested repositories', () => {
    const root = path.join(scratch, 'outer')
    const inner = path.join(root, 'sub')
    const scope = path.join(inner, 'pkg', '.claude')
    mkdirSync(path.join(root, '.git'), { recursive: true })
    mkdirSync(path.join(inner, '.git'), { recursive: true })
    mkdirSync(scope, { recursive: true })
    expect(foldersAbove(scope)).toEqual([inner])
  })

  it('is empty with no .git, because the bound is the .claude folder', () => {
    const scope = path.join(scratch, 'plain', 'pkg', '.claude')
    mkdirSync(scope, { recursive: true })
    expect(foldersAbove(scope)).toEqual([])
  })
})

describe('a walk above the project folder', () => {
  const clash = (outer: string, folder: string, file: string) => {
    mkdirSync(path.join(outer, '.claude', folder), { recursive: true })
    writeFileSync(path.join(outer, '.claude', folder, file), agent('', 'dup'))
  }

  it('agent-name-shadowing makes no call at a path above the repository root', () => {
    const root = repo({})
    clash(path.dirname(root), 'agents', 'out.md')
    expect(
      lintMarkdown(
        'agent-name-shadowing',
        agent('', 'dup'),
        path.join(root, 'pkg/.claude/agents/a.md'),
      ),
    ).toEqual([])
    expect(calls.paths.some((file) => file.startsWith(root))).toBe(true)
    expect(above(root)).toEqual([])
  })

  it('output-style-name-unique makes no call at a path above the repository root', () => {
    const root = repo({})
    clash(path.dirname(root), 'output-styles', 'out.md')
    expect(
      lintMarkdown(
        'output-style-name-unique',
        '---\nname: dup\n---\n',
        path.join(root, 'pkg/.claude/output-styles/a.md'),
      ),
    ).toEqual([])
    expect(calls.paths.some((file) => file.startsWith(root))).toBe(true)
    expect(above(root)).toEqual([])
  })
})
