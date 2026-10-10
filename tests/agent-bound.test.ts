// ADR 001, Decision 14: a rule reads no file out of the repository. The four cross-file agent rules
// of this layer walk up from the project folder. The wrapper below records the path of each file
// system call and sends it to the real function. A clash above the repository root silences a rule
// that reads it, so each case checks both facts: the report stays, and no call reaches the clash.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lintAgent } from './agent-rules.test-support.ts'
import { agent, repo } from './agent-settings.test-support.ts'

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
    lstatSync: record(actual.lstatSync as (...args: unknown[]) => unknown),
    readdirSync: record(actual.readdirSync as (...args: unknown[]) => unknown),
    readFileSync: record(actual.readFileSync as (...args: unknown[]) => unknown),
    statSync: record(actual.statSync as (...args: unknown[]) => unknown),
    realpathSync: Object.assign(record(actual.realpathSync), {
      native: actual.realpathSync.native,
    }),
  }
  return { ...actual, ...wrapped, default: { ...actual, ...wrapped } }
})

const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'agent-bound-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

beforeEach(() => {
  calls.paths = []
})

/** The recorded paths that are strictly above `root`. */
const above = (root: string) =>
  calls.paths.filter((file) => path.relative(root, file).startsWith('..'))

/** A file in the folder that holds the repository `root`. */
function clash(root: string, file: string, text: string) {
  const full = path.join(path.dirname(root), file)
  mkdirSync(path.dirname(full), { recursive: true })
  writeFileSync(full, text)
}

const AT = 'pkg/.claude/agents/a.md'
const named = JSON.stringify({ agent: 'a' })

describe('a walk above the project folder', () => {
  it.fails('agent-initial-prompt-main-only makes no call above the repository root', () => {
    const root = repo({})
    clash(root, '.claude/settings.json', named)
    const messages = lintAgent(
      'agent-initial-prompt-main-only',
      agent('initialPrompt: Go\n'),
      path.join(root, AT),
    )
    expect(messages).toHaveLength(1)
    expect(calls.paths.some((file) => file.startsWith(root))).toBe(true)
    expect(above(root)).toEqual([])
  })

  it.fails('agent-tools-agent-type-list makes no call above the repository root', () => {
    const root = repo({})
    clash(root, '.claude/settings.json', named)
    clash(root, '.claude/agents/ghost.md', agent('', 'ghost'))
    const messages = lintAgent(
      'agent-tools-agent-type-list',
      agent('tools: Agent(ghost)\n'),
      path.join(root, AT),
    )
    expect(messages).toHaveLength(1)
    expect(above(root)).toEqual([])
    const main = repo({ '.claude/settings.json': named })
    clash(main, '.claude/agents/ghost.md', agent('', 'ghost'))
    const second = lintAgent(
      'agent-tools-agent-type-list',
      agent('tools: Agent(ghost)\n'),
      path.join(main, AT),
    )
    expect(second).toHaveLength(1)
    expect(above(main)).toEqual([])
  })

  it.fails('agent-skills-exist makes no call above the repository root', () => {
    const root = repo({})
    clash(root, '.claude/skills/ghost/SKILL.md', '---\ndescription: d\n---\n')
    const messages = lintAgent(
      'agent-skills-exist',
      agent('skills:\n  - ghost\n'),
      path.join(root, AT),
    )
    expect(messages).toHaveLength(1)
    expect(above(root)).toEqual([])
  })

  it.fails('agent-mcp-servers-ref-exists makes no call above the repository root', () => {
    const root = repo({})
    clash(root, '.mcp.json', '{"mcpServers":{"github":{"command":"x"}}}')
    const messages = lintAgent(
      'agent-mcp-servers-ref-exists',
      agent('mcpServers:\n  - github\n'),
      path.join(root, AT),
    )
    expect(messages).toHaveLength(1)
    expect(above(root)).toEqual([])
  })
})
