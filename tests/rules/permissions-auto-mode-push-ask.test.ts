// In auto mode, Claude pushes to any branch of the repository without a prompt. An `ask` rule
// such as `Bash(git push *)` is the human checkpoint
// (https://code.claude.com/docs/en/auto-mode-config#add-a-human-checkpoint). A `defaultMode` of
// `auto` takes effect in managed settings and in user settings. It has no effect in the two project
// files, so the rule reads managed files
// (https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in). The files glob
// is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-push-ask'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const OTHER = 'managed-settings.d/20-b.json'
const HIDDEN = 'managed-settings.d/.10-a.json'
const PROJECT = '.claude/settings.json'

const text = (code: unknown) => (typeof code === 'string' ? code : JSON.stringify(code))
const lint = (root: string, file: string, code: unknown) =>
  lintJson(name, text(code), path.join(root, file))
const ids = (root: string, file: string, code: unknown) =>
  lint(root, file, code).map((message) => message.messageId)
const auto = (permissions: object = {}) => ({
  permissions: { defaultMode: 'auto', ...permissions },
})

describe(`${name}: reports`, () => {
  it('reports a managed file with auto mode on and no push rule, at the defaultMode value', () => {
    for (const file of [MANAGED, DROP_IN]) {
      const messages = lint(repo({}), file, '{"permissions": {\n"defaultMode": "auto"}}')
      expect(messages, file).toHaveLength(1)
      expect(messages[0]).toMatchObject({ messageId: 'noPushAsk', line: 2 })
      expect(messages[0]?.message).toContain('Bash(git push *)')
      expect(messages[0]?.message).toContain('permissions.ask')
    }
  })

  it('reports when the rules cover other commands, or only the bare push', () => {
    const rules = {
      ask: ['Bash(git commit *)', 'Bash(git push)', 'Bash(gh pr create *)', 'Read(./git push *)'],
      allow: ['Bash(git push *)'],
      deny: ['Bash(git pull *)', 'Edit(git push *)'],
    }
    expect(ids(repo({}), MANAGED, auto(rules))).toEqual(['noPushAsk'])
  })

  it('reports when a rule has no command words', () => {
    expect(ids(repo({}), MANAGED, auto({ ask: ['Bash()', 'Bash(  )'] }))).toEqual(['noPushAsk'])
  })

  it('reports when a rule is a parameter rule, not a command pattern', () => {
    const ask = ['Bash(run_in_background:true)', 'PowerShell(timeout: *)']
    expect(ids(repo({}), MANAGED, auto({ ask }))).toEqual(['noPushAsk'])
  })

  it('reports when every file that sets defaultMode says auto', () => {
    const root = repo({ [OTHER]: text(auto()) })
    expect(ids(root, DROP_IN, auto())).toEqual(['noPushAsk'])
  })

  it('reports a file of the source that lacks the rule when another file has a hook-free policy', () => {
    const root = repo({
      [OTHER]: text({ hooks: { PostToolUse: [{}] }, sandbox: { enabled: true } }),
    })
    expect(ids(root, MANAGED, auto())).toEqual(['noPushAsk'])
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for each rule that covers a push, in ask or deny, in Bash or PowerShell', () => {
    const covers = [
      'Bash(git push *)',
      'Bash(git push:*)',
      'Bash(git push*)',
      'Bash(git *)',
      'Bash(git:*)',
      'Bash(*)',
      'Bash(* push *)',
      'Bash',
      'PowerShell(git push *)',
      'Bash(  git   push  * )',
    ]
    for (const rule of covers) {
      for (const list of ['ask', 'deny']) {
        expect(ids(repo({}), MANAGED, auto({ [list]: [rule] })), `${list} ${rule}`).toEqual([])
      }
    }
  })

  it('stays silent when auto mode is not on', () => {
    const root = repo({})
    for (const mode of ['default', 'acceptEdits', 'plan', 'Auto', 7, null]) {
      expect(ids(root, MANAGED, { permissions: { defaultMode: mode } }), String(mode)).toEqual([])
    }
    expect(ids(root, MANAGED, {})).toEqual([])
    expect(ids(root, MANAGED, { permissions: [] })).toEqual([])
    expect(ids(root, MANAGED, '[1]')).toEqual([])
  })

  it('stays silent when another file of the source sets another mode', () => {
    const root = repo({ [OTHER]: text({ permissions: { defaultMode: 'default' } }) })
    expect(ids(root, DROP_IN, auto())).toEqual([])
    expect(ids(root, MANAGED, auto())).toEqual([])
  })

  it('stays silent when another file of the source holds the rule', () => {
    const root = repo({ [OTHER]: text({ permissions: { ask: ['Bash(git push *)'] } }) })
    expect(ids(root, DROP_IN, auto())).toEqual([])
    const main = repo({ [MANAGED]: text({ permissions: { deny: ['Bash(git push *)'] } }) })
    expect(ids(main, DROP_IN, auto())).toEqual([])
  })

  it('stays silent with a PreToolUse hook, which can inspect the full command', () => {
    const hook = { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'x' }] }] }
    expect(ids(repo({}), MANAGED, { ...auto(), hooks: hook })).toEqual([])
    const root = repo({ [OTHER]: text({ hooks: hook }) })
    expect(ids(root, DROP_IN, auto())).toEqual([])
    expect(ids(repo({}), MANAGED, { ...auto(), hooks: { PreToolUse: [] } })).toEqual(['noPushAsk'])
  })

  it('stays silent when the source locks auto mode off', () => {
    for (const lock of [
      { disableAutoMode: 'disable' },
      { permissions: { disableAutoMode: 'disable' } },
      { disableAutoMode: 'anything' },
    ]) {
      expect(ids(repo({}), MANAGED, { ...auto(), ...lock })).toEqual([])
    }
    const root = repo({ [OTHER]: text({ disableAutoMode: 'disable' }) })
    expect(ids(root, DROP_IN, auto())).toEqual([])
  })

  it('stays silent in a hidden drop-in, and in a project file where auto has no effect', () => {
    expect(ids(repo({}), HIDDEN, auto())).toEqual([])
    expect(ids(repo({}), PROJECT, auto())).toEqual([])
  })

  it('stays silent when a file of the source cannot be read', () => {
    for (const other of ['[1]', '{']) {
      expect(ids(repo({ [OTHER]: other }), DROP_IN, auto()), other).toEqual([])
    }
  })

  it('reads no project file for a managed file', () => {
    const root = repo({ [PROJECT]: text({ permissions: { ask: ['Bash(git push *)'] } }) })
    expect(ids(root, MANAGED, auto())).toEqual(['noPushAsk'])
  })
})
