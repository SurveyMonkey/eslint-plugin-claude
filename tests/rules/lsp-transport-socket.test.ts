// The plugins reference says that Claude Code accepts `socket` for `transport`, but runs every
// LSP server over stdio. `claude plugin validate` accepts the value too. The rule reads
// `.lsp.json` at a plugin root and the inline `lspServers` of `plugin.json`. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('lsp-transport-socket')

const root = repo({ '.claude-plugin/plugin.json': '{"name": "p"}' })
const file = path.join(root, '.lsp.json')
const plain = path.join(repo({}), '.lsp.json')
const manifest = '.claude-plugin/plugin.json'

const go = { command: 'gopls', extensionToLanguage: { '.go': 'go' } }
const socket = { ...go, transport: 'socket' }
const lsp = (value: unknown) => JSON.stringify(value)
const inline = (lspServers: unknown) => JSON.stringify({ name: 'p', lspServers })

jsonTester.run('lsp-transport-socket (valid)', rule, {
  valid: [
    { name: 'transport stdio', code: lsp({ go: { ...go, transport: 'stdio' } }), filename: file },
    { name: 'no transport', code: lsp({ go }), filename: file },
    // Another value is a fault of the schema rule, not of this one.
    { name: 'another transport', code: lsp({ go: { ...go, transport: 'tcp' } }), filename: file },
    {
      name: 'transport that is not a string',
      code: lsp({ go: { ...go, transport: 1 } }),
      filename: file,
    },
    { name: 'a capital letter', code: lsp({ go: { ...go, transport: 'Socket' } }), filename: file },
    { name: 'a config that is not an object', code: lsp({ go: 'socket' }), filename: file },
    { name: 'array body', code: '[]', filename: file },
    { name: 'no server', code: '{}', filename: file },
    { name: 'a file with no plugin manifest above', code: lsp({ go: socket }), filename: plain },
    // Two members of one name. The rule reads the last.
    {
      name: 'duplicate server, the last is stdio',
      code: `{"go": ${lsp(socket)}, "go": ${lsp(go)}}`,
      filename: file,
    },
    {
      name: 'duplicate transport, the last is stdio',
      code: '{"go": {"transport": "socket", "transport": "stdio"}}',
      filename: file,
    },
    // The manifest.
    {
      name: 'inline transport stdio',
      code: inline({ go: { ...go, transport: 'stdio' } }),
      filename: manifest,
    },
    { name: 'no lspServers', code: JSON.stringify({ name: 'p' }), filename: manifest },
    { name: 'lspServers as a path', code: inline('./lsp.json'), filename: manifest },
    { name: 'lspServers as a number', code: inline(1), filename: manifest },
    { name: 'an array of paths', code: inline(['./a.json', './b.json']), filename: manifest },
    { name: 'a map in the array without socket', code: inline([{ go }]), filename: manifest },
    { name: 'a manifest that is an array', code: '[]', filename: manifest },
    {
      name: 'transport outside lspServers',
      code: JSON.stringify({ transport: 'socket' }),
      filename: manifest,
    },
    {
      name: 'duplicate lspServers, the last is a path',
      code: `{"lspServers": {"go": ${lsp(socket)}}, "lspServers": "./lsp.json"}`,
      filename: manifest,
    },
  ],
  invalid: [],
})

jsonTester.run('lsp-transport-socket (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: '.lsp.json, on the value',
      code: lsp({ go: socket }),
      filename: file,
      errors: [{ messageId: 'socket', data: { server: 'go' }, line: 1, column: 73, endColumn: 81 }],
    },
    {
      name: 'one report for each server',
      code: lsp({ go: socket, ts: { ...go, transport: 'stdio' }, rs: socket }),
      filename: file,
      errors: [
        { messageId: 'socket', data: { server: 'go' } },
        { messageId: 'socket', data: { server: 'rs' } },
      ],
    },
    {
      name: 'duplicate server, the last is socket',
      code: `{"go": ${lsp(go)}, "go": ${lsp(socket)}}`,
      filename: file,
      errors: [{ messageId: 'socket' }],
    },
    {
      name: 'duplicate transport, the last is socket',
      code: '{"go": {"transport": "stdio", "transport": "socket"}}',
      filename: file,
      errors: [{ messageId: 'socket', column: 44 }],
    },
    // The manifest.
    {
      name: 'an inline map in plugin.json',
      code: inline({ go: socket }),
      filename: manifest,
      errors: [{ messageId: 'socket', data: { server: 'go' } }],
    },
    {
      name: 'an array of inline maps and paths in plugin.json',
      code: inline(['./a.json', { go: socket }, { ts: socket, rs: go }, 1]),
      filename: manifest,
      errors: [
        { messageId: 'socket', data: { server: 'go' } },
        { messageId: 'socket', data: { server: 'ts' } },
      ],
    },
    {
      name: 'duplicate lspServers, the last is a map',
      code: `{"lspServers": "./lsp.json", "lspServers": {"go": ${lsp(socket)}}}`,
      filename: manifest,
      errors: [{ messageId: 'socket' }],
    },
  ],
})

describe('lsp-transport-socket and the plugin root', () => {
  const messages = (code: string, filename: string) =>
    lintJson('lsp-transport-socket', code, filename).map((m) => m.messageId)

  it('reports in a plugin root in a nested directory', () => {
    const nested = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}' })
    expect(messages(lsp({ go: socket }), path.join(nested, 'plugins/p/.lsp.json'))).toEqual([
      'socket',
    ])
  })
  it('is silent where the manifest is in a parent directory only', () => {
    const nested = repo({ '.claude-plugin/plugin.json': '{}' })
    expect(messages(lsp({ go: socket }), path.join(nested, 'sub/.lsp.json'))).toEqual([])
  })
  it('reports in a plugin.json whatever the directory', () => {
    expect(
      messages(inline({ go: socket }), path.join(repo({}), 'x/.claude-plugin/plugin.json')),
    ).toEqual(['socket'])
  })
})
