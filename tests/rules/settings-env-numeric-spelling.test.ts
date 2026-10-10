// The expected values come from the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables): a numeric variable accepts scientific
// notation and digit separators, as in `2e3` and `64_000`, and "before v2.1.211, these spellings
// could silently set a much smaller value, such as `1e6` setting a timeout to 1".
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-env-numeric-spelling'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const env = (variables: object) => JSON.stringify({ env: variables })
/** The messages of the rule for `code` at `file`, with the options `options`. */
function lintWith(code: string, file: string, options: object[]) {
  const absolute = path.resolve(file)
  return new Linter({ cwd: path.parse(absolute).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename: absolute },
  )
}
// The rule reports nothing without `minVersion`, so each test sets a client below v2.1.211.
const OLD = [{ minVersion: '2.1.210' }]
const lint = (code: string, file = PROJECT) => lintWith(code, file, OLD)
const ids = (code: string, file = PROJECT) => lint(code, file).map((m) => m.messageId)

describe(`${name}: spellings`, () => {
  it('reports a scientific spelling and a digit separator, in every settings file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(env({ API_TIMEOUT_MS: '1e6' }), file), file).toEqual(['spelling'])
      expect(ids(env({ MAX_THINKING_TOKENS: '64_000' }), file), file).toEqual(['spelling'])
    }
  })

  it('reports the forms of each spelling, with the value in the message', () => {
    for (const value of ['2e3', '1E6', '1e+6', '1e-3', '2.5e3', '2.5E+3', '1_000_000', '0_1']) {
      const [message] = lint(env({ SOME_LIMIT: value }))
      expect(message?.messageId, value).toBe('spelling')
      expect(message?.message, value).toContain(`"${value}" of "SOME_LIMIT"`)
    }
  })

  it('reports on the value', () => {
    const [message] = lint('{\n  "env": { "A": "1e6" }\n}')
    expect([message?.line, message?.column]).toEqual([2, 17])
  })

  it('reports each variable once, and the last of two keys of one name', () => {
    expect(ids(env({ A: '1e6', B: '2e3', C: '5' }))).toEqual(['spelling', 'spelling'])
    expect(ids('{"env": {"A": "1e6", "A": "5"}}')).toEqual([])
    expect(ids('{"env": {"A": "5", "A": "1e6"}}')).toEqual(['spelling'])
    expect(ids('{"env": {"A": "5"}, "env": {"A": "1e6"}}')).toEqual(['spelling'])
  })
})

describe(`${name}: silent cases`, () => {
  it('is silent for plain digits and other text', () => {
    for (const value of [
      '1000000',
      '0',
      '64000',
      '2.5',
      '',
      'abc',
      '1e',
      'e6',
      '1e6x',
      '_1',
      '1_',
      '1__0',
    ]) {
      expect(ids(env({ A: value })), JSON.stringify(value)).toEqual([])
    }
    // Text around the number, a sign, a separator in a decimal, and a thousands comma.
    for (const value of [' 1e6', '-1e6', '+64_000', '1_0.5', '1,000', '0x1e6', '1e6.5']) {
      expect(ids(env({ A: value })), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent for a value that is not a string', () => {
    for (const value of [1000000, 1e6, true, null, ['1e6'], { a: '1e6' }]) {
      expect(ids(env({ A: value })), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent when env is missing or is not an object', () => {
    for (const code of ['{}', '{"env": null}', '{"env": "1e6"}', '{"env": ["1e6"]}', '[]']) {
      expect(ids(code), code).toEqual([])
    }
  })

  it('is silent for a credential variable', () => {
    expect(
      ids(
        env({
          ANTHROPIC_API_KEY: '1e6',
          ANTHROPIC_AUTH_TOKEN: '64_000',
          CLAUDE_CODE_OAUTH_TOKEN: '1e6',
        }),
      ),
    ).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(env({ A: '1e6' }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the forms of settings-env-value-format`, () => {
  it('leaves a variable whose form rejects the value to settings-env-value-format', () => {
    // These variables take plain digits only, so settings-env-value-format reports the spelling.
    for (const [variable, value] of [
      ['CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS', '9e5'],
      ['CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH', '1e1'],
      ['CLAUDE_CODE_AUTO_COMPACT_WINDOW', '5e5'],
      ['CLAUDE_CODE_TOOL_MEMORY_LIMIT', '4e9'],
    ] as const) {
      expect(ids(env({ [variable]: value })), variable).toEqual([])
      expect(
        lintJson('settings-env-value-format', env({ [variable]: value }), PROJECT).map(
          (m) => m.messageId,
        ),
        variable,
      ).toEqual(['badForm'])
    }
  })

  it('reports a variable whose form accepts the value', () => {
    // The form of `BASH_MAX_OUTPUT_LENGTH` rejects only plain digits above 150000.
    expect(ids(env({ BASH_MAX_OUTPUT_LENGTH: '1e5' }))).toEqual(['spelling'])
    expect(ids(env({ BASH_MAX_OUTPUT_LENGTH: '100_000' }))).toEqual(['spelling'])
    expect(
      lintJson('settings-env-value-format', env({ BASH_MAX_OUTPUT_LENGTH: '1e5' }), PROJECT),
    ).toEqual([])
  })
})

describe(`${name}: the option minVersion`, () => {
  const code = env({ API_TIMEOUT_MS: '1e6' })
  const idsAt = (options: object[], file = PROJECT) =>
    lintWith(code, file, options).map((m) => m.messageId)

  it('reports nothing when minVersion is unset', () => {
    expect(idsAt([])).toEqual([])
    expect(idsAt([{}])).toEqual([])
  })

  it('reports when minVersion is below 2.1.211', () => {
    for (const minVersion of ['2.1.210', '2.0.999', '1.9.9', '2.1.0', '0.0.0']) {
      expect(idsAt([{ minVersion }]), minVersion).toEqual(['spelling'])
    }
  })

  it('reports nothing when minVersion is 2.1.211 or later', () => {
    for (const minVersion of ['2.1.211', '2.1.212', '2.2.0', '3.0.0', '10.0.0']) {
      expect(idsAt([{ minVersion }]), minVersion).toEqual([])
    }
  })

  it('reads minVersion in every settings file and skips a hidden drop-in', () => {
    for (const file of EVERY_FILE) {
      expect(idsAt(OLD, file), file).toEqual(['spelling'])
    }
    expect(idsAt(OLD, HIDDEN)).toEqual([])
  })

  it('rejects a minVersion that is not three numbers', () => {
    for (const minVersion of ['2.1', 'latest', '2.1.211-rc1', '']) {
      expect(() => idsAt([{ minVersion }]), minVersion).toThrow()
    }
  })
})
