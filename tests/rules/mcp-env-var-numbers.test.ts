// The MCP timeouts of the `env` block of a settings file are numbers of milliseconds (env vars
// reference). A plain number below 1000 is most likely seconds. The docs say that Claude Code
// raises `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` below 1000 to one second.
// The files glob is in tests/configs.test.ts.
import { expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const NAME = 'mcp-env-var-numbers'
const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)
const project = '/p/.claude/settings.json'
const env = (values: Record<string, unknown>) => JSON.stringify({ env: values })

it('reports MCP_TIMEOUT written in seconds, on the value', () => {
  const code = env({ MCP_TIMEOUT: '30' })
  const found = lintJson(NAME, code, project)
  expect(ids(found)).toEqual(['seconds'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('"30"') + 1, endLine: 1 })
  expect(found[0]?.message).toContain('"MCP_TIMEOUT"')
  expect(found[0]?.message).toContain('milliseconds')
  expect(ids(lintJson(NAME, env({ MCP_TIMEOUT: '999' }), project))).toEqual(['seconds'])
})
it('reports each variable that has no floor in the docs', () => {
  for (const variable of [
    'MCP_TIMEOUT',
    'MCP_CONNECT_TIMEOUT_MS',
    'CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS',
  ]) {
    expect(ids(lintJson(NAME, env({ [variable]: '5' }), project)), variable).toEqual(['seconds'])
  }
})
it('reports the two variables that Claude Code raises to one second', () => {
  for (const variable of ['MCP_TOOL_TIMEOUT', 'CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT']) {
    const found = lintJson(NAME, env({ [variable]: '30' }), project)
    expect(ids(found), variable).toEqual(['floored'])
    expect(found[0]?.message).toContain('one second')
  }
})
it('reports in the local, managed and drop-in files, and each variable', () => {
  const code = env({ MCP_TIMEOUT: '30', MCP_TOOL_TIMEOUT: '30' })
  for (const file of [
    '/p/.claude/settings.local.json',
    '/p/managed-settings.json',
    '/p/managed-settings.d/10-a.json',
  ]) {
    expect(ids(lintJson(NAME, code, file)), file).toEqual(['seconds', 'floored'])
  }
})
it('reads the last of two keys of one name', () => {
  expect(
    ids(lintJson(NAME, '{"env": {"MCP_TIMEOUT": "30000", "MCP_TIMEOUT": "30"}}', project)),
  ).toEqual(['seconds'])
})
it('stays silent for 1000 or more, for zero, and for an empty value', () => {
  for (const value of ['1000', '30000', '100000000', '0', '00', '']) {
    expect(
      ids(lintJson(NAME, env({ MCP_TIMEOUT: value, MCP_TOOL_TIMEOUT: value }), project)),
      value,
    ).toEqual([])
  }
})
it('stays silent for a value that is not plain digits', () => {
  for (const value of ['30s', ' 30', '3.5', '-30', '1e2', '30 000', `\${T}`]) {
    expect(ids(lintJson(NAME, env({ MCP_TIMEOUT: value }), project)), value).toEqual([])
  }
})
it('stays silent for MAX_MCP_OUTPUT_TOKENS, other variables and a value that is not a string', () => {
  expect(ids(lintJson(NAME, env({ MAX_MCP_OUTPUT_TOKENS: '50' }), project))).toEqual([])
  expect(ids(lintJson(NAME, env({ MCP_TIMEOUTS: '30', OTHER_TIMEOUT: '30' }), project))).toEqual([])
  expect(ids(lintJson(NAME, env({ MCP_TIMEOUT: 30, MCP_TOOL_TIMEOUT: null }), project))).toEqual([])
})
it('stays silent when env is not an object, and for a key below the top level', () => {
  expect(ids(lintJson(NAME, '{"env": ["MCP_TIMEOUT"]}', project))).toEqual([])
  expect(ids(lintJson(NAME, '{"other": {"env": {"MCP_TIMEOUT": "30"}}}', project))).toEqual([])
  expect(ids(lintJson(NAME, '[]', project))).toEqual([])
})
it('stays silent in a hidden drop-in', () => {
  expect(ids(lintJson(NAME, env({ MCP_TIMEOUT: '30' }), '/p/managed-settings.d/.10.json'))).toEqual(
    [],
  )
})

it('reads each variable, also after a value that is not a string', () => {
  const values = { MCP_TIMEOUT: 30, MCP_TOOL_TIMEOUT: '30', MAX_MCP_OUTPUT_TOKENS: '30' }
  expect(ids(lintJson(NAME, env(values), project))).toEqual(['floored'])
})

it('ignores an earlier key of one name', () => {
  const code = '{"env": {"MCP_TIMEOUT": "30", "MCP_TIMEOUT": "30000"}}'
  expect(ids(lintJson(NAME, code, project))).toEqual([])
})
