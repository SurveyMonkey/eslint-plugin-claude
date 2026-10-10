// `.lsp.json` at a plugin root maps a server name to a config, with no wrapper. A config is a
// strict object with the fields of the `lspServers` table of the plugins reference. When any
// entry is invalid, Claude Code skips the whole file. `claude plugin validate` does not read the
// file ("LSP servers" in the components page). The files glob is in tests/configs.test.ts.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('lsp-json-schema')

// The plugin root, and the `.lsp.json` in it.
const root = repo({ '.claude-plugin/plugin.json': '{"name": "p"}' })
const file = path.join(root, '.lsp.json')
// A directory with no plugin manifest.
const plain = path.join(repo({}), '.lsp.json')

const go = { command: 'gopls', extensionToLanguage: { '.go': 'go' } }
const lsp = (value: unknown) => JSON.stringify(value)
const one = (config: unknown) => lsp({ go: config })

jsonTester.run('lsp-json-schema (valid)', rule, {
  valid: [
    // The example of the components page, and the one of the plugins reference.
    {
      name: 'the example of the docs',
      code: lsp({
        go: { command: 'gopls', args: ['serve'], extensionToLanguage: { '.go': 'go' } },
      }),
      filename: file,
    },
    {
      name: 'every documented field',
      code: one({
        command: 'gopls',
        extensionToLanguage: { '.go': 'go', '.mod': 'go.mod' },
        args: ['serve', '-rpc.trace'],
        transport: 'stdio',
        env: { GOFLAGS: '-mod=mod' },
        initializationOptions: { staticcheck: true },
        settings: { gopls: { analyses: { unusedparams: true } } },
        workspaceFolder: '/work',
        startupTimeout: 10000,
        shutdownTimeout: 5000,
        requestTimeout: 60000,
        restartOnCrash: false,
        maxRestarts: 0,
        diagnostics: false,
      }),
      filename: file,
    },
    {
      name: 'two servers',
      code: lsp({ go: go, ts: { ...go, command: 'tsserver' } }),
      filename: file,
    },
    { name: 'no server', code: '{}', filename: file },
    // `socket` is valid here. `lsp-transport-socket` reports it.
    { name: 'transport socket', code: one({ ...go, transport: 'socket' }), filename: file },
    {
      name: 'an absolute command with a space',
      code: one({ ...go, command: '/opt/my tools/gopls' }),
      filename: file,
    },
    { name: 'a restart limit of zero', code: one({ ...go, maxRestarts: 0 }), filename: file },
    { name: 'empty env and args', code: one({ ...go, env: {}, args: [] }), filename: file },
    {
      name: 'initializationOptions and settings of any type',
      code: one({ ...go, initializationOptions: 1, settings: null }),
      filename: file,
    },
    // The file is not a plugin file, or the rule cannot see.
    { name: 'a file with no plugin manifest above', code: one({}), filename: plain },
    // Two members of one name. The rule reads the last.
    {
      name: 'duplicate server, the last is valid',
      code: `{"go": {}, "go": ${lsp(go)}}`,
      filename: file,
    },
    {
      name: 'duplicate field, the last is valid',
      code: '{"go": {"command": "gopls", "command": "gopls", "extensionToLanguage": {".go": "go", ".go": "go"}, "args": 1, "args": []}}',
      filename: file,
    },
  ],
  invalid: [],
})

