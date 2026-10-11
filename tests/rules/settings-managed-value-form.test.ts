// The expected values come from the server-managed settings page
// (https://code.claude.com/docs/en/server-managed-settings#environment-variables-and-the-approval-dialog):
// Claude Code decides by the delivered value whether `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`,
// `DISABLE_ERROR_REPORTING`, `DISABLE_TELEMETRY` and `DO_NOT_TRACK` need approval. "A truthy value
// such as `1` or `true` only turns tracking, reporting, or other nonessential traffic off, so Claude
// Code applies it without asking the user. For any other non-empty value, Claude Code shows the
// dialog." The files glob is in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-managed-value-form'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const env = (variables: object) => JSON.stringify({ env: variables })
const lint = (code: string, file = MANAGED) => lintJson(name, code, file)
const ids = (code: string, file = MANAGED) => lint(code, file).map((m) => m.messageId)

const TOGGLES = [
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_ERROR_REPORTING',
  'DISABLE_TELEMETRY',
  'DO_NOT_TRACK',
]

describe(`${name}: the privacy toggles`, () => {
  it('reports a value that is not truthy, for each toggle and each managed file', () => {
    for (const file of [MANAGED, DROP_IN]) {
      for (const toggle of TOGGLES) {
        expect(ids(env({ [toggle]: '0' }), file), `${file} ${toggle}`).toEqual(['approval'])
      }
    }
  })

  it('reports a falsy word and other text', () => {
    for (const value of ['0', 'false', 'FALSE', 'no', 'off', 'maybe', '2', 'enabled', ' 1', '1 ']) {
      expect(ids(env({ DISABLE_TELEMETRY: value })), JSON.stringify(value)).toEqual(['approval'])
    }
  })

  it('is silent for a truthy value and for an empty value', () => {
    for (const value of ['1', 'true', 'TRUE', 'True', 'yes', 'on', 'ON', '']) {
      expect(ids(env({ DISABLE_TELEMETRY: value })), JSON.stringify(value)).toEqual([])
    }
  })

  it('names the variable and the value', () => {
    const [message] = lint(env({ DO_NOT_TRACK: 'off' }))
    expect(message?.message).toBe(
      'Server-managed settings can show the user an approval dialog for the value "off" of "DO_NOT_TRACK". Only a truthy value such as 1 or true applies without it.',
    )
  })

  it('reports on the value', () => {
    const [message] = lint('{\n  "env": { "DISABLE_TELEMETRY": "0" }\n}')
    expect([message?.line, message?.column]).toEqual([2, 33])
  })

  it('is silent for another variable', () => {
    expect(ids(env({ DISABLE_AUTO_COMPACT: '0', DISABLE_PROMPT_CACHING: 'off' }))).toEqual([])
  })

  it('is silent for a value that is not a string', () => {
    for (const value of [0, 1, true, false, null, ['0'], { a: '0' }]) {
      expect(ids(env({ DISABLE_TELEMETRY: value })), JSON.stringify(value)).toEqual([])
    }
  })

  it('reports each toggle once, and the last of two keys of one name', () => {
    expect(
      ids(env({ DISABLE_TELEMETRY: '0', DO_NOT_TRACK: 'no', DISABLE_ERROR_REPORTING: '1' })),
    ).toEqual(['approval', 'approval'])
    expect(ids('{"env": {"DISABLE_TELEMETRY": "0", "DISABLE_TELEMETRY": "1"}}')).toEqual([])
    expect(ids('{"env": {"DISABLE_TELEMETRY": "1", "DISABLE_TELEMETRY": "0"}}')).toEqual([
      'approval',
    ])
    expect(ids('{"env": {"DISABLE_TELEMETRY": "0"}, "env": {"DISABLE_TELEMETRY": "1"}}')).toEqual(
      [],
    )
  })

  it('is silent when env is missing or is not an object', () => {
    for (const code of [
      '{}',
      '{"env": null}',
      '{"env": "DISABLE_TELEMETRY=0"}',
      '{"env": []}',
      '[]',
    ]) {
      expect(ids(code), code).toEqual([])
    }
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(env({ DISABLE_TELEMETRY: '0' }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: a quoted Boolean`, () => {
  it('leaves a quoted Boolean to settings-schema', () => {
    // The managed settings page: a quoted "true" or "false" reads as that Boolean, with a notice
    // in /status. `settings-schema` reports the string where a key takes a Boolean. This rule adds
    // no second report.
    const code = '{"verbose": "true", "env": {"DISABLE_TELEMETRY": "1"}}'
    expect(ids(code)).toEqual([])
    expect(lintJson('settings-schema', code, MANAGED).map((m) => m.messageId)).toEqual([
      'wrongType',
    ])
  })
})
