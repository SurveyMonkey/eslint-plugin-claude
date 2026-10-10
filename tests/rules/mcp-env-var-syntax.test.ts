// Only `${VAR}` and `${VAR:-default}` expand in a server entry (MCP page, "Supported syntax").
// Another form stays as written. The rule reads `command`, `args`, `env`, `url` and `headers`,
// where Claude Code expands references. A shell reads its own arguments, so the `args` of a
// shell command are not read.
import { expect, it } from 'vitest'
import {
  ids,
  lintManifest,
  lintPluginFile,
  lintProject,
  mapOf,
} from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-env-var-syntax'
const at = (entry: object) => mapOf({ a: entry })

it(`reports $VAR, %VAR%, \${VAR-x} and \${VAR:=x}, in each field that expands`, () => {
  for (const text of [
    '$HOME/x',
    '%HOME%/x',
    `\${VAR-x}`,
    `\${VAR:=x}`,
    `a \${VAR:?e}`,
    `a \${VAR+x}`,
  ]) {
    expect(ids(lintProject(NAME, at({ command: text }))), text).toEqual(['syntax'])
    expect(ids(lintProject(NAME, at({ command: 'x', args: ['-a', text] }))), text).toEqual([
      'syntax',
    ])
    expect(ids(lintProject(NAME, at({ command: 'x', env: { K: text } }))), text).toEqual(['syntax'])
    expect(ids(lintProject(NAME, at({ type: 'http', url: text }))), text).toEqual(['syntax'])
    expect(
      ids(lintProject(NAME, at({ type: 'http', url: 'https://x', headers: { H: text } }))),
      text,
    ).toEqual(['syntax'])
  }
})
it('reports on the string, and the message names the field, the server and the text', () => {
  const code = at({ command: 'x', args: ['--k', 'Bearer $TOKEN'] })
  const found = lintProject(NAME, code)
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"Bearer') + 1 })
  expect(found[0]?.message).toContain('`args`')
  expect(found[0]?.message).toContain('"a"')
  expect(found[0]?.message).toContain('$TOKEN')
})
it('reports a string once, and each string', () => {
  expect(ids(lintProject(NAME, at({ command: `$A $B \${C-d}` })))).toEqual(['syntax'])
  expect(ids(lintProject(NAME, at({ command: '$A', args: ['$B'] })))).toEqual(['syntax', 'syntax'])
})
it('reports in a plugin file and in the servers of a manifest', () => {
  expect(ids(lintPluginFile(NAME, at({ command: '$ROOT/x' })))).toEqual(['syntax'])
  const manifest = JSON.stringify({ name: 'p', mcpServers: { a: { command: '$ROOT/x' } } })
  expect(ids(lintManifest(NAME, manifest))).toEqual(['syntax'])
  const declared = JSON.stringify({ name: 'p', mcpServers: './s.json' })
  expect(ids(lintManifest(NAME, declared, { 'p/s.json': at({ command: '$ROOT/x' }) }))).toEqual([
    'syntax',
  ])
})
it(`stays silent for \${VAR}, \${VAR:-default} and the plugin forms`, () => {
  for (const text of [
    `\${VAR}`,
    `\${VAR:-x}`,
    `\${VAR:-}`,
    `\${VAR:-\${OTHER}}`,
    `a/\${CLAUDE_PLUGIN_ROOT}/b`,
    `\${user_config.api_key}`,
    `\${CLAUDE_PROJECT_DIR:-.}/x`,
  ]) {
    expect(
      ids(lintProject(NAME, at({ command: text, args: [text], env: { K: text } }))),
      text,
    ).toEqual([])
  }
})
it('stays silent for text that only looks like a variable', () => {
  for (const text of [
    '$',
    '$1',
    '$$VAR',
    '100%',
    '50%/%',
    '%e2%80%99',
    'a%AB%CD',
    '%25VAR%25',
    '$(x)',
    'a$',
  ]) {
    expect(ids(lintProject(NAME, at({ command: text, args: [text] }))), text).toEqual([])
  }
})
it('stays silent in fields that Claude Code does not expand, and in a non-string', () => {
  const entry = {
    command: 'x',
    headersHelper: 'echo $TOKEN',
    oauth: { clientId: '$ID' },
    timeout: 5,
    note: '$HOME',
    args: [1, null],
    env: { K: 5 },
  }
  expect(ids(lintProject(NAME, at(entry)))).toEqual([])
  expect(
    ids(lintProject(NAME, at({ command: 'x', args: '$A', env: ['$A'], headers: '$A' }))),
  ).toEqual([])
})
it('stays silent for the args of a shell, and reports the other fields of it', () => {
  for (const command of [
    'sh',
    'bash',
    '/bin/zsh',
    'dash',
    'cmd',
    'cmd.exe',
    'pwsh',
    'powershell',
  ]) {
    const entry = { command, args: ['-c', `echo $HOME \${A-b} %A%`] }
    expect(ids(lintProject(NAME, at(entry))), command).toEqual([])
  }
  const mixed = { command: 'bash', args: ['-c', 'echo $HOME'], env: { K: '$HOME' } }
  expect(ids(lintProject(NAME, at(mixed)))).toEqual(['syntax'])
  expect(ids(lintProject(NAME, at({ command: 'node', args: ['$HOME'] })))).toEqual(['syntax'])
})
it('stays silent for a path that Claude Code does not read, and a server that is shadowed', () => {
  expect(ids(lintProject(NAME, at({ command: '$A' }), '.claude/.mcp.json'))).toEqual([])
  const shadowed = '{"mcpServers": {"a": {"command": "$A"}, "a": {"command": "x"}}}'
  expect(ids(lintProject(NAME, shadowed))).toEqual([])
  expect(
    ids(lintProject(NAME, '{"mcpServers": {"a": {"command": "x", "command": "$A"}}}')),
  ).toEqual(['syntax'])
  expect(ids(lintProject(NAME, '[]'))).toEqual([])
})

it('reads the args of an entry whose command is missing or not a string', () => {
  expect(ids(lintProject(NAME, at({ args: ['$A'] })))).toEqual(['syntax'])
  expect(ids(lintProject(NAME, at({ command: 5, args: ['$A'] })))).toEqual(['syntax'])
})

it('reads each string, also after one that is not a string', () => {
  expect(
    ids(lintProject(NAME, at({ command: 'x', args: [1, '$A'], env: { K: 5, L: '$A' } }))),
  ).toEqual(['syntax', 'syntax'])
})
