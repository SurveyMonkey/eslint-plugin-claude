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

it('reports http:// and ws:// to a host that is not loopback, on the url', () => {
  const found = lintProject(NAME, at('http://example.com/mcp'))
  expect(ids(found)).toEqual(['insecure'])
  expect(found[0]).toMatchObject({ line: 1, column: 41, endColumn: 65 })
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('example.com')
  expect(ids(lintProject(NAME, at('ws://example.com/socket', 'ws')))).toEqual(['insecure'])
  expect(ids(lintProject(NAME, at('http://10.0.0.5:8080/mcp', 'sse')))).toEqual(['insecure'])
  expect(ids(lintProject(NAME, at('HTTP://Example.COM./mcp', 'streamable-http')))).toEqual([
    'insecure',
  ])
})
it('names the host and the scheme in the message, without the port or the trailing dot', () => {
  const http = lintProject(NAME, at('http://Example.COM.:8080/mcp'))[0]?.message
  expect(http).toContain('connects to example.com over http://. The traffic goes in clear text.')
  const ws = lintProject(NAME, at('ws://b.test/socket', 'ws'))[0]?.message
  expect(ws).toContain('connects to b.test over ws://.')
})
it('reports a host that only looks like loopback', () => {
  for (const url of [
    'http://127.0.0.1.evil.test/mcp',
    'http://localhost.evil.test/mcp',
    'http://128.0.0.1/mcp',
    'http://[::2]/mcp',
  ]) {
    expect(ids(lintProject(NAME, at(url)))).toEqual(['insecure'])
  }
})
it('reports a host with a variable only in the port, also without a path', () => {
  expect(ids(lintProject(NAME, at(`http://example.com:\${PORT}/mcp`)))).toEqual(['insecure'])
  expect(ids(lintProject(NAME, at(`http://example.com:\${PORT}`)))).toEqual(['insecure'])
})
it('reports each server', () => {
  const both = mapOf({
    a: { type: 'http', url: 'http://a.test' },
    b: { type: 'ws', url: 'ws://b.test' },
    c: { type: 'http', url: 'https://c.test' },
  })
  expect(ids(lintProject(NAME, both))).toEqual(['insecure', 'insecure'])
})
it('stays silent for https://, wss:// and loopback hosts', () => {
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
it('stays silent when a variable hides the host or the scheme', () => {
  for (const url of [
    `http://\${HOST}/mcp`,
    `\${URL}`,
    `\${SCHEME}://example.com`,
    `http://x.\${D}`,
  ]) {
    expect(ids(lintProject(NAME, at(url)))).toEqual([])
  }
})
it('stays silent for a url that does not parse, and for other schemes', () => {
  for (const url of ['', 'example.com', 'http://', 'ftp://example.com', 'http://exa mple.com']) {
    expect(ids(lintProject(NAME, at(url)))).toEqual([])
  }
})
it('stays silent for a url that is not a string, and for a server that is not remote', () => {
  expect(ids(lintProject(NAME, at(1)))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { type: 'http' } })))).toEqual([])
  expect(ids(lintProject(NAME, at('http://example.com', 'stdio')))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { url: 'http://example.com' } })))).toEqual([])
  expect(ids(lintProject(NAME, mapOf({ a: { type: 1, url: 'http://example.com' } })))).toEqual([])
})
it('reads the last url member', () => {
  const first =
    '{"mcpServers": {"a": {"type": "http", "url": "http://x.test", "url": "https://x.test"}}}'
  expect(ids(lintProject(NAME, first))).toEqual([])
  const last =
    '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "url": "http://x.test"}}}'
  expect(ids(lintProject(NAME, last))).toEqual(['insecure'])
})
it('leaves plugin configs to claude plugin validate', () => {
  expect(ids(lintPluginFile(NAME, at('http://example.com')))).toEqual([])
  const manifest = JSON.stringify({
    name: 'p',
    mcpServers: { b: { type: 'http', url: 'http://example.com' } },
  })
  expect(ids(lintManifest(NAME, manifest))).toEqual([])
})
it('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, at('http://example.com'), '.claude/.mcp.json'))).toEqual([])
})
