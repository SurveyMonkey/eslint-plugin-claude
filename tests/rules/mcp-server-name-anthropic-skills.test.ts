// Claude Code reserves the server name `anthropic-skills` for the skills that it syncs from
// claude.ai. The prompts of a server with that name do not appear as commands.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-server-name-anthropic-skills'
const server = { command: 'node' }
const named = (...names: string[]) => mapOf(Object.fromEntries(names.map((n) => [n, server])))
const manifest = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

it.fails('reports the name in a project file, on the name', () => {
  const found = lintProject(NAME, named('anthropic-skills', 'other'))
  expect(ids(found)).toEqual(['synced'])
  expect(found[0]).toMatchObject({ line: 1, column: 17, endColumn: 35 })
})
it.fails('stays silent for another name, including a near one', () => {
  expect(ids(lintProject(NAME, named('anthropic', 'skills', 'Anthropic-Skills')))).toEqual([])
  expect(ids(lintProject(NAME, named('anthropic-skills-2', 'my-anthropic-skills')))).toEqual([])
})
it.fails('reports in a plugin file, with and without the wrapper', () => {
  expect(ids(lintPluginFile(NAME, named('anthropic-skills')))).toEqual(['synced'])
  expect(ids(lintPluginFile(NAME, JSON.stringify({ 'anthropic-skills': server })))).toEqual([
    'synced',
  ])
  expect(ids(lintPluginFile(NAME, named('other')))).toEqual([])
})
it.fails('reports an inline manifest server on its name', () => {
  const found = lintManifest(NAME, manifest({ 'anthropic-skills': server }))
  expect(ids(found)).toEqual(['synced'])
  expect(found[0]).toMatchObject({ line: 1, column: 27 })
})
it.fails('reports a server of a declared file on the path in the manifest', () => {
  const found = lintManifest(NAME, manifest('./servers.json'), {
    'p/servers.json': named('anthropic-skills'),
  })
  expect(ids(found)).toEqual(['synced'])
  expect(found[0]).toMatchObject({ line: 1, column: 26 })
})
it.fails('leaves the .mcp.json at the plugin root to its own lint', () => {
  const files = { 'p/.mcp.json': named('anthropic-skills') }
  expect(ids(lintManifest(NAME, manifest({}), files))).toEqual([])
})
it.fails('does not read a path under .claude/ or a map that is not an object', () => {
  expect(ids(lintProject(NAME, named('anthropic-skills'), '.claude/mcp.json'))).toEqual([])
  expect(ids(lintProject(NAME, '{"mcpServers": []}'))).toEqual([])
})
