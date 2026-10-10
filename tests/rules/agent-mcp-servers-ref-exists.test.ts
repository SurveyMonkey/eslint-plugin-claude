// The sub-agents page, "Scope MCP servers to a subagent": a string entry of `mcpServers` is "a
// string referencing an MCP server already configured in your session". The mcp page, "MCP
// installation scopes": a project server is in `.mcp.json` at the project root. A user server is in
// `~/.claude.json`, and the rule cannot see it. The files are on disk, because the rule reads
// `.mcp.json` in the project folder and in each folder above it.
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { agent, repo } from '../agent-settings.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
const AGENT = '.claude/agents/a.md'
const servers = (...names: string[]) =>
  JSON.stringify({ mcpServers: Object.fromEntries(names.map((n) => [n, { command: 'x' }])) })
const list = (...names: string[]) => `mcpServers:\n${names.map((n) => `  - ${n}\n`).join('')}`
const run = (
  files: Record<string, string>,
  fields = list('github'),
  at = AGENT,
  options: unknown[] = [],
) => lintAgent('agent-mcp-servers-ref-exists', agent(fields), path.join(repo(files), at), options)

describe('agent-mcp-servers-ref-exists', () => {
  describe('reports', () => {
    it('a name that no .mcp.json holds, on the item', () => {
      expect(run({ '.mcp.json': servers('slack') })).toMatchObject([
        { messageId: 'missing', line: 5, column: 5, endLine: 5, endColumn: 11 },
      ])
      expect(run({ '.mcp.json': servers('slack') })[0]?.message).toContain('github')
    })
    it('a name when the project has no .mcp.json', () => {
      expect(run({})).toHaveLength(1)
    })
    it('a name when .mcp.json has no server map', () => {
      expect(run({ '.mcp.json': '{}' })).toHaveLength(1)
      expect(run({ '.mcp.json': '{"mcpServers":[]}' })).toHaveLength(1)
    })
    it('each name that is missing, and not a name that is there', () => {
      expect(run({ '.mcp.json': servers('a') }, list('a', 'b', 'c'))).toHaveLength(2)
    })
    it('a name in a .mcp.json that is not at the project root of a nested project', () => {
      expect(run({ 'other/.mcp.json': servers('github') })).toHaveLength(1)
    })
  })

  describe('stays silent', () => {
    it('for a name in .mcp.json at the project root, in any letter case', () => {
      expect(run({ '.mcp.json': servers('github') })).toEqual([])
      expect(run({ '.mcp.json': servers('GitHub') })).toEqual([])
    })
    it('for a name in .mcp.json of a folder above the project', () => {
      const files = { '.mcp.json': servers('github') }
      expect(run(files, list('github'), 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it('for a name in the option allow', () => {
      expect(run({}, list('hubspot'), AGENT, [{ allow: ['HubSpot'] }])).toEqual([])
    })
    it('for an inline server, a scoped name and an entry that is not a string', () => {
      const inline =
        'mcpServers:\n  - playwright:\n      type: stdio\n      command: npx\n  - plugin:p:db\n  - ""\n  - 5\n'
      expect(run({}, inline)).toEqual([])
    })
    it('for a plugin agent', () => {
      expect(
        lintAgent('agent-mcp-servers-ref-exists', agent(list('github')), pluginAgent()),
      ).toEqual([])
    })
    it('for a value that is no list, and for no field', () => {
      expect(run({}, 'mcpServers: github\n')).toEqual([])
      expect(run({}, 'mcpServers:\n')).toEqual([])
      expect(run({}, '')).toEqual([])
    })
    it('for a file outside the agents folders, and a file with no frontmatter', () => {
      expect(run({}, list('github'), 'docs/a.md')).toEqual([])
      expect(run({}, 'Body only.\n')).toEqual([])
    })
    it('when .mcp.json does not parse or is not an object, here or above', () => {
      expect(run({ '.mcp.json': '{' })).toEqual([])
      expect(run({ '.mcp.json': '[]' })).toEqual([])
      expect(run({ '.mcp.json': '{' }, list('github'), 'pkg/.claude/agents/a.md')).toEqual([])
    })
    it('when .mcp.json is a link out of the repository or a dangling link', () => {
      const root = repo({})
      const outside = path.join(path.dirname(root), `${path.basename(root)}-mcp.json`)
      writeFileSync(outside, servers('github'))
      symlinkSync(outside, path.join(root, '.mcp.json'))
      mkdirSync(path.join(root, 'pkg'), { recursive: true })
      symlinkSync(path.join(root, 'nowhere.json'), path.join(root, 'pkg', '.mcp.json'))
      const code = agent(list('github'))
      expect(lintAgent('agent-mcp-servers-ref-exists', code, path.join(root, AGENT))).toEqual([])
      expect(
        lintAgent('agent-mcp-servers-ref-exists', code, path.join(root, 'pkg/.claude/agents/a.md')),
      ).toEqual([])
    })
    unreadable('when .mcp.json cannot be read', () => {
      const root = repo({ '.mcp.json': servers('slack') })
      withoutAccess(path.join(root, '.mcp.json'), () => {
        expect(
          lintAgent('agent-mcp-servers-ref-exists', agent(list('github')), path.join(root, AGENT)),
        ).toEqual([])
      })
    })
  })
})
