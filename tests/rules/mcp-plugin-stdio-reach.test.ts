// A local stdio server of a plugin runs in Claude Code and in local Cowork, but not on claude.ai
// (plugin components, "Reach users on claude.ai and Cowork"). No file says that a plugin targets
// claude.ai, so the option `targets` names it, and the rule reports nothing when it is unset.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'
import { ids, mapOf } from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-plugin-stdio-reach'
const ON = [{ targets: ['claude-ai'] }]

/** Lint `code` as the file `at` of a repository with `files`, with the options `options`. */
function lint(code: string, at: string, options: unknown[], files: Record<string, string> = {}) {
  const root = repo({ 'p/.claude-plugin/plugin.json': '{}', ...files })
  const filename = path.join(root, at)
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${NAME}`]: ['error', ...options] },
      },
    ],
    { filename },
  )
}
const pluginFile = (code: string, options: unknown[] = ON) => lint(code, 'p/.mcp.json', options)
const manifest = (mcpServers: unknown, options: unknown[] = ON, files = {}) =>
  lint(JSON.stringify({ name: 'p', mcpServers }), 'p/.claude-plugin/plugin.json', options, files)
const stdio = { command: 'node', args: ['server.js'] }

it.fails('reports a stdio server of a plugin .mcp.json, on the name', () => {
  const found = pluginFile(mapOf({ db: { type: 'stdio', ...stdio } }))
  expect(ids(found)).toEqual(['stdio'])
  expect(found[0]).toMatchObject({ line: 1, column: 17, endColumn: 21 })
  expect(found[0]?.message).toContain('"db"')
})
it.fails('reads a server with a command and no type as stdio', () => {
  expect(ids(pluginFile(mapOf({ db: stdio })))).toEqual(['stdio'])
  expect(ids(pluginFile(JSON.stringify({ db: stdio })))).toEqual(['stdio'])
})
it.fails('reports an inline server and a server of a declared file', () => {
  expect(ids(manifest({ db: stdio }))).toEqual(['stdio'])
  const found = manifest('./servers.json', ON, { 'p/servers.json': mapOf({ db: stdio }) })
  expect(ids(found)).toEqual(['stdio'])
  expect(found[0]).toMatchObject({ line: 1, column: 26 })
})
it.fails('leaves the .mcp.json at the plugin root to its own lint', () => {
  expect(ids(manifest({}, ON, { 'p/.mcp.json': mapOf({ db: stdio }) }))).toEqual([])
})
it.fails('reports nothing when targets is unset or empty, or has no claude-ai', () => {
  const code = mapOf({ db: stdio })
  expect(ids(pluginFile(code, []))).toEqual([])
  expect(ids(pluginFile(code, [{}]))).toEqual([])
  expect(ids(pluginFile(code, [{ targets: [] }]))).toEqual([])
  expect(ids(manifest({ db: stdio }, []))).toEqual([])
})
it.fails('stays silent for a remote server', () => {
  const remote = (type: string) => mapOf({ a: { type, url: 'https://x.test/mcp' } })
  for (const type of ['http', 'sse', 'streamable-http', 'ws']) {
    expect(ids(pluginFile(remote(type)))).toEqual([])
  }
  expect(ids(pluginFile(mapOf({ a: { url: 'https://x.test/mcp' } })))).toEqual([])
})
it.fails('stays silent for an entry that is not a server', () => {
  expect(ids(pluginFile(mapOf({ a: {}, b: 1, c: { type: 1, command: 'x' } })))).toEqual([])
  expect(ids(pluginFile(mapOf({ a: { type: 'http', command: 'x' } })))).toEqual([])
})
it.fails('stays silent in a project .mcp.json', () => {
  const root = repo({})
  const code = mapOf({ db: stdio })
  const filename = path.join(root, '.mcp.json')
  const found = new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${NAME}`]: ['error', ...ON] },
      },
    ],
    { filename },
  )
  expect(ids(found)).toEqual([])
})
it.fails('reads the last command member and the last type member', () => {
  const server = '{"mcpServers": {"a": {"command": "x", "type": "http", "type": "stdio"}}}'
  expect(ids(pluginFile(server))).toEqual(['stdio'])
  const remote = '{"mcpServers": {"a": {"type": "stdio", "type": "http", "command": "x"}}}'
  expect(ids(pluginFile(remote))).toEqual([])
})
