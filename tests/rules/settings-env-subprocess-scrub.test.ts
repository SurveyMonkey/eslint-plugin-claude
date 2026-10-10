// The expected values come from the env vars reference
// (https://code.claude.com/docs/en/env-vars#variables): "Set to `1` to strip credentials from the
// environments of the subprocesses Claude Code starts", and a Boolean variable is on for `1`,
// `true`, `yes` and `on` with any letter case. The rule reads the shared file only. The file
// globs are in `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const project = '/repo/.claude/settings.json'
const env = (value: unknown) => JSON.stringify({ env: { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: value } })
const ids = (code: string, filename = project) =>
  lintJson('settings-env-subprocess-scrub', code, filename).map((m) => m.messageId)

describe('settings-env-subprocess-scrub', () => {
  it.each(['1', 'true', 'Yes', 'ON'])('stays silent when the variable is %s', (value) => {
    expect(ids(env(value))).toEqual([])
  })

  it('reports a file with no env, an env without the variable, and an env that is no object', () => {
    for (const code of ['{}', '{"env": {}}', '{"env": {"OTHER": "1"}}', '{"env": "1"}']) {
      expect(ids(code), code).toEqual(['scrub'])
    }
  })

  it.each(['0', 'false', '', '2', 'x'])('reports the value %j, on the value', (value) => {
    const [message] = lintJson('settings-env-subprocess-scrub', env(value), project)
    expect(message?.messageId).toBe('scrub')
    expect([message?.line, message?.column]).toEqual([1, 44])
  })

  it('reports a file with no variable on the whole file', () => {
    const [message] = lintJson('settings-env-subprocess-scrub', '\n{}', project)
    expect([message?.line, message?.column]).toEqual([2, 1])
  })

  it('leaves a value that is not a string to settings-env-value-format', () => {
    for (const value of [1, true, null, ['1']]) {
      expect(ids(env(value)), JSON.stringify(value)).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    const twice = (a: string, b: string) =>
      `{"env": {"CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "${a}", "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "${b}"}}`
    expect(ids(twice('0', '1'))).toEqual([])
    expect(ids(twice('1', '0'))).toEqual(['scrub'])
  })

  it('is silent when the file is not an object', () => {
    expect(ids('[]')).toEqual([])
  })
})
