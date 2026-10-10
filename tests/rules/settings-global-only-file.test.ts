// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (code: string, filename: string) =>
  lintJson('settings-global-only-file', code, filename).map((m) => m.messageId)

describe('settings-global-only-file (red)', () => {
  it.fails('reports a keybindings file in a repository', () => {
    expect(ids('{"bindings": []}', '.claude/keybindings.json')).toEqual(['keybindings'])
  })
  it.fails('reports a theme file in a repository', () => {
    expect(ids('{"name": "x"}', '.claude/themes/x.json')).toEqual(['theme'])
  })
  it.fails('reports permissions in a .claude.json', () => {
    expect(ids('{"permissions": {}}', '.claude.json')).toEqual(['settingsKey'])
  })
})
