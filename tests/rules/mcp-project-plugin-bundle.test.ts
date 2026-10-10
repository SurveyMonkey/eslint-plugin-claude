// Claude Code skips an MCP server that a plugin under `.claude/skills/` declares as an MCP
// bundle. The loading page says so in "Plugins shared through a repository". The files glob is in
// tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-project-plugin-bundle')

const manifest = '.claude/skills/p/.claude-plugin/plugin.json'
const plugin = (mcpServers: unknown) => JSON.stringify({ name: 'p', mcpServers })

jsonTester.run('mcp-project-plugin-bundle (valid)', rule, {
  valid: [
    { name: 'no mcpServers', code: JSON.stringify({ name: 'p' }), filename: manifest },
    { name: 'array body', code: '[]', filename: manifest },
    { name: 'a json file', code: plugin('./mcp/servers.json'), filename: manifest },
    { name: 'an inline map', code: plugin({ db: { command: 'node' } }), filename: manifest },
    {
      name: 'an inline map named like a bundle',
      code: plugin({ 'a.mcpb': { command: 'node' } }),
      filename: manifest,
    },
    { name: 'an empty array', code: plugin([]), filename: manifest },
    {
      name: 'an array of a file and a map',
      code: plugin(['./a.json', { db: { command: 'node' } }]),
      filename: manifest,
    },
    // A value that is no string, no array and no map.
    { name: 'a number', code: plugin(1), filename: manifest },
    { name: 'null', code: plugin(null), filename: manifest },
    { name: 'an array with a number', code: plugin([1, null]), filename: manifest },
    // The extension decides. A near miss is no bundle.
    { name: 'a name that holds mcpb', code: plugin('./mcpb/servers.json'), filename: manifest },
    { name: 'mcpb without a dot', code: plugin('./servers-mcpb'), filename: manifest },
    { name: 'dxt without a dot', code: plugin('./dxt'), filename: manifest },
    { name: 'an extension in the middle', code: plugin('./a.mcpb.json'), filename: manifest },
    { name: 'an upper case extension', code: plugin('./a.MCPB'), filename: manifest },
    {
      name: 'a bundle extension in the query',
      code: plugin('https://x.test/a.json?f=a.mcpb'),
      filename: manifest,
    },
    {
      name: 'a bundle extension in the fragment',
      code: plugin('https://x.test/a.json#a.dxt'),
      filename: manifest,
    },
    { name: 'a path with a query', code: plugin('./a.mcpb?x=1'), filename: manifest },
    // A path that leaves the plugin directory fails `claude plugin validate`.
    {
      name: 'a path out of the plugin',
      code: plugin('../shared/servers.json'),
      filename: manifest,
    },
    { name: 'an absolute path', code: plugin('/opt/servers.json'), filename: manifest },
    // The last of two keys counts.
    {
      name: 'duplicate key, the last is a json file',
      code: '{"mcpServers": "./a.mcpb", "mcpServers": "./a.json"}',
      filename: manifest,
    },
    // Another plugin.json field is not read.
    {
      name: 'a bundle in another field',
      code: JSON.stringify({ name: 'p', skills: './a.mcpb', lspServers: './b.dxt' }),
      filename: manifest,
    },
  ],
  invalid: [],
})

jsonTester.run('mcp-project-plugin-bundle (invalid)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a mcpb path, with the position of the value',
      code: plugin('./server.mcpb'),
      filename: manifest,
      errors: [
        {
          messageId: 'skipped',
          data: { bundle: './server.mcpb' },
          line: 1,
          column: 26,
          endColumn: 41,
        },
      ],
    },
    {
      name: 'a dxt path',
      code: plugin('./server.dxt'),
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: './server.dxt' } }],
    },
    {
      name: 'a bundle URL',
      code: plugin('https://example.com/server.mcpb'),
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: 'https://example.com/server.mcpb' } }],
    },
    {
      name: 'a bundle URL with a query',
      code: plugin('https://example.com/server.dxt?v=2#top'),
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
    {
      name: 'a bundle in an array, with a file and a map',
      code: plugin(['./a.json', './b.mcpb', { db: { command: 'node' } }, './c.dxt']),
      filename: manifest,
      errors: [
        { messageId: 'skipped', data: { bundle: './b.mcpb' } },
        { messageId: 'skipped', data: { bundle: './c.dxt' } },
      ],
    },
    {
      name: 'a bundle outside the plugin',
      code: plugin('../shared/server.mcpb'),
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
    {
      name: 'duplicate key, the last is a bundle',
      code: '{"mcpServers": "./a.json", "mcpServers": "./a.mcpb"}',
      filename: manifest,
      errors: [{ messageId: 'skipped', data: { bundle: './a.mcpb' } }],
    },
    {
      name: 'a nested directory',
      code: plugin('./a.mcpb'),
      filename: 'packages/app/.claude/skills/p/.claude-plugin/plugin.json',
      errors: [{ messageId: 'skipped' }],
    },
  ],
})

json5Tester.run('mcp-project-plugin-bundle (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ mcpServers: './a.mcpb' }",
      filename: manifest,
      errors: [{ messageId: 'skipped' }],
    },
  ],
})

// The text of the message.
jsonTester.run('mcp-project-plugin-bundle (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: plugin('./a.mcpb'),
      filename: manifest,
      errors: [
        {
          message:
            'Claude Code skips the MCP bundle "./a.mcpb" in a plugin under .claude/skills/. Declare the server inline, or in a .mcp.json inside the plugin directory.',
        },
      ],
    },
  ],
})
