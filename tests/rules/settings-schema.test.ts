// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-schema', code, filename).map((m) => m.messageId)

describe('settings-schema (red)', () => {
  it.fails('reports an unknown top-level key', () => {
    expect(ids('{"modle": "opus"}')).toEqual(['unknownKey'])
  })
  it.fails('reports an unknown key inside a documented object', () => {
    expect(ids('{"worktree": {"base": "head"}}')).toEqual(['unknownKey'])
  })
  it.fails('reports an env variable name at the top level', () => {
    expect(ids('{"DISABLE_TELEMETRY": "1"}')).toEqual(['envKey'])
  })
  it.fails('reports a Boolean key that holds a string', () => {
    expect(ids('{"fastMode": "true"}')).toEqual(['wrongType'])
  })
  it.fails('reports a value that is not in an enum', () => {
    expect(ids('{"editorMode": "emacs"}')).toEqual(['notOneOf'])
  })
  it.fails('reports a number out of range', () => {
    expect(ids('{"autoCompactWindow": 5}')).toEqual(['outOfRange'])
  })
  it.fails('reports a missing field of a shape', () => {
    expect(ids('{"statusLine": {"type": "command"}}')).toEqual(['missingField'])
  })
  it.fails('reports a key in a managed file', () => {
    expect(ids('{"modle": "opus"}', 'managed-settings.json')).toEqual(['unknownKey'])
  })
})
