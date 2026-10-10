// A bare `Bash` ask rule, or `Bash(*)`, is skipped for a command that runs in the sandbox while
// `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is not false:
// https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing
// The rule adds up the project pair, or one managed source. The tests of a source use files on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-sandbox-bash-ask'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'

const file = (fields: object) => JSON.stringify(fields)
const ASK = { permissions: { ask: ['Bash'] } }
const ON = { sandbox: { enabled: true } }
const REPORTING = { ...ASK, ...ON }
const at = (root: string, name_: string, text: string) =>
  lintJson(name, text, path.join(root, name_)).map((message) => message.messageId)
const alone = (fields: object | string, name_ = PROJECT) =>
  at(repo({}), name_, typeof fields === 'string' ? fields : file(fields))

describe(`${name}: one file`, () => {
  it.fails('reports a bare Bash ask rule while the sandbox is on', () => {
    expect(alone(REPORTING)).toEqual(['skipped'])
  })

  it.fails('reports Bash(*) with white space around the star', () => {
    for (const rule of ['Bash(*)', 'Bash( * )']) {
      expect(alone({ permissions: { ask: [rule] }, ...ON }), rule).toEqual(['skipped'])
    }
  })

  it.fails('reports each such rule, at its line and column', () => {
    const text =
      '{"permissions": {"ask": ["Bash", "Read", "Bash(*)"]}, "sandbox": {"enabled": true}}'
    const messages = lintJson(name, text, '/repo/.claude/settings.json')
    expect(messages.map(({ column }) => column)).toEqual([26, 42])
  })

  it.fails('names the settings that end the skip', () => {
    const [message] = lintJson(name, file(REPORTING), '/repo/.claude/settings.json')
    expect(message?.message).toContain('autoAllowBashIfSandboxed')
  })

  it.fails('is silent when auto-allow is false', () => {
    expect(
      alone({ ...REPORTING, sandbox: { enabled: true, autoAllowBashIfSandboxed: false } }),
    ).toEqual([])
  })

  it.fails('reports when auto-allow is true, null, or a value that sandbox-schema reports', () => {
    for (const value of [true, null, 'false']) {
      const sandbox = { enabled: true, autoAllowBashIfSandboxed: value }
      expect(alone({ ...ASK, sandbox }), String(value)).toEqual(['skipped'])
    }
  })

  it.fails('is silent when the sandbox is off or unset, or enabled is not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(alone({ ...ASK, sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(alone(ASK)).toEqual([])
  })

  it.fails('is silent for an ask rule with a specifier, for Bash in allow or deny, and for another tool', () => {
    for (const permissions of [
      { ask: ['Bash(git push *)'] },
      { ask: ['PowerShell'] },
      { allow: ['Bash'], deny: ['Bash'] },
    ]) {
      expect(alone({ permissions, ...ON }), JSON.stringify(permissions)).toEqual([])
    }
  })

  it.fails('reports in a managed file and a drop-in', () => {
    expect(alone(REPORTING, MANAGED)).toEqual(['skipped'])
    expect(alone(REPORTING, DROP_IN)).toEqual(['skipped'])
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(alone(REPORTING, 'managed-settings.d/.10-a.json')).toEqual([])
  })

  it.fails('is silent when the root is not an object', () => {
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  it.fails('adds up the ask rule and the sandbox of the two files', () => {
    const root = repo({ [PROJECT]: file(ASK), [LOCAL]: file(ON) })
    expect(at(root, PROJECT, file(ASK))).toEqual(['skipped'])
    const swapped = repo({ [PROJECT]: file(ON), [LOCAL]: file(ASK) })
    expect(at(swapped, LOCAL, file(ASK))).toEqual(['skipped'])
  })

  it.fails('is silent when the other file turns auto-allow off or the sandbox off', () => {
    for (const sandbox of [{ autoAllowBashIfSandboxed: false }, { enabled: false }]) {
      const root = repo({ [LOCAL]: file({ sandbox }) })
      expect(at(root, PROJECT, file(REPORTING)), JSON.stringify(sandbox)).toEqual([])
    }
  })

  it.fails('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: false } }) })
    expect(at(root, PROJECT, file(REPORTING))).toEqual(['skipped'])
    const off = repo({ [MANAGED]: file(ON) })
    expect(at(off, PROJECT, file(ASK))).toEqual([])
  })

  it.fails('adds nothing for a sibling that does not read', () => {
    const root = repo({ [LOCAL]: '[1]' })
    expect(at(root, PROJECT, file(REPORTING))).toEqual(['skipped'])
    expect(at(root, PROJECT, file(ASK))).toEqual([])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  it.fails('adds up the ask rule and the sandbox of the files of the source', () => {
    const root = repo({ [MANAGED]: file(ON), [DROP_IN]: file(ASK) })
    expect(at(root, DROP_IN, file(ASK))).toEqual(['skipped'])
  })

  it.fails('is silent when a sibling turns auto-allow off', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: false } }) })
    expect(at(root, DROP_IN, file(REPORTING))).toEqual([])
  })

  it.fails('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: file(ON), [LOCAL]: file(ON) })
    expect(at(root, MANAGED, file(ASK))).toEqual([])
  })

  it.fails('ignores a hidden sibling and a sibling that does not read', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': file({ sandbox: { enabled: false } }) })
    expect(at(hidden, DROP_IN, file(REPORTING))).toEqual(['skipped'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(bad, DROP_IN, file(REPORTING))).toEqual(['skipped'])
  })

  it.fails('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({
      'managed-settings.d/20-b.json': file({ sandbox: { autoAllowBashIfSandboxed: false } }),
    })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, file(REPORTING))).toEqual(['skipped'])
  })
})
