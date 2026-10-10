// A `serverUrl` or `serverCommand` policy entry expands `${VAR}` from a pinned environment before
// the match. An allowlist entry whose expansion changes the scope is ignored, so the entry needs
// literal values (managed MCP page, "Environment variables in serverCommand and serverUrl
// entries"). `mcp-managed-servers-entry` reports `${VAR}` in `managedMcpServers`, a key that this
// rule does not read. `mcp-policy-entry-schema` reports an invalid entry.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-policy-literal-values'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/20-b.json'
const allow = (...entries: unknown[]) => JSON.stringify({ allowedMcpServers: entries })
const deny = (...entries: unknown[]) => JSON.stringify({ deniedMcpServers: entries })

const lint = (code: string, file = managed) => lintJson(NAME, code, path.join(repo({}), file))
const run = (code: string, file = managed) => lint(code, file).map((m) => m.messageId)

it.fails('reports a variable in a serverUrl, on the value', () => {
  const found = lint(allow({ serverUrl: `https://\${HOST}/*` }))
  expect(found.map((m) => m.messageId)).toEqual(['variable'])
  expect(found[0]).toMatchObject({ line: 1, column: 36, endColumn: 55 })
  expect(found[0]?.message).toContain(`\${HOST}`)
})
it.fails('reports a variable in a serverCommand, on the array', () => {
  const found = lint(allow({ serverCommand: [`\${HOME}/bin/server`, '--x'] }))
  expect(found.map((m) => m.messageId)).toEqual(['variable'])
  expect(found[0]?.message).toContain(`\${HOME}`)
})
it.fails('reports a variable with a default, in the denylist and in a drop-in', () => {
  expect(run(deny({ serverUrl: `https://\${HOST:-x.test}/*` }))).toEqual(['variable'])
  expect(run(allow({ serverUrl: `\${SCHEME}://x.test` }), dropIn)).toEqual(['variable'])
})
it.fails('reports one time for each entry, and for each entry', () => {
  expect(run(allow({ serverUrl: `\${A}/\${B}` }))).toEqual(['variable'])
  expect(run(allow({ serverCommand: [`\${A}`, `\${B}`] }))).toEqual(['variable'])
  const two = allow(
    { serverUrl: `\${A}` },
    { serverCommand: [`\${B}`] },
    { serverUrl: 'https://x.test' },
  )
  expect(run(two)).toEqual(['variable', 'variable'])
})
it.fails('stays silent for literal values', () => {
  const literal = [
    { serverUrl: 'https://mcp.example.com/*' },
    { serverCommand: ['npx', '-y', 'x'] },
  ]
  expect(run(allow(...literal))).toEqual([])
  const dollar = [
    { serverUrl: 'https://x.test/$HOME' },
    { serverCommand: ['$HOME', '{HOME}', '$'] },
  ]
  expect(run(allow(...dollar))).toEqual([])
})
it.fails('stays silent for a serverName, which never expands', () => {
  expect(run(allow({ serverName: `\${HOST}` }))).toEqual([])
  expect(run(deny({ serverName: `\${HOST}` }))).toEqual([])
})
it.fails('leaves an invalid entry to mcp-policy-entry-schema', () => {
  for (const entry of [
    { serverUrl: 1 },
    { serverCommand: `npx \${X}` },
    { serverCommand: [`\${X}`, 1] },
    { serverUrl: `\${X}`, serverName: 'a' },
    {},
    null,
    `\${X}`,
    [`\${X}`],
  ]) {
    expect(run(allow(entry))).toEqual([])
  }
})
it.fails('does not read other keys, such as managedMcpServers', () => {
  const code = JSON.stringify({
    managedMcpServers: { a: { type: 'http', url: `https://\${H}/mcp` } },
  })
  expect(run(code)).toEqual([])
  expect(run(JSON.stringify({ allowedMcpServers: { serverUrl: `\${X}` } }))).toEqual([])
  expect(run(JSON.stringify({ model: 'x' }))).toEqual([])
  expect(run('[]')).toEqual([])
})
it.fails('reads the last list and the last key of an entry', () => {
  const lists = `{"allowedMcpServers": [{"serverUrl": "\${X}"}], "allowedMcpServers": []}`
  expect(run(lists)).toEqual([])
  const first = `{"allowedMcpServers": [{"serverUrl": "\${X}", "serverUrl": "https://x.test"}]}`
  expect(run(first)).toEqual([])
  const last = `{"allowedMcpServers": [{"serverUrl": "https://x.test", "serverUrl": "\${X}"}]}`
  expect(run(last)).toEqual(['variable'])
})
it.fails('skips a hidden drop-in', () => {
  expect(run(allow({ serverUrl: `\${X}` }), 'managed-settings.d/.10-a.json')).toEqual([])
})
