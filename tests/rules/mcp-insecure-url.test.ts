// A plain `http://` or `ws://` URL to a host that is not on the machine sends the traffic in
// clear text. `claude plugin validate` warns for plugin MCP configs (manifest reference,
// "Validate the manifest"). The rule reads the project `.mcp.json`, and the `.mcp.json` of a
// plugin with no manifest, which validate fails. It also reads each MCP bundle string of a plugin
// manifest. Validate passes an `http://` bundle URL.
import { expect, it } from 'vitest'
import {
  ids,
  lintListedPluginFile,
  lintManifest,
  lintPluginFile,
  lintProject,
  lintRootListedFile,
  lintRootPluginFile,
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
it('reports a server that follows each kind of skipped server', () => {
  const map = mapOf({
    a: { command: 'x' },
    b: { type: 'http', url: 'https://b.test' },
    c: { type: 'http', url: 'http://localhost' },
    d: { type: 'http', url: 'http://' },
    e: { type: 'http', url: `http://\${HOST}/mcp` },
    f: { type: 'http', url: 'http://f.test' },
  })
  const found = lintProject(NAME, map)
  expect(ids(found)).toEqual(['insecure'])
  expect(found[0]?.message).toContain('"f"')
})
it('reports a host with a variable only in the path', () => {
  expect(ids(lintProject(NAME, at(`http://example.com/\${P}`)))).toEqual(['insecure'])
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
it('reports in a plugin with no manifest, which claude plugin validate fails', () => {
  // `claude plugin validate` 2.1.302 on such a plugin: "No manifest found in directory". On the
  // marketplace, it does not read the `.mcp.json` of the plugin.
  expect(ids(lintListedPluginFile(NAME, at('http://example.com')))).toEqual(['insecure'])
  // A plugin `.mcp.json` can hold the servers with no `mcpServers` wrapper.
  const bare = JSON.stringify({ a: { type: 'http', url: 'http://example.com' } })
  expect(ids(lintListedPluginFile(NAME, bare))).toEqual(['insecure'])
})
it('does not read a path under .claude/', () => {
  expect(ids(lintProject(NAME, at('http://example.com'), '.claude/.mcp.json'))).toEqual([])
})
it('does not read the servers of a plugin.json outside .claude-plugin/', () => {
  expect(ids(lintProject(NAME, at('http://example.com'), 'p/plugin.json'))).toEqual([])
})
it('does not read the servers of another file of .claude-plugin/', () => {
  const path = '.claude-plugin/marketplace.json'
  expect(ids(lintProject(NAME, at('http://example.com'), path))).toEqual([])
})

const bundle = (declared: unknown) => JSON.stringify({ mcpServers: declared })

it('reports an http:// bundle URL in a plugin manifest, on the string', () => {
  const found = lintManifest(NAME, bundle('http://example.com/db.mcpb'))
  expect(ids(found)).toEqual(['insecureBundle'])
  expect(found[0]).toMatchObject({ line: 1, column: 15, endColumn: 43 })
  expect(found[0]?.message).toBe(
    'The MCP bundle URL points to example.com over http://, so a download of the bundle goes in clear text. Use a path inside the plugin or an https:// URL.',
  )
})
it('names the bundle host without the port, the trailing dot or the letter case', () => {
  const found = lintManifest(NAME, bundle('HTTP://Example.COM.:8080/db.mcpb'))
  expect(ids(found)).toEqual(['insecureBundle'])
  expect(found[0]?.message).toContain('points to example.com over http://,')
})
it('reports the http:// item of a bundle array once, and not the path item', () => {
  const found = lintManifest(NAME, bundle(['./servers/db.mcpb', 'http://example.com/db.mcpb']))
  expect(ids(found)).toEqual(['insecureBundle'])
  expect(found[0]).toMatchObject({ line: 1, column: 36, endColumn: 64 })
  const first = lintManifest(NAME, bundle(['http://a.test/db.mcpb', './servers/db.mcpb']))
  expect(ids(first)).toEqual(['insecureBundle'])
  expect(first[0]).toMatchObject({ line: 1, column: 16, endColumn: 39 })
})
it('reports a bundle URL that validate reads as an http:// URL', () => {
  // Validate 2.1.302 passes each one, so Claude Code reads it as a URL.
  const found = lintManifest(
    NAME,
    bundle(['http:///a.test/db.mcpb', 'http://127.0.0.1@b.test/db.mcpb', 'hTtP://c.test/db.mcpb']),
  )
  expect(found.map(({ message }) => message.split(' over ')[0])).toEqual([
    'The MCP bundle URL points to a.test',
    'The MCP bundle URL points to b.test',
    'The MCP bundle URL points to c.test',
  ])
})
it('reports the last mcpServers member of a manifest', () => {
  const last = '{"mcpServers": "https://x.test/db.mcpb", "mcpServers": "http://x.test/db.mcpb"}'
  expect(ids(lintManifest(NAME, last))).toEqual(['insecureBundle'])
  const first = '{"mcpServers": "http://x.test/db.mcpb", "mcpServers": "https://x.test/db.mcpb"}'
  expect(ids(lintManifest(NAME, first))).toEqual([])
})
it('stays silent for a bundle path, an https:// URL and a ws:// URL', () => {
  for (const declared of [
    './servers/db.mcpb',
    'servers/db.dxt',
    'https://example.com/db.mcpb',
    'ws://example.com/db.mcpb',
    'ftp://example.com/db.mcpb',
    'http://',
  ]) {
    expect(ids(lintManifest(NAME, bundle(declared)))).toEqual([])
  }
})
it('stays silent for a loopback bundle host and a bundle host with a variable', () => {
  for (const declared of [
    'http://localhost/db.mcpb',
    'http://127.0.0.1:8080/db.mcpb',
    'http://[::1]/db.mcpb',
    `http://\${HOST}/db.mcpb`,
  ]) {
    expect(ids(lintManifest(NAME, bundle(declared)))).toEqual([])
  }
})
it('stays silent for an empty, null, empty array or inline mcpServers in a manifest', () => {
  for (const declared of ['', null, [], {}, [{ a: { type: 'http', url: 'http://x.test' } }]]) {
    expect(ids(lintManifest(NAME, bundle(declared)))).toEqual([])
  }
  expect(ids(lintManifest(NAME, '{"name": "p"}'))).toEqual([])
})
it('stays silent for a string that validate reads as a path', () => {
  // Validate 2.1.302 fails each one with "Path not found". It says that the runtime loader reports
  // a load failure.
  for (const declared of [
    ' http://example.com/db.mcpb',
    '\thttp://example.com/db.mcpb',
    '\nhttp://example.com/db.mcpb',
    '\ufeffhttp://example.com/db.mcpb',
    '\u00a0http://example.com/db.mcpb',
    'ht\ttp://example.com/db.mcpb',
    'http:example.com/db.mcpb',
    'http:/example.com/db.mcpb',
    'http:\\\\example.com\\\\db.mcpb',
  ]) {
    expect(ids(lintManifest(NAME, bundle(declared)))).toEqual([])
  }
})
it('does not read a plugin.json outside .claude-plugin/', () => {
  expect(ids(lintProject(NAME, bundle('http://example.com/db.mcpb'), 'p/plugin.json'))).toEqual([])
})
it('does not read a bundle string in another file of .claude-plugin/', () => {
  const at = '.claude-plugin/marketplace.json'
  expect(ids(lintProject(NAME, bundle('http://example.com/db.mcpb'), at))).toEqual([])
})
it('does not read a bundle string in a project .mcp.json', () => {
  expect(ids(lintProject(NAME, bundle('http://example.com/db.mcpb')))).toEqual([])
})
it('stays silent for a plugin directly under .claude/skills/', () => {
  // Claude Code skips each bundle of such a plugin (plugins/loading).
  const at = '.claude/skills/p/.claude-plugin/plugin.json'
  expect(ids(lintProject(NAME, bundle('http://example.com/db.mcpb'), at))).toEqual([])
  const other = 'tools/skills/p/.claude-plugin/plugin.json'
  expect(ids(lintProject(NAME, bundle('http://example.com/db.mcpb'), other))).toEqual([
    'insecureBundle',
  ])
})
it('reports in the root file of a plugin repository with no manifest, which validate does not read', () => {
  expect(ids(lintRootListedFile(NAME, at('http://example.com/mcp')))).toEqual(['insecure'])
})
it('stays silent in the root file of a plugin repository with a manifest, which validate reads', () => {
  expect(ids(lintRootPluginFile(NAME, at('http://example.com/mcp')))).toEqual([])
})