jsonTester.run('lsp-json-schema (invalid)', rule, {
  valid: [],
  invalid: [
    // The top level.
    ...[
      ['an array', '[]'],
      ['a string', '"x"'],
      ['null', 'null'],
      ['a number', '1'],
    ].map(([name, code]) => ({
      name: `the file is ${name}`,
      code: code as string,
      filename: file,
      errors: [{ messageId: 'notObject' as const, line: 1, column: 1 }],
    })),
    // The config.
    ...[
      ['a string', '"gopls"'],
      ['an array', '[]'],
      ['null', 'null'],
    ].map(([name, config]) => ({
      name: `the config is ${name}`,
      code: `{"go": ${config}}`,
      filename: file,
      errors: [{ messageId: 'entryNotObject' as const, data: { server: 'go' }, column: 8 }],
    })),
    {
      name: 'a wrapper, as in plugin.json',
      code: lsp({ lspServers: { go } }),
      filename: file,
      errors: [
        { messageId: 'missing', data: { server: 'lspServers', key: 'command' } },
        { messageId: 'missing', data: { server: 'lspServers', key: 'extensionToLanguage' } },
        { messageId: 'unknownKey', data: { server: 'lspServers', key: 'go' } },
      ],
    },
    // The keys.
    {
      name: 'an unknown key, on the key',
      code: one({ ...go, timeout: 5 }),
      filename: file,
      errors: [
        { messageId: 'unknownKey', data: { server: 'go', key: 'timeout' }, line: 1, column: 61 },
      ],
    },
    {
      name: 'a key with another letter case',
      code: one({ ...go, Command: 'x' }),
      filename: file,
      errors: [{ messageId: 'unknownKey' }],
    },
    {
      name: 'no command, on the config',
      code: one({ extensionToLanguage: { '.go': 'go' } }),
      filename: file,
      errors: [
        { messageId: 'missing', data: { server: 'go', key: 'command' }, line: 1, column: 7 },
      ],
    },
    {
      name: 'no extensionToLanguage',
      code: one({ command: 'gopls' }),
      filename: file,
      errors: [{ messageId: 'missing', data: { server: 'go', key: 'extensionToLanguage' } }],
    },
    {
      name: 'an empty config',
      code: one({}),
      filename: file,
      errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
    },
    // The types.
    ...(
      [
        ['command', 1, 'a string'],
        ['extensionToLanguage', ['.go'], 'an object'],
        ['extensionToLanguage', '.go', 'an object'],
        ['args', 'serve', 'an array of strings'],
        ['args', ['serve', 1], 'an array of strings'],
        ['transport', 'tcp', 'stdio or socket'],
        ['transport', 1, 'stdio or socket'],
        ['transport', 'Stdio', 'stdio or socket'],
        ['env', { A: 1 }, 'an object of strings'],
        ['env', ['A=1'], 'an object of strings'],
        ['workspaceFolder', 1, 'a string'],
        ['startupTimeout', 0, 'a positive integer'],
        ['startupTimeout', -5, 'a positive integer'],
        ['startupTimeout', 1.5, 'a positive integer'],
        ['startupTimeout', '1000', 'a positive integer'],
        ['shutdownTimeout', 0, 'a positive integer'],
        ['requestTimeout', 0.5, 'a positive integer'],
        ['restartOnCrash', 'false', 'a Boolean'],
        ['diagnostics', 1, 'a Boolean'],
        ['maxRestarts', -1, 'an integer of zero or more'],
        ['maxRestarts', 2.5, 'an integer of zero or more'],
        ['maxRestarts', '3', 'an integer of zero or more'],
      ] as [string, unknown, string][]
    ).map(([key, value, expected]) => ({
      name: `${key} is ${JSON.stringify(value)}, on the value`,
      code: one({ ...go, [key]: value }),
      filename: file,
      errors: [{ messageId: 'valueType' as const, data: { server: 'go', key, expected } }],
    })),
    // The command.
    ...['gopls serve', 'gopls\tserve', ' gopls', 'gopls ', 'C:/tools/my gopls'].map((command) => ({
      name: `command "${command}", on the value`,
      code: one({ ...go, command }),
      filename: file,
      errors: [{ messageId: 'commandSpace' as const, data: { server: 'go' } }],
    })),
    // The extension map.
    {
      name: 'an empty extensionToLanguage',
      code: one({ command: 'gopls', extensionToLanguage: {} }),
      filename: file,
      errors: [{ messageId: 'emptyMap', data: { server: 'go' } }],
    },
    {
      name: 'an extension with no dot, on the key',
      code: one({ command: 'gopls', extensionToLanguage: { go: 'go', '.mod': 'go.mod' } }),
      filename: file,
      errors: [{ messageId: 'extensionKey', data: { server: 'go', extension: 'go' } }],
    },
    {
      name: 'a language ID that is not a string, on the value',
      code: one({ command: 'gopls', extensionToLanguage: { '.go': 1, '.mod': null } }),
      filename: file,
      errors: [
        { messageId: 'extensionValue', data: { server: 'go', extension: '.go' } },
        { messageId: 'extensionValue', data: { server: 'go', extension: '.mod' } },
      ],
    },
    // One report for each fault, in each server.
    {
      name: 'faults in two servers',
      code: lsp({ go: { ...go, command: 'go pls' }, ts: { ...go, requestTimeout: 0 } }),
      filename: file,
      errors: [
        { messageId: 'commandSpace', data: { server: 'go' } },
        {
          messageId: 'valueType',
          data: { server: 'ts', key: 'requestTimeout', expected: 'a positive integer' },
        },
      ],
    },
    // Two members of one name. The rule reads the last.
    {
      name: 'duplicate server, the last is invalid',
      code: `{"go": ${lsp(go)}, "go": {}}`,
      filename: file,
      errors: [{ messageId: 'missing' }, { messageId: 'missing' }],
    },
    {
      name: 'duplicate field, the last is invalid',
      code: '{"go": {"command": "gopls", "extensionToLanguage": {".go": "go", ".go": 1}, "args": [], "args": 1}}',
      filename: file,
      errors: [{ messageId: 'extensionValue' }, { messageId: 'valueType' }],
    },
  ],
})

describe('lsp-json-schema and the plugin root', () => {
  const messages = (code: string, filename: string) =>
    lintJson('lsp-json-schema', code, filename).map((m) => m.messageId)
  const bad = one({})

  it('reports in a plugin root in a nested directory', () => {
    const nested = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}' })
    expect(messages(bad, path.join(nested, 'plugins/p/.lsp.json'))).toHaveLength(2)
  })
  it('is silent where the manifest is in a parent directory only', () => {
    const nested = repo({ '.claude-plugin/plugin.json': '{}' })
    expect(messages(bad, path.join(nested, 'sub/.lsp.json'))).toEqual([])
  })
  it('is silent in a directory with an empty .claude-plugin', () => {
    const bare = repo({ '.claude-plugin/other.json': '{}' })
    expect(messages(bad, path.join(bare, '.lsp.json'))).toEqual([])
  })
  describe.skipIf(process.platform === 'win32')('a link', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'lsp-json-schema-'))
    afterAll(() => rmSync(scratch, { recursive: true, force: true }))
    it('reports when the .claude-plugin directory is a link inside the repository', () => {
      const linked = repo({ 'real/plugin.json': '{}' })
      symlinkSync('real', path.join(linked, '.claude-plugin'))
      expect(messages(bad, path.join(linked, '.lsp.json'))).toHaveLength(2)
    })
    it('is silent when .claude-plugin leads out of the repository', () => {
      const linked = repo({})
      mkdirSync(path.join(scratch, 'outside'), { recursive: true })
      symlinkSync(path.join(scratch, 'outside'), path.join(linked, '.claude-plugin'))
      expect(messages(bad, path.join(linked, '.lsp.json'))).toEqual([])
    })
  })
})
