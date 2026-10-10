// A `./` or `../` path in the `command` or `args` of a project `.mcp.json` resolves against the
// directory where the user starts Claude Code, not against `.mcp.json`.
import { expect, it } from 'vitest'
import { ids, lintPluginFile, lintProject, mapOf } from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-stdio-relative-path'
const stdio = (server: unknown) => mapOf({ a: server })
// The path that the docs give for a project file: the variable has a default.
const PROJECT = `\${CLAUDE_PROJECT_DIR:-.}/server.js`

it.fails('reports a ./ command, on the value', () => {
  const found = lintProject(NAME, stdio({ command: './server.js' }))
  expect(ids(found)).toEqual(['relative'])
  expect(found[0]).toMatchObject({ line: 1, column: 32, endColumn: 45 })
  expect(found[0]?.message).toContain('`command`')
  expect(found[0]?.message).toContain('"a"')
})
it.fails('reports a ../ command', () => {
  expect(ids(lintProject(NAME, stdio({ command: '../bin/server' })))).toEqual(['relative'])
})
it.fails('reports a ./ or ../ item of args, with its index', () => {
  const found = lintProject(
    NAME,
    stdio({ command: 'node', args: ['--flag', './server.js', '../x'] }),
  )
  expect(ids(found)).toEqual(['relative', 'relative'])
  expect(found[0]?.message).toContain('`args[1]`')
  expect(found[1]?.message).toContain('`args[2]`')
})
it.fails('stays silent for the project dir variable with a default', () => {
  const code = stdio({ command: 'node', args: [PROJECT] })
  expect(ids(lintProject(NAME, code))).toEqual([])
  expect(ids(lintProject(NAME, stdio({ command: PROJECT })))).toEqual([])
})
it.fails('stays silent for an absolute path, a bare command and other forms', () => {
  const args = [
    '/opt/server.js',
    'server.js',
    '.hidden',
    '..x',
    '.',
    '..',
    '--config=./x',
    '-r',
    '',
  ]
  expect(ids(lintProject(NAME, stdio({ command: '/opt/server', args })))).toEqual([])
  expect(ids(lintProject(NAME, stdio({ command: 'npx', args: ['-y', 'pkg'] })))).toEqual([])
  expect(ids(lintProject(NAME, stdio({ command: 'server' })))).toEqual([])
})
it.fails('stays silent for a value that is not a string, or args that are not a list', () => {
  expect(ids(lintProject(NAME, stdio({ command: 1, args: [1, null, ['./x']] })))).toEqual([])
  expect(ids(lintProject(NAME, stdio({ command: 'node', args: './server.js' })))).toEqual([])
  expect(ids(lintProject(NAME, stdio({ command: ['./x'] })))).toEqual([])
})
it.fails('reads the last command and args members', () => {
  const code = '{"mcpServers": {"a": {"command": "./x", "command": "node"}}}'
  expect(ids(lintProject(NAME, code))).toEqual([])
  const args = '{"mcpServers": {"a": {"args": ["./x"], "args": ["y"]}}}'
  expect(ids(lintProject(NAME, args))).toEqual([])
})
it.fails('stays silent in a plugin file, where a path resolves against the plugin', () => {
  expect(ids(lintPluginFile(NAME, stdio({ command: './server.js' })))).toEqual([])
})
it.fails('does not read a path under .claude/ or a map that is not an object', () => {
  expect(ids(lintProject(NAME, stdio({ command: './x' }), '.claude/.mcp.json'))).toEqual([])
  expect(ids(lintProject(NAME, '{"mcpServers": []}'))).toEqual([])
})
