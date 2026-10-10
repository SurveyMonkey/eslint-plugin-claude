// An unset variable with no default leaves the text `${VAR}` as written, and `claude mcp list`
// warns (MCP page, "Unset variables without a default"). The rule reads `command`, `args`, `env`,
// `url` and `headers`, where Claude Code expands references. It is a heuristic: a set variable is
// valid.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-env-var-default'
const at = (entry: unknown) => mapOf({ a: entry })
const ref = (name: string) => `\${${name}}`

it('reports a reference with no default, in each field that expands', () => {
  const text = `Bearer ${ref('API_KEY')}`
  expect(ids(lintProject(NAME, at({ command: ref('BIN') })))).toEqual(['noDefault'])
  expect(ids(lintProject(NAME, at({ command: 'x', args: ['-a', text] })))).toEqual(['noDefault'])
  expect(ids(lintProject(NAME, at({ command: 'x', env: { K: text } })))).toEqual(['noDefault'])
  expect(ids(lintProject(NAME, at({ type: 'http', url: `${ref('BASE')}/mcp` })))).toEqual([
    'noDefault',
  ])
  expect(
    ids(lintProject(NAME, at({ type: 'http', url: 'https://x.test', headers: { H: text } }))),
  ).toEqual(['noDefault'])
})
it('reports on the string, and the message names the variable, the field and the server', () => {
  const code = at({ command: 'x', args: ['--k', `Bearer ${ref('API_KEY')}`] })
  const found = lintProject(NAME, code)
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"Bearer') + 1 })
  expect(found[0]?.message).toContain(ref('API_KEY'))
  expect(found[0]?.message).toContain('`args`')
  expect(found[0]?.message).toContain('"a"')
})
it('says the risk, and does not call the form wrong', () => {
  const message = lintProject(NAME, at({ command: ref('BIN') }))[0]?.message ?? ''
  expect(message).toContain('unset')
  expect(message).not.toMatch(/invalid|wrong|not valid/i)
})
it('reports each variable of a string once, and each string', () => {
  const both = `${ref('A')} ${ref('B')} ${ref('A')}`
  expect(ids(lintProject(NAME, at({ command: both })))).toEqual(['noDefault', 'noDefault'])
  expect(ids(lintProject(NAME, at({ command: ref('A'), args: [ref('A')] })))).toEqual([
    'noDefault',
    'noDefault',
  ])
})
it('reports in a plugin file and in the servers of a manifest', () => {
  expect(ids(lintPluginFile(NAME, at({ command: ref('BIN') })))).toEqual(['noDefault'])
  const manifest = JSON.stringify({ name: 'p', mcpServers: { a: { command: ref('BIN') } } })
  expect(ids(lintManifest(NAME, manifest))).toEqual(['noDefault'])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  expect(ids(lintManifest(NAME, declared, { 'p/s.json': at({ command: ref('BIN') }) }))).toEqual([
    'noDefault',
  ])
})
it('reports a reference to a variable that is not a path variable of a plugin', () => {
  expect(ids(lintPluginFile(NAME, at({ command: 'x', env: { DB_URL: ref('DB_URL') } })))).toEqual([
    'noDefault',
  ])
})
it('reports the last of two members with one name', () => {
  const code = `{"mcpServers": {"a": {"command": "x", "command": "${ref('BIN')}"}}}`
  expect(ids(lintProject(NAME, code))).toEqual(['noDefault'])
  const silent = `{"mcpServers": {"a": {"command": "${ref('BIN')}", "command": "x"}}}`
  expect(ids(lintProject(NAME, silent))).toEqual([])
})

