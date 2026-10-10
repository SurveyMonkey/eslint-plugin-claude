// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#managedsourcesbehavior): Claude Code reads
// the key from the highest-priority source that carries it or a policy key, and "a
// `managed-settings.json` file is the lowest-ranked admin source". The managed settings page puts
// `managed-settings.d/*.json` and `managed-settings.json` in one source
// (https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources). The
// rule reads drop-ins; `settings-managed-file` owns `managed-settings.json`. The file globs are in
// `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const DROP_IN = '/repo/managed-settings.d/10-a.json'
const merge = (value: unknown) => JSON.stringify({ managedSourcesBehavior: value })
const ids = (code: string, filename = DROP_IN) =>
  lintJson('settings-managed-merge', code, filename).map((m) => m.messageId)

describe('settings-managed-merge', () => {
  it('reports merge in a drop-in, on the value', () => {
    const [message] = lintJson(
      'settings-managed-merge',
      `{\n  "managedSourcesBehavior": "merge"\n}`,
      DROP_IN,
    )
    expect(message?.messageId).toBe('merge')
    expect([message?.line, message?.column]).toEqual([2, 29])
  })

  it('reports a drop-in that is named managed-settings.json', () => {
    expect(ids(merge('merge'), '/repo/managed-settings.d/managed-settings.json')).toEqual(['merge'])
  })

  it('is silent for the other values, and for a value of another type', () => {
    for (const value of ['first-wins', 'Merge', '', null, true, ['merge']]) {
      expect(ids(merge(value)), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent when the key is unset', () => {
    expect(ids('{}')).toEqual([])
    expect(ids('{"permissions": {"allow": ["merge"]}}')).toEqual([])
  })

  it('leaves managed-settings.json to settings-managed-file', () => {
    expect(ids(merge('merge'), '/repo/managed-settings.json')).toEqual([])
  })

  it('reads no hidden drop-in', () => {
    expect(ids(merge('merge'), '/repo/managed-settings.d/.20-hidden.json')).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(
      ids('{"managedSourcesBehavior": "merge", "managedSourcesBehavior": "first-wins"}'),
    ).toEqual([])
    expect(
      ids('{"managedSourcesBehavior": "first-wins", "managedSourcesBehavior": "merge"}'),
    ).toEqual(['merge'])
  })
})
