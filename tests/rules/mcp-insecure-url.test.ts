// A plain `http://` or `ws://` URL to a host that is not on the machine sends the traffic in
// clear text. `claude plugin validate` warns for plugin MCP configs (manifest reference,
// "Validate the manifest"). The rule reads the project `.mcp.json` only.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-insecure-url'
const at = (url: unknown, type = 'http') => mapOf({ a: { type, url } })

it.fails('reports http:// and ws:// to a host that is not loopback, on the url', () => {
  const found = lintProject(NAME, at('http://example.com/mcp'))
  expect(ids(found)).toEqual(['insecure'])
  expect(found[0]).toMatchObject({ line: 1, column: 49, endColumn: 71 })
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('example.com')
  expect(ids(lintProject(NAME, at('ws://example.com/socket', 'ws')))).toEqual(['insecure'])
  expect(ids(lintProject(NAME, at('http://10.0.0.5:8080/mcp', 'sse')))).toEqual(['insecure'])
  expect(ids(lintProject(NAME, at('HTTP://Example.COM./mcp', 'streamable-http')))).toEqual([
    'insecure',
  ])
})
it.fails('reports a host with a variable only in the port', () => {
  expect(ids(lintProject(NAME, at(`http://example.com:\${PORT}/mcp`)))).toEqual(['insecure'])
})
it.fails('reports each server', () => {
  const both = mapOf({
    a: { type: 'http', url: 'http://a.test' },
    b: { type: 'ws', url: 'ws://b.test' },
    c: { type: 'http', url: 'https://c.test' },
  })
  expect(ids(lintProject(NAME, both))).toEqual(['insecure', 'insecure'])
})
it.fails('stays silent for https://, wss:// and loopback hosts', () => {
  for (const url of [
    'https://example.com/mcp',
    'HTTPS://example.com/mcp',
    'wss://example.com/socket',
    'http://localhost:3000/mcp',
    'http://LOCALHOST/mcp',
    'http://localhost./mcp',
    'http://127.0.0.1:8080/mcp',
    'http://127.1.2.3/mcp',
    'http://[::1]:8080/mcp',
    'ws://localhost:9000',
  ]) {
    expect(ids(lintProject(NAME, at(url)))).toEqual([])
  }
})
it.fails('stays silent when a variable hides the host or the scheme', () => {
  for (const url of [
    `http://\${HOST}/mcp`,
    `\${URL}`,
    `\${SCHEME}://example.com`,
    `http://x.\${D}`,
  ]) {
    expect(ids(lintProject(NAME, at(url)))).toEqual([])
  }
})
it.fails('stays silent for a url that does not parse, and for other schemes', () => {
  for (const url of ['', 'example.com', 'http://', 'ftp://example.com', 'http://exa mple.com']) {
    expect(ids(lintProject(NAME, at(url)))).toEqual([])
  }
})
it.fails('stays silent for a url that is not a string, and for a server that is not remote', () => {
  expect(ids(lintProject(NAME, at(1)))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { type: 'http' } })))).toEqual([])
  expect(ids(lintProject(NAME, at('http://example.com', 'stdio')))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { url: 'http://example.com' } })))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { type: 1, url: 'http://example.com' } })))).toEqual([])
})
it.fails('reads the last url member', () => {
  const first =
    '{"mcpServers": {"a": {"type": "http", "url": "http://x.test", "url": "https://x.test"}}}'
  expect(ids(lintProject(NAME, first))).toEqual([])
  const last =
    '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "url": "http://x.test"}}}'
  expect(ids(lintProject(NAME, last))).toEqual(['insecure'])
})
it.fails('leaves plugin configs to claude plugin validate', () => {
  expect(ids(lintPluginFile(NAME, at('http://example.com')))).toEqual([])
  const manifest = JSON.stringify({
    name: 'p',
    mcpServers: { a: { type: 'http', url: 'http://x.test' } },
  })
  expect(ids(lintManifest(NAME, manifest))).toEqual([])
})
it.fails('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, at('http://example.com'), '.claude/.mcp.json'))).toEqual([])
})
