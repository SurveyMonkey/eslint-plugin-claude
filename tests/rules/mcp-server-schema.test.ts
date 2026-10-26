// Claude Code skips a server entry of `.mcp.json` that has a bad shape, and still loads the others.
// The rule reads each fault in a project `.mcp.json` and a committed `managed-mcp.json`.
// `claude plugin validate` 2.1.302 reports each fault in a plugin but one. In a plugin with a
// manifest, the rule reports that one fault only: a `url` with a `command` and no `type`. The files
// glob is in tests/configs.test.ts.
import path from 'node:path'
import { expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import {
  ids,
  lintListedPluginFile,
  lintManifest,
  lintPluginFile,
  lintProject,
  lintRootListedFile,
  lintRootPluginFile,
} from '../mcp-server-rule.test-support.ts'
import {
  chmodCannotBlock,
  jsonTester,
  lintJson,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const rule = ruleOf('mcp-server-schema')

const project = '.mcp.json'
const wrap = (entry: string) => `{"mcpServers": {"a": ${entry}}}`
/** The column of the first `text` in `code`, as ESLint counts it. */
const col = (code: string, text: string) => code.indexOf(text) + 1

/** A remote entry whose `url` is a number. */
const remoteNumber = wrap('{"type": "ws", "url": 2.5}')

const cases = {
  urlNoType: wrap('{"url": "https://x.test/mcp"}'),
  argsString: wrap('{"command": "npx", "args": "-y x"}'),
  argNumber: wrap('{"command": "npx", "args": ["-y", 3]}'),
  unknownType: wrap('{"type": "websocket", "url": "https://x.test/mcp"}'),
  invalidUrl: wrap('{"type": "http", "url": "not a url"}'),
  noUrl: wrap('{"type": "sse"}'),
  notObject: wrap('"npx -y x"'),
  commandNumber: wrap('{"command": 42}'),
  noCommand: wrap('{"args": ["-y"]}'),
  emptyCommand: wrap('{"command": ""}'),
  envType: wrap('{"command": "npx", "env": ["A=1"]}'),
  headersType: wrap('{"type": "http", "url": "https://x.test/mcp", "headers": "Authorization: x"}'),
  oauthType: wrap('{"type": "sse", "url": "https://x.test/mcp", "oauth": "x"}'),
}

jsonTester.run('mcp-server-schema (each fault in a project file)', rule, {
  valid: [],
  invalid: [
    {
      name: 'a url with no type, on the url value',
      code: cases.urlNoType,
      filename: project,
      errors: [
        {
          messageId: 'urlNoType',
          data: { server: 'a' },
          line: 1,
          column: col(cases.urlNoType, '"https'),
          endColumn: col(cases.urlNoType, '}}}'),
        },
      ],
    },
    {
      name: 'args as a string, on the args value',
      code: cases.argsString,
      filename: project,
      errors: [
        {
          messageId: 'argsType',
          data: { server: 'a' },
          column: col(cases.argsString, '"-y x"'),
          endColumn: col(cases.argsString, '}}}'),
        },
      ],
    },
    {
      name: 'an args item that is not a string, on the item',
      code: cases.argNumber,
      filename: project,
      errors: [
        {
          messageId: 'argType',
          data: { server: 'a' },
          column: col(cases.argNumber, '3]'),
          endColumn: col(cases.argNumber, ']}'),
        },
      ],
    },
    {
      name: 'an unknown type, on the type value',
      code: cases.unknownType,
      filename: project,
      errors: [
        {
          messageId: 'unknownType',
          data: { server: 'a' },
          column: col(cases.unknownType, '"websocket"'),
          endColumn: col(cases.unknownType, ', "url"'),
        },
      ],
    },
    {
      name: 'a remote url that is not a valid absolute URL, on the url value',
      code: cases.invalidUrl,
      filename: project,
      errors: [
        {
          messageId: 'invalidUrl',
          data: { server: 'a' },
          column: col(cases.invalidUrl, '"not'),
          endColumn: col(cases.invalidUrl, '}}}'),
        },
      ],
    },
    {
      name: 'a remote type with no url, on the type value',
      code: cases.noUrl,
      filename: project,
      errors: [
        {
          messageId: 'noUrl',
          data: { server: 'a' },
          column: col(cases.noUrl, '"sse"'),
          endColumn: col(cases.noUrl, '}}}'),
        },
      ],
    },
    {
      name: 'an entry that is not an object, on the entry',
      code: cases.notObject,
      filename: project,
      errors: [
        {
          messageId: 'notObject',
          data: { server: 'a' },
          column: col(cases.notObject, '"npx'),
          endColumn: col(cases.notObject, '}}'),
        },
      ],
    },
    {
      name: 'a command that is not a string, on the command value',
      code: cases.commandNumber,
      filename: project,
      errors: [
        {
          messageId: 'commandType',
          data: { server: 'a' },
          column: col(cases.commandNumber, '42'),
          endColumn: col(cases.commandNumber, '}}}'),
        },
      ],
    },
    {
      name: 'a stdio entry with no command, on the entry',
      code: cases.noCommand,
      filename: project,
      errors: [
        {
          messageId: 'noCommand',
          data: { server: 'a' },
          column: col(cases.noCommand, '{"args"'),
          endColumn: col(cases.noCommand, '}}') + 1,
        },
      ],
    },
    {
      name: 'an empty command, on the command value',
      code: cases.emptyCommand,
      filename: project,
      errors: [
        {
          messageId: 'emptyCommand',
          data: { server: 'a' },
          column: col(cases.emptyCommand, '""'),
          endColumn: col(cases.emptyCommand, '}}}'),
        },
      ],
    },
    {
      name: 'an env that is not an object, on the env value',
      code: cases.envType,
      filename: project,
      errors: [
        {
          messageId: 'envType',
          data: { server: 'a' },
          column: col(cases.envType, '["A=1"]'),
          endColumn: col(cases.envType, '}}}'),
        },
      ],
    },
    {
      name: 'a headers value that is not an object, on the headers value',
      code: cases.headersType,
      filename: project,
      errors: [
        {
          messageId: 'headersType',
          data: { server: 'a' },
          column: col(cases.headersType, '"Authorization'),
          endColumn: col(cases.headersType, '}}}'),
        },
      ],
    },
    {
      name: 'an oauth value that is not an object, on the oauth value',
      code: cases.oauthType,
      filename: project,
      errors: [
        {
          messageId: 'oauthType',
          data: { server: 'a' },
          column: col(cases.oauthType, '"x"'),
          endColumn: col(cases.oauthType, '}}}'),
        },
      ],
    },
  ],
})

jsonTester.run('mcp-server-schema (valid shapes)', rule, {
  valid: [
    {
      name: 'stdio, no type',
      code: wrap('{"command": "npx", "args": ["-y", "x"]}'),
      filename: project,
    },
    {
      name: 'stdio, with type',
      code: wrap('{"type": "stdio", "command": "npx"}'),
      filename: project,
    },
    { name: 'stdio, args empty', code: wrap('{"command": "npx", "args": []}'), filename: project },
    ...['http', 'streamable-http', 'sse'].map((type) => ({
      name: type,
      code: wrap(`{"type": "${type}", "url": "https://x.test/mcp"}`),
      filename: project,
    })),
    { name: 'ws', code: wrap('{"type": "ws", "url": "wss://x.test/ws"}'), filename: project },
    // Only an SDK host registers a `sdk` server. Claude Code skips it with its own message.
    { name: 'sdk', code: wrap('{"type": "sdk"}'), filename: project },
    { name: 'sdk with a url', code: wrap('{"type": "sdk", "url": "x"}'), filename: project },
    { name: 'empty mcpServers', code: '{"mcpServers": {}}', filename: project },
    // `mcp-json-servers-key` reports a file whose `mcpServers` is not an object, or is not there.
    ...['[]', 'null', '"x"', '1'].map((value) => ({
      name: `mcpServers ${value}`,
      code: `{"mcpServers": ${value}}`,
      filename: project,
    })),
    { name: 'a project file with no wrapper', code: '{"a": "npx"}', filename: project },
    { name: 'a top-level array', code: '[{"url": "x"}]', filename: project },
    // A stdio entry does not use `url`, so a `url` with `type: "stdio"` or a null `url` is silent.
    {
      name: 'stdio type with a url',
      code: wrap('{"type": "stdio", "command": "npx", "url": "x"}'),
      filename: project,
    },
    {
      name: 'a null url, no type',
      code: wrap('{"command": "npx", "url": null}'),
      filename: project,
    },
    // `mcp-remote-url-empty` reports an empty remote `url`.
    { name: 'an empty remote url', code: wrap('{"type": "http", "url": ""}'), filename: project },
    // A reference can expand to any text, so the rule does not parse a URL that holds one.
    ...[
      `\${MCP_URL}`,
      `\${MCP_URL:-https://x.test}`,
      `https://\${HOST}/mcp`,
      `http://localhost:\${PORT}/mcp`,
    ].map((url) => ({
      name: url,
      code: wrap(`{"type": "http", "url": "${url}"}`),
      filename: project,
    })),
    // `new URL` takes another scheme, and the edge spaces that `mcp-hidden-whitespace` reports.
    ...['ftp://x.test/mcp', 'mailto:a@x.test', ' https://x.test/mcp'].map((url) => ({
      name: url,
      code: wrap(`{"type": "http", "url": "${url}"}`),
      filename: project,
    })),
    // Of two members with one name, the last counts.
    {
      name: 'the last type',
      code: wrap('{"type": "bad", "type": "http", "url": "https://x.test"}'),
      filename: project,
    },
    {
      name: 'the last args',
      code: wrap('{"command": "x", "args": "y", "args": []}'),
      filename: project,
    },
    {
      name: 'the last command',
      code: wrap('{"command": 1, "command": "x"}'),
      filename: project,
    },
    {
      name: 'the last remote url',
      code: wrap('{"type": "http", "url": "bad", "url": "https://x.test"}'),
      filename: project,
    },
    {
      name: 'the last url, null, no type',
      code: wrap('{"command": "x", "url": "https://x.test", "url": null}'),
      filename: project,
    },
    // Claude Code 2.1.304 checks `env` in a stdio entry, and `headers` in a remote entry. It
    // checks `oauth` in an `http`, `streamable-http` or `sse` entry. It loads these entries.
    {
      name: 'a stdio env object',
      code: wrap('{"command": "x", "env": {}}'),
      filename: project,
    },
    {
      name: 'remote headers and oauth objects',
      code: wrap('{"type": "http", "url": "https://x.test", "headers": {}, "oauth": {}}'),
      filename: project,
    },
    {
      name: 'a stdio entry with headers and oauth that are not objects',
      code: wrap('{"command": "x", "headers": "x", "oauth": "x"}'),
      filename: project,
    },
    {
      name: 'a remote entry with an env that is not an object',
      code: wrap('{"type": "http", "url": "https://x.test", "env": ["A=1"]}'),
      filename: project,
    },
    {
      name: 'a ws entry with an oauth that is not an object',
      code: wrap('{"type": "ws", "url": "wss://x.test", "oauth": []}'),
      filename: project,
    },
    {
      name: 'a sdk entry with an env array',
      code: wrap('{"type": "sdk", "env": []}'),
      filename: project,
    },
    // `mcp-hidden-whitespace` reports a command of spaces. Claude Code loads it.
    { name: 'a command of one space', code: wrap('{"command": " "}'), filename: project },
    {
      name: 'the last env',
      code: wrap('{"command": "x", "env": [], "env": {}}'),
      filename: project,
    },
    // `mcp-json-servers-key` reports a `managed-mcp.json` with no wrapper.
    {
      name: 'a managed file with no wrapper',
      code: '{"a": {"url": "x"}}',
      filename: 'managed-mcp.json',
    },
    {
      name: 'the last entry',
      code: '{"mcpServers": {"a": 1, "a": {"command": "x"}}}',
      filename: project,
    },
  ],
  invalid: [],
})

/** An invalid case of one fault in a project file, with the message id and the server `a`. */
const one = (name: string, entry: string, messageId: string) => ({
  name,
  code: wrap(entry),
  filename: project,
  errors: [{ messageId, data: { server: 'a' } }],
})

jsonTester.run('mcp-server-schema (null, empty and wrong-type values)', rule, {
  valid: [],
  invalid: [
    ...['null', '[]', '1', 'true', '""'].map((entry) => one(`entry ${entry}`, entry, 'notObject')),
    one('an empty entry', '{}', 'noCommand'),
    ...['null', '1', '[]', '{}', 'true'].map((type) =>
      one(`type ${type}`, `{"type": ${type}, "command": "x"}`, 'unknownType'),
    ),
    ...['""', '"HTTP"', '"sse "', '"websocket"'].map((type) =>
      one(`type ${type}`, `{"type": ${type}, "url": "https://x.test"}`, 'unknownType'),
    ),
    ...['null', '1', '[]', '{}', 'true'].map((command) =>
      one(`command ${command}`, `{"command": ${command}}`, 'commandType'),
    ),
    ...['null', '"x"', '1', '{}', 'true'].map((args) =>
      one(`args ${args}`, `{"command": "x", "args": ${args}}`, 'argsType'),
    ),
    ...['null', '1', '[]', '{}', 'true'].map((item) =>
      one(`args item ${item}`, `{"command": "x", "args": [${item}]}`, 'argType'),
    ),
    ...['""', '1', '[]', '{}', 'true'].map((url) =>
      one(`url ${url}, no type`, `{"url": ${url}}`, 'urlNoType'),
    ),
    one('a url and a command, no type', '{"command": "x", "url": "https://x.test"}', 'urlNoType'),
    ...['null', '1', '[]', '{}', 'true'].map((url) =>
      one(`remote url ${url}`, `{"type": "ws", "url": ${url}}`, 'invalidUrl'),
    ),
    ...['/mcp', 'x.test/mcp', 'https://', 'not a url'].map((url) =>
      one(`remote url ${url}`, `{"type": "http", "url": "${url}"}`, 'invalidUrl'),
    ),
    one('a remote type with a command and no url', '{"type": "http", "command": "x"}', 'noUrl'),
    one('a stdio type with no command', '{"type": "stdio", "args": []}', 'noCommand'),
    one('a stdio type with an empty command', '{"type": "stdio", "command": ""}', 'emptyCommand'),
    ...['null', '"A=1"', '1', '[]', 'true'].map((env) =>
      one(`env ${env}`, `{"command": "x", "env": ${env}}`, 'envType'),
    ),
    ...['http', 'streamable-http', 'sse', 'ws'].flatMap((type) =>
      ['null', '"x"', '1', '[]', 'true'].map((headers) =>
        one(
          `${type} headers ${headers}`,
          `{"type": "${type}", "url": "https://x.test", "headers": ${headers}}`,
          'headersType',
        ),
      ),
    ),
    ...['http', 'streamable-http', 'sse'].flatMap((type) =>
      ['null', '"x"', '1', '[]', 'true'].map((oauth) =>
        one(
          `${type} oauth ${oauth}`,
          `{"type": "${type}", "url": "https://x.test", "oauth": ${oauth}}`,
          'oauthType',
        ),
      ),
    ),
    {
      name: 'an empty remote url, and headers and oauth that are not objects',
      code: wrap('{"type": "http", "url": "", "headers": [], "oauth": []}'),
      filename: project,
      errors: [{ messageId: 'headersType' }, { messageId: 'oauthType' }],
    },
    {
      name: 'no url, and headers that is not an object',
      code: wrap('{"type": "sse", "headers": []}'),
      filename: project,
      errors: [{ messageId: 'noUrl' }, { messageId: 'headersType' }],
    },
    {
      name: 'an empty command, and an env that is not an object',
      code: wrap('{"command": "", "env": "A=1"}'),
      filename: project,
      errors: [{ messageId: 'emptyCommand' }, { messageId: 'envType' }],
    },
    {
      name: 'a remote url that is not a string, on the url value',
      code: remoteNumber,
      filename: project,
      errors: [
        {
          messageId: 'invalidUrl',
          data: { server: 'a' },
          column: col(remoteNumber, '2.5'),
          endColumn: col(remoteNumber, '}}}'),
        },
      ],
    },
    {
      name: 'no command, and args that is not an array',
      code: wrap('{"args": "x"}'),
      filename: project,
      errors: [{ messageId: 'noCommand' }, { messageId: 'argsType' }],
    },
    {
      name: 'no command, and an args item that is not a string',
      code: wrap('{"args": [1]}'),
      filename: project,
      errors: [{ messageId: 'noCommand' }, { messageId: 'argType' }],
    },
    {
      name: 'each fault of one entry, and each bad args item',
      code: wrap('{"command": 1, "args": [1, null]}'),
      filename: project,
      errors: [{ messageId: 'commandType' }, { messageId: 'argType' }, { messageId: 'argType' }],
    },
    {
      name: 'each server, with its name',
      code: '{"mcpServers": {"a": 1, "b": {"command": "x"}, "c b": {"type": "x"}}}',
      filename: project,
      errors: [
        { messageId: 'notObject', data: { server: 'a' } },
        { messageId: 'unknownType', data: { server: 'c b' } },
      ],
    },
  ],
})

/** The message id of each fault case, in the order of `cases`. */
const FAULT_IDS = [
  'urlNoType',
  'argsType',
  'argType',
  'unknownType',
  'invalidUrl',
  'noUrl',
  'notObject',
  'commandType',
  'noCommand',
  'emptyCommand',
  'envType',
  'headersType',
  'oauthType',
]

/** A server map with one server for each fault case. */
const FAULTS = `{"mcpServers": {${Object.values(cases)
  .map((code, i) => `"s${i}": ${code.slice('{"mcpServers": {"a": '.length, -2)}`)
  .join(', ')}}}`

jsonTester.run('mcp-server-schema (files)', rule, {
  // Claude Code never reads an MCP config under `.claude/`. `mcp-json-location` reports it.
  valid: ['.claude/.mcp.json', '.claude/mcp.json', '.claude/config/mcp.json'].map((filename) => ({
    name: filename,
    code: FAULTS,
    filename,
  })),
  invalid: [
    {
      name: 'a committed managed-mcp.json',
      code: FAULTS,
      filename: 'managed-mcp.json',
      errors: FAULT_IDS.map((messageId, i) => ({
        messageId,
        data: { server: `s${i}` },
      })),
    },
  ],
})

it('reports each fault case of a project file on disk', () => {
  expect(ids(lintProject('mcp-server-schema', FAULTS))).toEqual(FAULT_IDS)
})
it('reports each fault case of a managed-mcp.json at a plugin root', () => {
  // A plugin has no `managed-mcp.json` component, and `claude plugin validate` does not read it.
  // So the plugin skip does not cover it.
  const root = repo({ '.claude-plugin/plugin.json': '{}' })
  const file = path.join(root, 'managed-mcp.json')
  expect(ids(lintJson('mcp-server-schema', FAULTS, file))).toEqual(FAULT_IDS)
  const bare = JSON.stringify(JSON.parse(FAULTS).mcpServers)
  expect(ids(lintJson('mcp-server-schema', bare, file))).toEqual([])
  // The control: the directory is a plugin root, so its `.mcp.json` gets the plugin skip.
  expect(ids(lintJson('mcp-server-schema', FAULTS, path.join(root, '.mcp.json')))).toEqual([])
})
it('reports each fault case of a managed-mcp.json in a directory that it cannot read', () => {
  // The rule reads a `managed-mcp.json` without the plugin-root check, so a lock does not stop it.
  if (chmodCannotBlock) {
    return
  }
  const root = repo({ '.claude-plugin/plugin.json': '{}' })
  const file = path.join(root, 'managed-mcp.json')
  const found = withoutAccess(path.join(root, '.claude-plugin'), () =>
    lintJson('mcp-server-schema', FAULTS, file),
  )
  expect(ids(found)).toEqual(FAULT_IDS)
})

// Ruling 20 of #355: `claude plugin validate` 2.1.302 passes a `url` with a `command` and no
// `type` in a plugin, and Claude Code skips that entry. So the rule reports it in a plugin too.
// Validate fails each other fault there, and the rule stays silent on them.
const URL = 'https://x.test/mcp'
/** The servers of `FAULTS`, and the server `both`, which has a `url` and a `command`. Its `env`
 *  object is a good stdio shape, so the entry still gets the report. */
const pluginServers = {
  ...JSON.parse(FAULTS).mcpServers,
  both: { command: 'npx', env: {}, url: URL },
}
/** The column of the `url` value of the server `both`, the last server of `code`. */
const bothUrl = (code: string) => code.lastIndexOf(`"${URL}"`) + 1

it('reports only a url with a command and no type in a plugin .mcp.json', () => {
  const wrapped = JSON.stringify({ mcpServers: pluginServers })
  const found = lintPluginFile('mcp-server-schema', wrapped)
  expect(found.map((m) => [m.messageId, m.message.includes('"both"'), m.column])).toEqual([
    ['urlNoType', true, bothUrl(wrapped)],
  ])
  expect(ids(lintPluginFile('mcp-server-schema', JSON.stringify(pluginServers)))).toEqual([
    'urlNoType',
  ])
})
it('reports only a url with a command and no type in a plugin manifest', () => {
  const inline = JSON.stringify({ name: 'p', mcpServers: pluginServers })
  const found = lintManifest('mcp-server-schema', inline)
  expect(found.map((m) => [m.messageId, m.column])).toEqual([['urlNoType', bothUrl(inline)]])
  // The report for a server of a declared file is on its path in the manifest. A bundle adds no
  // server, and the rule does not read it.
  const declared = JSON.stringify({ name: 'p', mcpServers: ['./x.mcpb', './servers.json'] })
  const files = {
    'p/servers.json': JSON.stringify({ mcpServers: pluginServers }),
    'p/x.mcpb': JSON.stringify({ mcpServers: pluginServers }),
  }
  const fromFile = lintManifest('mcp-server-schema', declared, files)
  expect(fromFile.map((m) => [m.messageId, m.column])).toEqual([
    ['urlNoType', declared.indexOf('"./servers.json"') + 1],
  ])
  // The root `.mcp.json` has its own lint run, so the manifest gets no report for it.
  const root = JSON.stringify({ name: 'p', mcpServers: './.mcp.json' })
  const rootFile = { 'p/.mcp.json': JSON.stringify({ mcpServers: pluginServers }) }
  expect(ids(lintManifest('mcp-server-schema', root, rootFile))).toEqual([])
})
it('stays silent in a plugin on an entry that validate reports or that has no url', () => {
  // Validate 2.1.302 reports each of these entries, or Claude Code reads it as stdio. Validate
  // 2.1.304 reports the `env` entry.
  const entries = [
    { url: URL },
    { command: '', url: URL },
    { command: 1, url: URL },
    { command: 'npx', args: 'x', url: URL },
    { command: 'npx', args: [1], url: URL },
    { command: 'npx', env: ['A=1'], url: URL },
    { command: 'npx', url: null },
    { type: 'stdio', command: 'npx', url: URL },
    { type: 'bad', command: 'npx', url: URL },
  ]
  for (const entry of entries) {
    const code = JSON.stringify({ mcpServers: { a: entry } })
    expect(ids(lintPluginFile('mcp-server-schema', code))).toEqual([])
    expect(
      ids(lintManifest('mcp-server-schema', JSON.stringify({ name: 'p', ...JSON.parse(code) }))),
    ).toEqual([])
  }
  // A command of one space passes validate, so the rule reports it. The last `url` counts.
  const space = JSON.stringify({ mcpServers: { a: { command: ' ', args: ['-y'], url: URL } } })
  expect(ids(lintPluginFile('mcp-server-schema', space))).toEqual(['urlNoType'])
  const lastNull = '{"mcpServers": {"a": {"command": "npx", "url": "x", "url": null}}}'
  expect(ids(lintPluginFile('mcp-server-schema', lastNull))).toEqual([])
})
it('stays silent on a plugin .mcp.json in a directory that it cannot read', () => {
  if (chmodCannotBlock) {
    return
  }
  const root = repo({ 'p/.claude-plugin/plugin.json': '{}' })
  const code = JSON.stringify({ mcpServers: pluginServers })
  const found = withoutAccess(path.join(root, 'p', '.claude-plugin'), () =>
    lintJson('mcp-server-schema', code, path.join(root, 'p', '.mcp.json')),
  )
  expect(ids(found)).toEqual([])
})
// `claude plugin validate` reads the root file of a repository that is a plugin with a manifest. It
// does not read that root file when the plugin has no manifest, so the project check runs there.
it('reports each fault in the root file of a plugin repository with no manifest', () => {
  const code = '{"mcpServers": {"a": {"command": 5}}}'
  expect(ids(lintRootListedFile('mcp-server-schema', code))).toEqual(['commandType'])
})
it('reports the url with a command only in the root file of a plugin repository with a manifest', () => {
  expect(
    ids(lintRootPluginFile('mcp-server-schema', '{"mcpServers": {"a": {"command": 5}}}')),
  ).toEqual([])
  const code = '{"mcpServers": {"a": {"command": "x", "url": "https://x.test"}}}'
  expect(ids(lintRootPluginFile('mcp-server-schema', code))).toEqual(['urlNoType'])
})
// #384: `claude plugin validate` 2.1.302 fails a plugin with no `plugin.json` outright. So it does
// not check the `.mcp.json` of such a plugin, and the rule reports each fault there.
it('reports each fault case of a plugin .mcp.json that a marketplace lists with no manifest', () => {
  expect(ids(lintListedPluginFile('mcp-server-schema', FAULTS))).toEqual(FAULT_IDS)
  // A plugin file with no `mcpServers` wrapper has its server map at the top level.
  const bare = JSON.stringify(JSON.parse(FAULTS).mcpServers)
  expect(ids(lintListedPluginFile('mcp-server-schema', bare))).toEqual(FAULT_IDS)
})

// #462: `claude mcp list` 2.1.310 skips a stdio entry whose `env` has a member value that is not a
// string, and a remote entry whose `headers` has one ("env.A: expected string, received number").
// It reads `env` in a stdio entry and `headers` in a remote entry only. A `sdk` entry has its own
// message. Validate 2.1.310 reports the same value in a plugin, so a plugin with a manifest is
// silent here, as for each other fault.
const NOT_STRINGS = ['1', 'true', 'null', '{}', '[]']
const envEntry = (value: string) => `{"command": "x", "env": {"A": ${value}}}`
const headersEntry = (type: string, value: string) =>
  `{"type": "${type}", "url": "https://x.test", "headers": {"H": ${value}}}`

jsonTester.run('mcp-server-schema (member values)', rule, {
  valid: [
    { name: 'a string env value', code: wrap(envEntry('"1"')), filename: project },
    {
      name: 'a string headers value',
      code: wrap(headersEntry('http', '"1"')),
      filename: project,
    },
    {
      name: 'an env object that a later env object of the same entry replaces',
      code: wrap('{"command": "x", "env": {"A": 1}, "env": {"A": "1"}}'),
      filename: project,
    },
    {
      name: 'an env member that a later member of the same name replaces',
      code: wrap('{"command": "x", "env": {"A": 1, "A": "1"}}'),
      filename: project,
    },
    {
      name: 'an env in a remote entry, which Claude Code does not read',
      code: wrap('{"type": "http", "url": "https://x.test", "env": {"A": 1}}'),
      filename: project,
    },
    {
      name: 'headers in a stdio entry, which Claude Code does not read',
      code: wrap('{"command": "x", "headers": {"H": 1}}'),
      filename: project,
    },
    {
      name: 'env in a sdk entry, which has its own message',
      code: wrap('{"type": "sdk", "name": "x", "env": {"A": 1}}'),
      filename: project,
    },
  ],
  invalid: [
    ...NOT_STRINGS.flatMap((value) =>
      ['.mcp.json', 'managed-mcp.json'].flatMap((filename) => [
        {
          name: `env value ${value} in ${filename}`,
          code: wrap(envEntry(value)),
          filename,
          errors: [{ messageId: 'envValueType' as const, data: { server: 'a', member: 'A' } }],
        },
        ...['http', 'streamable-http', 'sse', 'ws'].map((type) => ({
          name: `${type} headers value ${value} in ${filename}`,
          code: wrap(headersEntry(type, value)),
          filename,
          errors: [{ messageId: 'headersValueType' as const, data: { server: 'a', member: 'H' } }],
        })),
      ]),
    ),
    {
      name: 'a typed stdio entry, on the member value',
      code: wrap('{"type": "stdio", "command": "x", "env": {"A": 1}}'),
      filename: project,
      errors: [
        {
          messageId: 'envValueType',
          column: col(wrap('{"type": "stdio", "command": "x", "env": {"A": 1}}'), '1'),
        },
      ],
    },
    {
      name: 'each member value that is not a string, with its name',
      code: wrap('{"command": "x", "env": {"A": 1, "B": "x", "C": true}}'),
      filename: project,
      errors: [
        { messageId: 'envValueType', data: { server: 'a', member: 'A' } },
        { messageId: 'envValueType', data: { server: 'a', member: 'C' } },
      ],
    },
    {
      name: 'the last of two members of the same name',
      code: wrap('{"command": "x", "env": {"A": "1", "A": 2}}'),
      filename: project,
      errors: [{ messageId: 'envValueType', data: { server: 'a', member: 'A' } }],
    },
    {
      name: 'the last of two env objects of one entry',
      code: wrap('{"command": "x", "env": {"A": "1"}, "env": {"A": 2}}'),
      filename: project,
      errors: [{ messageId: 'envValueType', data: { server: 'a', member: 'A' } }],
    },
    {
      name: 'a headers value, on the member value',
      code: wrap('{"type": "http", "url": "https://x.test", "headers": {"H": 7}}'),
      filename: project,
      errors: [
        {
          messageId: 'headersValueType',
          column: col(wrap('{"type": "http", "url": "https://x.test", "headers": {"H": 7}}'), '7'),
        },
      ],
    },
    {
      name: 'an env that is not an object gets the object report only',
      code: wrap('{"command": "x", "env": [1]}'),
      filename: project,
      errors: [{ messageId: 'envType' }],
    },
  ],
})

it('stays silent in a plugin on a member value that is not a string', () => {
  const entries = [
    { command: 'x', env: { A: 1 } },
    { type: 'http', url: URL, headers: { H: true } },
    { command: 'x', env: { A: 1 }, url: URL },
  ]
  for (const entry of entries) {
    const code = JSON.stringify({ mcpServers: { a: entry } })
    expect(ids(lintPluginFile('mcp-server-schema', code))).toEqual([])
    expect(
      ids(lintManifest('mcp-server-schema', JSON.stringify({ name: 'p', ...JSON.parse(code) }))),
    ).toEqual([])
    expect(ids(lintRootPluginFile('mcp-server-schema', code))).toEqual([])
  }
})

it('reports a member value that is not a string in a plugin file with no manifest', () => {
  const env = '{"mcpServers": {"a": {"command": "x", "env": {"A": 1}}}}'
  const headers =
    '{"mcpServers": {"a": {"type": "http", "url": "https://x.test", "headers": {"H": 1}}}}'
  expect(ids(lintListedPluginFile('mcp-server-schema', env))).toEqual(['envValueType'])
  expect(ids(lintRootListedFile('mcp-server-schema', env))).toEqual(['envValueType'])
  expect(ids(lintListedPluginFile('mcp-server-schema', headers))).toEqual(['headersValueType'])
  expect(ids(lintRootListedFile('mcp-server-schema', headers))).toEqual(['headersValueType'])
})
