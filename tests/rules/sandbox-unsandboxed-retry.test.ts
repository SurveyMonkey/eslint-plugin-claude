// While the sandbox is on, Claude can retry a blocked command outside it with
// `dangerouslyDisableSandbox`. Two things stop that: `allowUnsandboxedCommands: false`, and an ask
// (or deny) rule for `Bash(dangerouslyDisableSandbox:true)`:
// https://code.claude.com/docs/en/sandboxing#the-unsandboxed-retry-escape-hatch
// The rule reads the project pair, or one managed source, from disk. The minimal shape
// `{"sandbox": {"enabled": true}}` of the settings reference reports: the default of the key is
// `true`, and that page shows no other value in that example.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-unsandboxed-retry'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const file = (fields: object) => JSON.stringify(fields)
const ON = { sandbox: { enabled: true } }
const ASK = { permissions: { ask: ['Bash(dangerouslyDisableSandbox:true)'] } }
const at = (root: string, name_: string, text: string) =>
  lintJson(name, text, path.join(root, name_))
const ids = (root: string, name_: string, fields: object | string) =>
  at(root, name_, typeof fields === 'string' ? fields : file(fields)).map(
    (message) => message.messageId,
  )
const alone = (fields: object | string, name_ = PROJECT) => ids(repo({}), name_, fields)

