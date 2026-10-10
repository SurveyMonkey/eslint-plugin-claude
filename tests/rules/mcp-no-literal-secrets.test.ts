// A credential written into a committed MCP config is in the repository. The MCP page allows
// `${VAR}` in `env`, `args`, `url` and `headers`, and `managed-mcp.json` says not to store
// credentials in `env` blocks. `claude plugin validate` warns about a header value that looks like a
// literal credential in a plugin MCP config. The rule reads the other cases.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-no-literal-secrets'
const at = (entry: object) => mapOf({ a: entry })
const remote = (headers: object) => at({ type: 'http', url: 'https://x.test/mcp', headers })

it('reports a literal token in the headers of a project .mcp.json, on the value', () => {
  const code = remote({ Authorization: 'Bearer abc123' })
  const found = lintProject(NAME, code)
  expect(ids(found)).toEqual(['secret'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"Bearer') + 1 })
  expect(found[0]?.message).toContain('"Authorization"')
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).not.toContain('abc123')
  for (const header of [
    'X-Api-Key',
    'x-api-key',
    'apiKey',
    'X-Auth-Token',
    'Proxy-Authorization',
  ]) {
    expect(ids(lintProject(NAME, remote({ [header]: 'abc123' }))), header).toEqual(['secret'])
  }
})
it('reports a literal credential in env', () => {
  for (const variable of [
    'GITHUB_TOKEN',
    'API_KEY',
    'DB_PASSWORD',
    'CLIENT_SECRET',
    'MY_AUTH',
    'apiKey',
  ]) {
    expect(
      ids(lintProject(NAME, at({ command: 'x', env: { [variable]: 'abc123' } }))),
      variable,
    ).toEqual(['secret'])
  }
})
it('reports a literal credential in args, as a flag value, a pair and a header line', () => {
  for (const args of [
    ['--token=abc123'],
    ['--api-key', 'abc123'],
    ['-e', 'GITHUB_TOKEN=abc123'],
    ['--header', 'Authorization: Bearer abc123'],
    ['X-Api-Key: abc123'],
  ]) {
    expect(ids(lintProject(NAME, at({ command: 'x', args }))), args.join(' ')).toEqual(['secret'])
  }
  const code = at({ command: 'x', args: ['--token', 'abc123'] })
  expect(lintProject(NAME, code)[0]).toMatchObject({ column: code.indexOf('"abc123"') + 1 })
})
it('reports user information in a url', () => {
  for (const url of [
    'https://user:pass@x.test/mcp',
    'https://abc123@x.test/mcp',
    'https://:pass@x.test',
  ]) {
    expect(ids(lintProject(NAME, at({ type: 'http', url }))), url).toEqual(['secret'])
  }
})
it('reports in a managed-mcp.json file', () => {
  expect(
    ids(lintProject(NAME, at({ command: 'x', env: { API_KEY: 'abc123' } }), 'managed-mcp.json')),
  ).toEqual(['secret'])
})
it('reports env, args and url in a plugin file, and not the headers', () => {
  expect(ids(lintPluginFile(NAME, at({ command: 'x', env: { API_KEY: 'abc123' } })))).toEqual([
    'secret',
  ])
  expect(ids(lintPluginFile(NAME, at({ command: 'x', args: ['--token=abc123'] })))).toEqual([
    'secret',
  ])
  expect(ids(lintPluginFile(NAME, at({ type: 'http', url: 'https://u:p@x.test' })))).toEqual([
    'secret',
  ])
  expect(ids(lintPluginFile(NAME, remote({ Authorization: 'Bearer abc123' })))).toEqual([])
})
it('reports the servers of a manifest, on the path for a declared file', () => {
  const inline = JSON.stringify({
    name: 'p',
    mcpServers: { a: { command: 'x', env: { API_KEY: 'abc123' } } },
  })
  expect(ids(lintManifest(NAME, inline))).toEqual(['secret'])
  const headers = JSON.stringify({
    name: 'p',
    mcpServers: { a: JSON.parse(remote({ Authorization: 'Bearer abc123' })).mcpServers.a },
  })
  expect(ids(lintManifest(NAME, headers))).toEqual([])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  const found = lintManifest(NAME, declared, {
    'p/s.json': at({ command: 'x', env: { API_KEY: 'abc123' } }),
  })
  expect(ids(found)).toEqual(['secret'])
  expect(found[0]).toMatchObject({ column: declared.indexOf('"./s.json"') + 1 })
})
it('reports each literal, and the last of two members', () => {
  expect(ids(lintProject(NAME, at({ command: 'x', env: { A_TOKEN: 'a', B_TOKEN: 'b' } })))).toEqual(
    ['secret', 'secret'],
  )
  const twice = `{"mcpServers": {"a": {"env": {"A_TOKEN": "a", "A_TOKEN": "\${A}"}}}}`
  expect(ids(lintProject(NAME, twice))).toEqual([])
})
it('stays silent for a reference', () => {
  expect(
    ids(lintProject(NAME, remote({ Authorization: `Bearer \${TOKEN}`, 'X-Api-Key': `\${KEY:-}` }))),
  ).toEqual([])
  expect(
    ids(
      lintProject(
        NAME,
        at({
          command: 'x',
          env: { API_KEY: `\${API_KEY}` },
          args: [`--token=\${T}`, '--api-key', `\${K}`],
        }),
      ),
    ),
  ).toEqual([])
  expect(
    ids(lintProject(NAME, at({ type: 'http', url: `https://\${USER}:\${PASS}@x.test` }))),
  ).toEqual([])
})
it('stays silent for a name that does not end in a credential word', () => {
  const env = {
    KEY_FILE: 'a',
    TOKEN_URL: 'a',
    AUTHOR: 'a',
    GIT_AUTHOR_NAME: 'a',
    MONKEY: 'a',
    AWS_ACCESS_KEY_ID: 'a',
    GIT_CONFIG_KEY_0: 'a',
    PATH: 'a',
  }
  expect(ids(lintProject(NAME, at({ command: 'x', env })))).toEqual([])
  expect(
    ids(lintProject(NAME, remote({ 'Content-Type': 'a', Accept: 'a', 'X-Author': 'a' }))),
  ).toEqual([])
  expect(
    ids(
      lintProject(
        NAME,
        at({
          command: 'x',
          args: ['--token-file=a', '--token-file', 'a', '--keyboard', 'a', 'a=b'],
        }),
      ),
    ),
  ).toEqual([])
})
it('stays silent for an empty value, a scheme alone, and a bare variable name', () => {
  expect(ids(lintProject(NAME, remote({ Authorization: '', 'X-Api-Key': '  ' })))).toEqual([])
  expect(ids(lintProject(NAME, remote({ Authorization: 'Bearer ', A: 'Basic  ' })))).toEqual([])
  expect(
    ids(
      lintProject(
        NAME,
        at({ command: 'x', env: { API_KEY: '$API_KEY', T_TOKEN: '%T%' }, args: ['--token', '$T'] }),
      ),
    ),
  ).toEqual([])
})
it('stays silent for a flag with no value, a flag followed by a flag, and a url without user information', () => {
  expect(ids(lintProject(NAME, at({ command: 'x', args: ['--token'] })))).toEqual([])
  expect(ids(lintProject(NAME, at({ command: 'x', args: ['--token', '--verbose'] })))).toEqual([])
  for (const url of [
    'https://x.test/mcp?a=b@c',
    'https://x.test/@u',
    'x.test',
    'https://@x.test',
  ]) {
    expect(ids(lintProject(NAME, at({ type: 'http', url }))), url).toEqual([])
  }
})
it('stays silent for values that are not strings, and for fields it does not read', () => {
  expect(
    ids(
      lintProject(
        NAME,
        at({ command: 'x', env: { API_KEY: 5, B_TOKEN: null }, args: [1, {}], url: 5 }),
      ),
    ),
  ).toEqual([])
  expect(ids(lintProject(NAME, at({ command: 'x', env: ['a'], headers: 'a', args: 'a' })))).toEqual(
    [],
  )
  expect(
    ids(
      lintProject(
        NAME,
        at({
          command: 'x',
          oauth: { clientSecret: 'abc123' },
          headersHelper: 'echo abc123',
          note: { A_TOKEN: 'a' },
        }),
      ),
    ),
  ).toEqual([])
  expect(
    ids(lintProject(NAME, at({ command: 'x', env: { 'A:B': 'a', '': 'a', '--': 'a' } }))),
  ).toEqual([])
})
it('stays silent for a path that Claude Code does not read', () => {
  expect(
    ids(lintProject(NAME, at({ command: 'x', env: { API_KEY: 'abc123' } }), '.claude/mcp.json')),
  ).toEqual([])
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
})

it('reads each item, also after one that is not a string', () => {
  const entry = { command: 'x', args: [1, '--token=abc123'], env: { A_TOKEN: 5, B_TOKEN: 'b' } }
  expect(ids(lintProject(NAME, at(entry)))).toEqual(['secret', 'secret'])
})
