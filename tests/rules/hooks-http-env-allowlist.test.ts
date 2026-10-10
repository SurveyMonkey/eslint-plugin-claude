// An `http` hook puts an environment variable into a header only when `allowedEnvVars` of the same
// hook lists it. Claude Code replaces any other reference with an empty string
// (https://code.claude.com/docs/en/hooks#http-hook-fields). The settings key
// `httpHookAllowedEnvVars` also limits the list, but its entries merge across settings files, so the
// rule does not read it (https://code.claude.com/docs/en/settings-reference#httphookallowedenvvars).
import { describe, expect, it } from 'vitest'
import {
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-http-env-allowlist'
const http = (fields: Record<string, unknown> = {}) => ({
  type: 'http',
  url: 'https://hooks.example.com/a',
  ...fields,
})
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('Stop', [handler])), file)
const brace = (variable: string) => `\${${variable}}`
const header = (value: unknown, allowed?: unknown) =>
  ids(
    http({
      headers: { Authorization: value },
      ...(allowed === undefined ? {} : { allowedEnvVars: allowed }),
    }),
  )

describe(`${name}: the header variables`, () => {
  it('reports a variable that allowedEnvVars does not list', () => {
    expect(header('Bearer $MY_TOKEN', ['OTHER'])).toEqual(['unlisted'])
    expect(header(`Bearer ${brace('MY_TOKEN')}`, ['OTHER'])).toEqual(['unlisted'])
    expect(header('Bearer $MY_TOKEN', [])).toEqual(['unlisted'])
    expect(header('$MY_TOKEN', [7, null, ['MY_TOKEN']])).toEqual(['unlisted'])
    expect(header('Bearer $MY_TOKEN_2', ['MY_TOKEN'])).toEqual(['unlisted'])
    expect(header('Bearer $my_token', ['MY_TOKEN'])).toEqual(['unlisted'])
    expect(header('Bearer $_TOKEN', [])).toEqual(['unlisted'])
  })

  it('reports a variable when allowedEnvVars is missing, since no variable is then allowed', () => {
    expect(header('Bearer $MY_TOKEN')).toEqual(['unlisted'])
  })

  it('is silent for a variable that allowedEnvVars lists', () => {
    expect(header('Bearer $MY_TOKEN', ['MY_TOKEN'])).toEqual([])
    expect(header(`Bearer ${brace('MY_TOKEN')}`, ['OTHER', 'MY_TOKEN'])).toEqual([])
    expect(header('$A and $B', ['A', 'B'])).toEqual([])
    expect(header('Bearer $_TOKEN', ['_TOKEN'])).toEqual([])
  })

  it('reports each unlisted variable once, and not a listed one', () => {
    expect(header('$A $B $C $B', ['A'])).toEqual(['unlisted', 'unlisted'])
    expect(header(`$A ${brace('A')} $A`, [])).toEqual(['unlisted'])
  })

  it('reports each header that holds an unlisted variable', () => {
    expect(
      ids(http({ headers: { A: '$X', B: 'plain', C: '$Y', D: '$X' }, allowedEnvVars: ['Y'] })),
    ).toEqual(['unlisted', 'unlisted'])
  })

  it('is silent for text that is no variable', () => {
    for (const value of [
      'Bearer abc',
      'cost $5',
      '$',
      `\${`,
      `\${}`,
      `\${MY_TOKEN`,
      '$ A',
      'a$',
      '',
      '$-x',
    ]) {
      expect(header(value), value).toEqual([])
    }
  })

  it('reads the last of two headers or lists with one name', () => {
    const text =
      '{"hooks": {"Stop": [{"hooks": [{"type": "http", "url": "u", "headers": {"A": "$X", "A": "ok"}, "allowedEnvVars": ["Z"], "allowedEnvVars": ["X"]}]}]}}'
    expect(jsonIds(name, text, FILES.project)).toEqual([])
    const second =
      '{"hooks": {"Stop": [{"hooks": [{"type": "http", "url": "u", "headers": {"A": "ok", "A": "$X"}, "allowedEnvVars": ["X"], "allowedEnvVars": ["Z"]}]}]}}'
    expect(jsonIds(name, second, FILES.project)).toEqual(['unlisted'])
  })
})

describe(`${name}: what the rule leaves to others`, () => {
  it('is silent when headers or allowedEnvVars has the wrong type', () => {
    expect(ids(http({ headers: 'Bearer $X' }))).toEqual([])
    expect(ids(http({ headers: ['$X'] }))).toEqual([])
    expect(ids(http({ headers: { A: 5, B: null, C: ['$X'] } }))).toEqual([])
    expect(header('$X', 'X')).toEqual([])
    expect(header('$X', { X: true })).toEqual([])
    expect(header('$X', null)).toEqual([])
  })

  it('is silent for an http hook with no headers', () => {
    expect(ids(http())).toEqual([])
    expect(ids(http({ allowedEnvVars: ['X'] }))).toEqual([])
  })

  it('does not read the settings key httpHookAllowedEnvVars', () => {
    const text = JSON.stringify({
      httpHookAllowedEnvVars: ['OTHER'],
      hooks: hooks('Stop', [http({ headers: { A: '$X' }, allowedEnvVars: ['X'] })]),
    })
    expect(jsonIds(name, text, FILES.project)).toEqual([])
    const missing = JSON.stringify({
      httpHookAllowedEnvVars: ['X'],
      hooks: hooks('Stop', [http({ headers: { A: '$X' }, allowedEnvVars: [] })]),
    })
    expect(jsonIds(name, missing, FILES.project)).toEqual(['unlisted'])
  })

  it('reads an http handler only', () => {
    expect(ids({ type: 'command', command: 'x', headers: { A: '$X' } })).toEqual([])
    expect(ids({ type: 'mcp_tool', headers: { A: '$X' } })).toEqual([])
    expect(ids({ headers: { A: '$X' } })).toEqual([])
  })
})

describe(`${name}: the report`, () => {
  it('names the variable and the header, and reports at the header value', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "http", "url": "u", "headers": {"Authorization": "Bearer $MY_TOKEN"}, "allowedEnvVars": ["OTHER"]}]}]}\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['unlisted', 2, 91],
    ])
    expect(found[0]?.message).toBe(
      'Claude Code replaces the reference to MY_TOKEN in the "Authorization" header with an empty string, because "allowedEnvVars" does not list MY_TOKEN.',
    )
  })
})

describe(`${name}: the files`, () => {
  const handler = http({ headers: { A: '$X' }, allowedEnvVars: [] })

  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(handler, file), file).toEqual(['unlisted'])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (list: string) =>
      `Stop:\n  - hooks:\n      - type: http\n        url: u\n        headers:\n          A: $X\n        allowedEnvVars: ${list}\n`
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, frontmatter(yaml('[]')), file), file).toEqual(['unlisted'])
      expect(markdownIds(name, frontmatter(yaml('[X]')), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(ids(handler, FILES.hidden)).toEqual([])
    const yaml =
      'Stop:\n  - hooks:\n      - type: http\n        url: u\n        headers:\n          A: $X\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it('is silent on a config that is malformed', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
    expect(
      jsonIds(name, settings({ Stop: [{ hooks: [{ type: 'http' }] }] }), FILES.project),
    ).toEqual([])
  })
})