describe(`${name}: one file`, () => {
  it('reports the sandbox on with the retry unset, in every kind of file', () => {
    for (const name_ of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(alone(ON, name_), name_).toEqual(['retry'])
    }
  })

  it('reports at the value of enabled', () => {
    const text = '{\n  "sandbox": {\n    "enabled": true\n  }\n}'
    const [message] = lintJson(name, text, '/repo/.claude/settings.json')
    expect([message?.line, message?.column]).toEqual([3, 16])
    expect(message?.message).toContain('allowUnsandboxedCommands')
    expect(message?.message).toContain('Bash(dangerouslyDisableSandbox:true)')
  })

  it('reports when the retry is true, null, or not a Boolean, in a project file', () => {
    for (const value of [true, null, 'false', 0]) {
      const sandbox = { enabled: true, allowUnsandboxedCommands: value }
      expect(alone({ sandbox }), JSON.stringify(value)).toEqual(['retry'])
    }
  })

  it('reports when the ask rule is for another command, another parameter, or is an allow rule', () => {
    for (const permissions of [
      { ask: ['Bash(git push *)'] },
      { ask: ['Bash'] },
      { ask: ['Bash(run_in_background:true)'] },
      { ask: ['Bash(dangerouslyDisableSandbox:false)'] },
      { allow: ['Bash(dangerouslyDisableSandbox:true)'] },
      { ask: ['Read(dangerouslyDisableSandbox:true)'] },
      { ask: [1, null] },
    ]) {
      expect(alone({ ...ON, permissions }), JSON.stringify(permissions)).toEqual(['retry'])
    }
  })

  it('is silent when the retry is false', () => {
    expect(alone({ sandbox: { enabled: true, allowUnsandboxedCommands: false } })).toEqual([])
  })

  it('is silent for the managed example of the docs', () => {
    expect(
      alone({
        sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false },
      }),
    ).toEqual([])
  })

  it('is silent when an ask or deny rule names the parameter', () => {
    for (const permissions of [
      ASK.permissions,
      { deny: ['Bash(dangerouslyDisableSandbox:true)'] },
      { ask: ['Bash(dangerouslyDisableSandbox:*)'] },
      { ask: ['PowerShell(dangerouslyDisableSandbox:true)'] },
      { ask: ['Monitor(dangerouslyDisableSandbox:true)'] },
      { ask: ['Bash(dangerouslyDisableSandbox: true)'] },
      { ask: ['Bash( dangerouslyDisableSandbox:true )'] },
    ]) {
      expect(alone({ ...ON, permissions }), JSON.stringify(permissions)).toEqual([])
    }
  })

  it('reports a rule that only looks like the parameter rule', () => {
    for (const rule of [
      'Bash(dangerouslyDisableSandbox:truex)',
      'Bash(foo dangerouslyDisableSandbox:true)',
      'Bash(dangerouslyDisableSandbox:false)',
      'Read(dangerouslyDisableSandbox:true)',
    ]) {
      expect(alone({ ...ON, permissions: { ask: [rule] } }), rule).toEqual(['retry'])
    }
  })

  it('does not close the retry with an explicit true, or an allow rule for the parameter', () => {
    expect(alone({ sandbox: { enabled: true, allowUnsandboxedCommands: true } })).toEqual(['retry'])
    expect(
      alone({ ...ON, permissions: { allow: ['Bash(dangerouslyDisableSandbox:true)'] } }),
    ).toEqual(['retry'])
  })

  it('is silent when the sandbox is off, unset, or not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(alone({ sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(alone({})).toEqual([])
    expect(alone('[1]')).toEqual([])
  })

  it('counts managed values as the managed settings page says', () => {
    // A quoted "true" is true. A quoted "false", and any other invalid value of the retry, is false.
    expect(alone({ sandbox: { enabled: 'true' } }, MANAGED)).toEqual(['retry'])
    expect(alone({ sandbox: { enabled: 1 } }, MANAGED)).toEqual(['retry'])
    for (const value of ['false', 'x', 5]) {
      const sandbox = { enabled: true, allowUnsandboxedCommands: value }
      expect(alone({ sandbox }, MANAGED), String(value)).toEqual([])
    }
    expect(
      alone({ sandbox: { enabled: true, allowUnsandboxedCommands: 'true' } }, MANAGED),
    ).toEqual(['retry'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(ON, HIDDEN)).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  it('reports in the file that enables the sandbox, and not in the other', () => {
    const root = repo({ [LOCAL]: file({}) })
    expect(ids(root, PROJECT, ON)).toEqual(['retry'])
    expect(ids(repo({ [PROJECT]: file(ON) }), LOCAL, {})).toEqual([])
  })

  it('is silent when the other file turns the retry off or holds the rule', () => {
    const off = repo({ [LOCAL]: file({ sandbox: { allowUnsandboxedCommands: false } }) })
    expect(ids(off, PROJECT, ON)).toEqual([])
    expect(ids(repo({ [LOCAL]: file(ASK) }), PROJECT, ON)).toEqual([])
    expect(ids(repo({ [PROJECT]: file(ASK) }), LOCAL, ON)).toEqual([])
  })

  it('is silent when the other file turns the sandbox off', () => {
    const root = repo({ [LOCAL]: file({ sandbox: { enabled: false } }) })
    expect(ids(root, PROJECT, ON)).toEqual([])
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { allowUnsandboxedCommands: false } }) })
    expect(ids(root, PROJECT, ON)).toEqual(['retry'])
  })

  it('is silent when the other file does not read', () => {
    for (const text of ['[1]', '{', '{"sandbox":']) {
      expect(ids(repo({ [LOCAL]: text }), PROJECT, ON), text).toEqual([])
    }
  })
})

describe(`${name}: a managed source, on disk`, () => {
  it('is silent when a file of the source turns the retry off or holds the rule', () => {
    const off = repo({ [MANAGED]: file({ sandbox: { allowUnsandboxedCommands: false } }) })
    expect(ids(off, DROP_IN, ON)).toEqual([])
    expect(ids(repo({ [DROP_IN]: file(ASK) }), MANAGED, ON)).toEqual([])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: file({ sandbox: { allowUnsandboxedCommands: false } }) })
    expect(ids(root, MANAGED, ON)).toEqual(['retry'])
  })

  it('ignores a hidden sibling, and is silent when a sibling does not read', () => {
    const hidden = repo({
      'managed-settings.d/.20-b.json': file({ sandbox: { allowUnsandboxedCommands: false } }),
    })
    expect(ids(hidden, DROP_IN, ON)).toEqual(['retry'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(ids(bad, DROP_IN, ON)).toEqual([])
  })
})
