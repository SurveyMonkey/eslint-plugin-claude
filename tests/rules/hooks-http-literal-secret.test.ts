// A header value of an `http` hook supports `$VAR_NAME` and `${VAR_NAME}`, and `allowedEnvVars` lists the
// variables that Claude Code may use (https://code.claude.com/docs/en/hooks#http-hook-fields). The example of
// the docs sets `"Authorization": "Bearer $MY_TOKEN"`. A literal token in a committed header is a secret in the
// repository. The rule reads the header names that carry a credential.
import { describe, expect, it } from 'vitest'
import { FILES, frontmatter, hooks, markdownIds, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-http-literal-secret'
const http = (headers: unknown, fields: Record<string, unknown> = {}) => ({
  type: 'http',
  url: 'https://hooks.example.com/x',
  headers,
  ...fields,
})
const ids = (handler: object, file = FILES.project) =>
  lintJson(name, settings(hooks('PreToolUse', [handler], 'Bash')), file).map(
    (message) => message.messageId,
  )
const header = (key: string, value: unknown) => ids(http({ [key]: value }))

describe(`${name}: the report`, () => {
  it('reports a literal token in a credential header', () => {
    for (const [key, value] of [
      ['Authorization', 'Bearer abc123def'],
      ['authorization', 'Basic dXNlcjpwYXNz'],
      ['X-Api-Key', 'abc123'],
      ['X-Auth-Token', 'abc123'],
      ['X-Webhook-Secret', 's3cr3t'],
      ['Proxy-Authorization', 'Bearer abc'],
      ['X-Password', 'hunter2'],
      ['Api_Key', 'k'],
      ['X-Token', 'k'],
      ['X-Credential', 'k'],
      ['ApiKey', 'k'],
      ['X-Api-Key', '1a2b3c4d'],
      ['X-Api-Key', 'nonce-9f3'],
    ]) {
      expect(header(key as string, value), `${key}: ${value}`).toEqual(['literal'])
    }
  })

  it('reports each header with a literal value, and names it without the value', () => {
    const [first, second] = lintJson(
      name,
      settings(
        hooks('Stop', [http({ Authorization: 'Bearer abc', 'X-Api-Key': 'k1', 'X-Other': 'v' })]),
      ),
      FILES.project,
    )
    expect(first?.message).toBe(
      'The "Authorization" header holds a literal credential, which is then in the repository. Set the value to a variable such as "Bearer $MY_TOKEN", and list the variable in "allowedEnvVars".',
    )
    expect(second?.message).toContain('"X-Api-Key"')
    expect(
      lintJson(
        name,
        settings(hooks('Stop', [http({ Authorization: 'Bearer abc', 'X-Api-Key': 'k1' })])),
        FILES.project,
      ),
    ).toHaveLength(2)
  })

  it('reports in each file that Claude Code reads', () => {
    for (const file of [FILES.project, FILES.local, FILES.managed, FILES.dropIn, FILES.plugin]) {
      expect(ids(http({ Authorization: 'Bearer abc' }), file), file).toEqual(['literal'])
    }
  })

  it('reports in a skill and a project agent', () => {
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: http\n        url: https://x.example.com\n        headers:\n          Authorization: Bearer abc\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['literal'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['literal'])
  })

  it('reads the last of two headers with one name', () => {
    expect(
      lintJson(
        name,
        '{"hooks":{"Stop":[{"hooks":[{"type":"http","url":"u","headers":{"Authorization":"Bearer abc","Authorization":"$T"}}]}]}}',
        FILES.project,
      ),
    ).toEqual([])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a variable reference', () => {
    for (const value of [
      'Bearer $MY_TOKEN',
      `\${MY_TOKEN}`,
      `Bearer \${MY_TOKEN}`,
      '$T',
      'Bearer abc$T',
    ]) {
      expect(header('Authorization', value), value).toEqual([])
    }
  })

  it('is silent for a value that cannot be a secret', () => {
    for (const value of [
      'true',
      'false',
      'TRUE',
      'yes',
      'no',
      'on',
      'off',
      'none',
      'null',
      '42',
      '',
      '  ',
      'Bearer',
      'Bearer  ',
    ]) {
      expect(header('X-Api-Key', value), value).toEqual([])
    }
  })

  it('is silent for a header that carries no credential', () => {
    for (const key of ['Content-Type', 'X-Request-Id', 'Accept', 'X-Team']) {
      expect(header(key, 'application/json'), key).toEqual([])
    }
  })

  it('is silent for a value that is no string, and headers that is no object', () => {
    expect(header('Authorization', 5)).toEqual([])
    expect(header('Authorization', null)).toEqual([])
    expect(ids(http('Authorization: Bearer abc'))).toEqual([])
    expect(ids(http(['Authorization']))).toEqual([])
    expect(ids({ type: 'http', url: 'u' })).toEqual([])
  })

  it('is silent for another handler type, a hidden drop-in and a plugin agent', () => {
    expect(
      ids({ type: 'command', command: 'x', headers: { Authorization: 'Bearer abc' } }),
    ).toEqual([])
    expect(ids(http({ Authorization: 'Bearer abc' }), FILES.hidden)).toEqual([])
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: http\n        url: u\n        headers:\n          Authorization: Bearer abc\n',
    )
    expect(markdownIds(name, text, '/repo/plugins/p/agents/a.md')).toEqual([])
  })
})