it('stays silent for a default, also an empty one', () => {
  for (const text of [`\${API_KEY:-x}`, `\${API_KEY:-}`, `a/\${API_KEY:-b}/c`]) {
    expect(
      ids(lintProject(NAME, at({ command: text, args: [text], env: { K: text } }))),
      text,
    ).toEqual([])
  }
})
it('stays silent for a reference inside a default', () => {
  const text = `\${A:-\${B}}`
  expect(ids(lintProject(NAME, at({ command: text })))).toEqual([])
})
it('stays silent for the variables that Claude Code sets', () => {
  for (const name of ['CLAUDE_PLUGIN_ROOT', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_PROJECT_DIR']) {
    const text = `${ref(name)}/bin/x`
    expect(ids(lintPluginFile(NAME, at({ command: text, env: { K: text } }))), name).toEqual([])
    expect(ids(lintProject(NAME, at({ command: text, args: [text] }))), name).toEqual([])
  }
})
it('stays silent for user_config references, which is no environment variable', () => {
  expect(
    ids(lintPluginFile(NAME, at({ command: 'x', args: [`\${user_config.api_key}`] }))),
  ).toEqual([])
})
it('stays silent for the forms that mcp-env-var-syntax owns', () => {
  for (const text of ['$HOME/x', '%HOME%/x', `\${VAR-x}`, `\${VAR:=x}`, '${VAR']) {
    expect(ids(lintProject(NAME, at({ command: text }))), text).toEqual([])
  }
})
it('stays silent in a field where Claude Code expands nothing', () => {
  const entry = {
    type: 'http',
    url: 'https://x.test',
    headersHelper: ref('HELPER'),
    oauth: { clientId: ref('ID') },
    timeout: ref('T'),
  }
  expect(ids(lintProject(NAME, at(entry)))).toEqual([])
})
it('stays silent for a credential variable in the url or headers of a remote server', () => {
  // `mcp-credential-var-remote` owns it. A default would not help, as the variable reads as empty.
  const entry = { type: 'http', url: `https://x.test/${ref('ANTHROPIC_API_KEY')}`, headers: {} }
  expect(ids(lintProject(NAME, at(entry)))).toEqual([])
  const header = { type: 'sse', url: 'https://x.test', headers: { A: ref('NPM_TOKEN') } }
  expect(ids(lintProject(NAME, at(header)))).toEqual([])
})
it('reads a credential variable of a stdio server as any other variable', () => {
  const entry = { command: 'x', env: { A: ref('ANTHROPIC_API_KEY') } }
  expect(ids(lintProject(NAME, at(entry)))).toEqual(['noDefault'])
})
it('reports a credential variable in a field other than the url and headers of a remote server', () => {
  const entry = { type: 'http', url: 'https://x.test', env: { A: ref('ANTHROPIC_API_KEY') } }
  expect(ids(lintProject(NAME, at(entry)))).toEqual(['noDefault'])
})
it('reports a credential variable in the url and headers of a server that is not remote', () => {
  const entry = { type: 'stdio', command: 'x', headers: { A: ref('NPM_TOKEN') } }
  expect(ids(lintProject(NAME, at(entry)))).toEqual(['noDefault'])
})
it('stays silent for a malformed entry and a file that is not a server map', () => {
  expect(ids(lintProject(NAME, at(ref('A'))))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: 1, args: 'x', env: [], headers: 'x' })))).toEqual([])
  expect(ids(lintProject(NAME, at({ env: { K: 1 } })))).toEqual([])
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
})
it('stays silent for a path that Claude Code skips', () => {
  expect(ids(lintProject(NAME, at({ command: ref('A') }), '.claude/mcp.json'))).toEqual([])
})
it('reports a server of a declared file on the path in the manifest', () => {
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  const found = lintManifest(NAME, declared, { 'p/s.json': at({ command: ref('BIN') }) })
  expect(found[0]).toMatchObject({ line: 1, column: declared.indexOf('"./s.json"') + 1 })
})
it('reads the last of two members with one name inside env and headers', () => {
  const entry = (first: string, second: string) =>
    `{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "env": {"K": "${first}", "K": "${second}"}, "headers": {"H": "${first}", "H": "${second}"}}}}`
  expect(ids(lintProject(NAME, entry(ref('A'), 'x')))).toEqual([])
  expect(ids(lintProject(NAME, entry('x', ref('A'))))).toEqual(['noDefault', 'noDefault'])
})
it('reports a credential variable in the url of an entry with no type', () => {
  expect(ids(lintProject(NAME, at({ url: `https://x.test/${ref('ANTHROPIC_API_KEY')}` })))).toEqual(
    ['noDefault'],
  )
})
