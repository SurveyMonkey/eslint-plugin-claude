// A channel is an MCP server that Claude Code starts as a subprocess and talks to over stdio
// (channels reference, "Overview" and "What you need"). The rule reports a channel whose `server`
// names a remote server, one with a `url` and no `command`. It reads the servers in the inline
// `mcpServers` of the manifest and in the `.mcp.json` of the plugin root. A later declaration
// replaces an earlier one, and the manifest comes after `.mcp.json` (manifest reference,
// "mcpServers"). The trees are on disk. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-channel-server-stdio'
const check = it.fails
const linked = noLinks ? it.skip : check

const REMOTE = { url: 'https://chat.example.com/mcp' }
const STDIO = { command: 'node', args: ['server.js'] }
const CHANNELS = [{ server: 'tg' }]

const run = (fields: Record<string, unknown>, files: Record<string, string> = {}) => {
  const { dir, code } = pluginTree({ name: 'p', channels: CHANNELS, ...fields }, files)
  return lintPlugin(RULE, dir, code)
}
const mcp = (servers: unknown) => JSON.stringify({ mcpServers: servers })

describe(RULE, () => {
  check('reports the server string of the channel, with the full message', () => {
    const found = run({ mcpServers: { tg: REMOTE } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'remote',
      message:
        'The channel binds to the server "tg", which is a remote server with a `url`. Claude Code starts a channel server as a subprocess and talks to it over stdio. Declare the server with `command`.',
      line: 1,
    })
  })

  check('reports a server in the .mcp.json of the plugin root', () => {
    expect(run({}, { '.mcp.json': mcp({ tg: REMOTE }) })).toHaveLength(1)
  })

  check('reads a .mcp.json with no mcpServers wrapper', () => {
    expect(run({}, { '.mcp.json': JSON.stringify({ tg: REMOTE }) })).toHaveLength(1)
  })

  check('lets a manifest server replace the one of .mcp.json', () => {
    expect(run({ mcpServers: { tg: REMOTE } }, { '.mcp.json': mcp({ tg: STDIO }) })).toHaveLength(1)
  })

  check('reads an inline server in an array', () => {
    expect(run({ mcpServers: [{ other: STDIO }, { tg: REMOTE }] })).toHaveLength(1)
  })

  check('reports each channel', () => {
    const channels = [{ server: 'tg' }, { server: 'sl' }]
    expect(run({ channels, mcpServers: { tg: REMOTE, sl: REMOTE } })).toHaveLength(2)
  })

  linked('reports a .mcp.json that is a link to a file in the plugin', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', channels: CHANNELS },
      { 'cfg/m.json': mcp({ tg: REMOTE }) },
    )
    link(top, '.mcp.json', 'cfg/m.json')
    expect(lintPlugin(RULE, dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check('stays silent for a stdio server', () => {
    expect(run({ mcpServers: { tg: STDIO } })).toEqual([])
  })

  check('stays silent for a stdio server in .mcp.json', () => {
    expect(run({}, { '.mcp.json': mcp({ tg: STDIO }) })).toEqual([])
  })

  check('stays silent when the manifest server replaces a remote one of .mcp.json', () => {
    expect(run({ mcpServers: { tg: STDIO } }, { '.mcp.json': mcp({ tg: REMOTE }) })).toEqual([])
  })

  check('stays silent for a server with a command and a url', () => {
    expect(run({ mcpServers: { tg: { ...STDIO, ...REMOTE } } })).toEqual([])
  })

  check('stays silent for a server with neither', () => {
    expect(run({ mcpServers: { tg: {} } })).toEqual([])
  })

  check('stays silent when a later file may replace the server', () => {
    expect(run({ mcpServers: [{ tg: REMOTE }, './more.json'] })).toEqual([])
  })

  check('stays silent when a later inline server replaces a remote one', () => {
    expect(
      run({ mcpServers: ['./more.json', { tg: STDIO }] }, { '.mcp.json': mcp({ tg: REMOTE }) }),
    ).toEqual([])
  })

  check('stays silent when the manifest names a file, even with a remote .mcp.json', () => {
    expect(run({ mcpServers: './more.json' }, { '.mcp.json': mcp({ tg: REMOTE }) })).toEqual([])
  })

  check('stays silent when no declaration has the server', () => {
    expect(run({ mcpServers: { other: REMOTE } }, { '.mcp.json': mcp({ x: REMOTE }) })).toEqual([])
    expect(run({})).toEqual([])
  })

  check.each([
    ['a .mcp.json that does not parse', '{'],
    ['a .mcp.json that is an array', '[]'],
    ['a .mcp.json with a server that is not an object', mcp({ tg: 'x' })],
  ])('stays silent for %s', (_title, text) => {
    expect(run({}, { '.mcp.json': text })).toEqual([])
  })

  check.each([
    ['no server member', [{}]],
    ['a server that is not a string', [{ server: 5 }]],
    ['a channel that is not an object', ['tg']],
    ['channels that is not an array', { server: 'tg' }],
  ])('stays silent for a channel with %s', (_title, channels) => {
    expect(run({ channels, mcpServers: { tg: REMOTE } })).toEqual([])
  })

  linked('stays silent for a .mcp.json link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p', channels: CHANNELS })
    link(top, '.mcp.json', 'ghost.json')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a .mcp.json link that leaves the plugin', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', channels: CHANNELS },
      { 'shared/m.json': mcp({ tg: REMOTE }) },
      'plugins/p/',
    )
    link(top, 'plugins/p/.mcp.json', '../../shared/m.json')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const { dir } = pluginTree('{')
    expect(
      lintPlugin(RULE, dir, '{"channels": [{"server": "tg"}], "mcpServers": {"tg": {"url": "u"}}}'),
    ).toEqual([])
  })
})
