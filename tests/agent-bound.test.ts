// ADR 001, Decision 14: a rule reads no file out of the repository. The cross-file agent rules
// (initial prompt, type list, skills and MCP servers) walk up from the project folder. The wrapper below records the path of each file
// system call and sends it to the real function. A clash is a decoy file above the repository
// root. A clash silences a rule that reads it, so each case checks both facts: the report stays,
// and no call reaches the clash.
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
  it('agent-initial-prompt-main-only makes no call above the repository root', () => {
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

  it('agent-tools-agent-type-list makes no call above the repository root', () => {
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
    calls.paths = []
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

  it('agent-skills-exist makes no call above the repository root', () => {
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

  it('agent-mcp-servers-ref-exists makes no call above the repository root', () => {
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

  it.fails('a manifest agents path makes no call above the repository root', () => {
    const root = repo({
      'plugins/p/.claude-plugin/plugin.json': '{"name":"p","agents":["./c/a.md"]}',
    })
    // The plugin above the repository names the same file. It must not count.
    clash(
      root,
      '.claude-plugin/plugin.json',
      JSON.stringify({ name: 'o', agents: [`./${path.basename(root)}/plugins/p/d/a.md`] }),
    )
    const rule = 'agent-description-proactive'
    const own = lintAgent(rule, agent(''), path.join(root, 'plugins/p/c/a.md'))
    expect(own).toHaveLength(1)
    expect(calls.paths.some((file) => file.startsWith(root))).toBe(true)
    calls.paths = []
    const other = lintAgent(rule, agent(''), path.join(root, 'plugins/p/d/a.md'))
    expect(other).toEqual([])
    expect(above(root)).toEqual([])
  })

  it.fails('agent-descriptions-budget makes no call above the repository root', () => {
    const huge = agent('', 'big').replace('description: d', `description: ${'x'.repeat(30000)}`)
    const root = repo({
      '.claude/agents/b.md': huge,
      'pkg/.claude/agents/b.md': agent('', 'small'),
    })
    clash(root, '.claude/agents/c.md', huge)
    const messages = lintAgent('agent-descriptions-budget', huge, path.join(root, AT))
    expect(messages).toEqual([])
    const second = lintAgent(
      'agent-descriptions-budget',
      huge,
      path.join(root, '.claude/agents/a.md'),
    )
    expect(second).toHaveLength(1)
    expect(above(root)).toEqual([])
  })
})
