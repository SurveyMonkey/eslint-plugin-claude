// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename = '.claude/settings.json') =>
  lintJson('settings-schema-url', code, filename).map((m) => m.messageId)

describe('settings-schema-url (red)', () => {
  it.fails('reports a file with no $schema', () => {
    expect(ids('{"model": "opus"}')).toEqual(['missing'])
  })
  it.fails('reports a $schema with another URL', () => {
    expect(ids('{"$schema": "https://example.com/s.json"}')).toEqual(['wrongUrl'])
  })
  it.fails('reports a file with no $schema in a managed file', () => {
    expect(ids('{}', 'managed-settings.json')).toEqual(['missing'])
  })
})
