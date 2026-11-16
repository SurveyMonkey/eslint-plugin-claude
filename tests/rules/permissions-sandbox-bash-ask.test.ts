// A bare `Bash` ask rule, or `Bash(*)`, is skipped for a command that runs in the sandbox while
// `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is true:
// https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing
// The default of `autoAllowBashIfSandboxed` is `false`, and "Before v2.1.324, the default was
// `true`": https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed
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
const AUTO = { sandbox: { enabled: true, autoAllowBashIfSandboxed: true } }
const REPORTING = { ...ASK, ...AUTO }
const at = (root: string, name_: string, text: string, options: unknown[] = []) =>
  lintJson(name, text, path.join(root, name_), options).map((message) => message.messageId)
const alone = (fields: object | string, name_ = PROJECT, options: unknown[] = []) =>
  at(repo({}), name_, typeof fields === 'string' ? fields : file(fields), options)

describe(`${name}: one file`, () => {
  it('reports a bare Bash ask rule while the sandbox is on', () => {
    expect(alone(REPORTING)).toEqual(['skipped'])
  })

  it('reports Bash(*) with white space around the star', () => {
    for (const rule of ['Bash(*)', 'Bash( * )']) {
      expect(alone({ permissions: { ask: [rule] }, ...AUTO }), rule).toEqual(['skipped'])
    }
  })

  it('reports each such rule, at its line and column', () => {
    const text =
      '{"permissions": {"ask": ["Bash", "Read", "Bash(*)"]}, "sandbox": {"enabled": true, "autoAllowBashIfSandboxed": true}}'
    const messages = lintJson(name, text, '/repo/.claude/settings.json')
    expect(messages.map(({ column }) => column)).toEqual([26, 42])
  })

  it('names the settings that end the skip', () => {
    const [message] = lintJson(name, file(REPORTING), '/repo/.claude/settings.json')
    expect(message?.message).toContain('autoAllowBashIfSandboxed')
  })

  it('is silent when auto-allow is false', () => {
    const sandbox = { enabled: true, autoAllowBashIfSandboxed: false }
    for (const options of [[], [{ minVersion: '2.1.323' }], [{ minVersion: '2.1.324' }]]) {
      expect(alone({ ...ASK, sandbox }, PROJECT, options), JSON.stringify(options)).toEqual([])
    }
  })

  it('is silent when auto-allow is unset, because the default is false from v2.1.324', () => {
    expect(alone({ ...ASK, ...ON })).toEqual([])
    expect(alone({ ...ASK, ...ON }, PROJECT, [{}])).toEqual([])
    expect(alone({ ...ASK, ...ON }, PROJECT, [{ minVersion: '2.1.324' }])).toEqual([])
    expect(alone({ ...ASK, ...ON }, PROJECT, [{ minVersion: '2.2.0' }])).toEqual([])
  })

  it('reports an unset auto-allow when minVersion is older than 2.1.324', () => {
    for (const minVersion of ['2.1.323', '2.1.300', '2.0.0']) {
      expect(alone({ ...ASK, ...ON }, PROJECT, [{ minVersion }]), minVersion).toEqual(['skipped'])
    }
  })

  it('reports when auto-allow is true, with or without minVersion', () => {
    for (const options of [[], [{ minVersion: '2.1.323' }], [{ minVersion: '2.1.324' }]]) {
      expect(alone(REPORTING, PROJECT, options), JSON.stringify(options)).toEqual(['skipped'])
    }
  })

  it('reads auto-allow as true only for the Boolean true', () => {
    for (const value of [null, 'true', 'false', 1]) {
      const sandbox = { enabled: true, autoAllowBashIfSandboxed: value }
      expect(alone({ ...ASK, sandbox }), String(value)).toEqual([])
    }
  })

  it('reports null and a quoted false when minVersion is older than 2.1.324', () => {
    for (const value of [null, 'false']) {
      const sandbox = { enabled: true, autoAllowBashIfSandboxed: value }
      const options = [{ minVersion: '2.1.323' }]
      expect(alone({ ...ASK, sandbox }, PROJECT, options), String(value)).toEqual(['skipped'])
    }
  })

  it('refuses a minVersion that is not major.minor.patch', () => {
    expect(() => alone(REPORTING, PROJECT, [{ minVersion: '2.1' }])).toThrow(
      /match pattern|should be string/,
    )
    expect(() => alone(REPORTING, PROJECT, [{ minVersion: 2 }])).toThrow(
      /match pattern|should be string/,
    )
    expect(() => alone(REPORTING, PROJECT, [{ other: true }])).toThrow(/additional properties/)
  })

  it('is silent when the sandbox is off or unset, or enabled is not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(alone({ ...ASK, sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(alone(ASK)).toEqual([])
  })

  it('is silent for an ask rule with a specifier, for Bash in allow or deny, and for another tool', () => {
    for (const permissions of [
      { ask: ['Bash(git push *)'] },
      { ask: ['PowerShell'] },
      { allow: ['Bash'], deny: ['Bash'] },
    ]) {
      expect(alone({ permissions, ...AUTO }), JSON.stringify(permissions)).toEqual([])
    }
  })

  it('reports in a managed file and a drop-in', () => {
    expect(alone(REPORTING, MANAGED)).toEqual(['skipped'])
    expect(alone(REPORTING, DROP_IN)).toEqual(['skipped'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(REPORTING, 'managed-settings.d/.10-a.json')).toEqual([])
  })

  it('is silent when the root is not an object', () => {
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  it('adds up the ask rule and the sandbox of the two files', () => {
    const root = repo({ [PROJECT]: file(ASK), [LOCAL]: file(AUTO) })
    expect(at(root, PROJECT, file(ASK))).toEqual(['skipped'])
    const swapped = repo({ [PROJECT]: file(AUTO), [LOCAL]: file(ASK) })
    expect(at(swapped, LOCAL, file(ASK))).toEqual(['skipped'])
  })

  it('is silent when the other file turns auto-allow off or the sandbox off', () => {
    for (const sandbox of [{ autoAllowBashIfSandboxed: false }, { enabled: false }]) {
      const root = repo({ [LOCAL]: file({ sandbox }) })
      expect(at(root, PROJECT, file(REPORTING)), JSON.stringify(sandbox)).toEqual([])
    }
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: false } }) })
    expect(at(root, PROJECT, file(REPORTING))).toEqual(['skipped'])
    const off = repo({ [MANAGED]: file(ON) })
    expect(at(off, PROJECT, file(ASK))).toEqual([])
  })

  it('needs auto-allow true in one file of the pair, or a minVersion before 2.1.324', () => {
    const split = repo({ [LOCAL]: file({ sandbox: { autoAllowBashIfSandboxed: true } }) })
    expect(at(split, PROJECT, file({ ...ASK, ...ON }))).toEqual(['skipped'])
    const unset = repo({ [LOCAL]: file(ON) })
    expect(at(unset, PROJECT, file(ASK))).toEqual([])
    expect(at(unset, PROJECT, file(ASK), [{ minVersion: '2.1.323' }])).toEqual(['skipped'])
  })

  it('adds nothing for a sibling that does not read', () => {
    const root = repo({ [LOCAL]: '[1]' })
    expect(at(root, PROJECT, file(ASK))).toEqual([])
  })

  it('is silent when the other file does not read, and reports when it is absent', () => {
    for (const text of ['[1]', '{', '{"sandbox":']) {
      expect(at(repo({ [LOCAL]: text }), PROJECT, file(REPORTING)), text).toEqual([])
    }
    expect(at(repo({}), PROJECT, file(REPORTING))).toEqual(['skipped'])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  it('adds up the ask rule and the sandbox of the files of the source', () => {
    const root = repo({ [MANAGED]: file(AUTO), [DROP_IN]: file(ASK) })
    expect(at(root, DROP_IN, file(ASK))).toEqual(['skipped'])
  })

  it('needs auto-allow true in one file of the source, or a minVersion before 2.1.324', () => {
    const unset = repo({ [MANAGED]: file(ON) })
    expect(at(unset, DROP_IN, file(ASK))).toEqual([])
    expect(at(unset, DROP_IN, file(ASK), [{ minVersion: '2.1.323' }])).toEqual(['skipped'])
    const off = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: false } }) })
    expect(at(off, DROP_IN, file(REPORTING), [{ minVersion: '2.1.323' }])).toEqual([])
  })

  it('is silent when a sibling turns auto-allow off', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: false } }) })
    expect(at(root, DROP_IN, file(REPORTING))).toEqual([])
  })

  // A managed sandbox block reads a quoted "true" or "false" as that Boolean. Another invalid
  // value of a key that loosens the sandbox counts as `false`:
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('reads a quoted Boolean of auto-allow in a managed source', () => {
    const quoted = (value: string) =>
      repo({ [MANAGED]: file({ sandbox: { enabled: true, autoAllowBashIfSandboxed: value } }) })
    expect(at(quoted('true'), DROP_IN, file(ASK))).toEqual(['skipped'])
    for (const value of ['false', 'x']) {
      expect(at(quoted(value), DROP_IN, file(ASK), [{ minVersion: '2.1.323' }]), value).toEqual([])
    }
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: file(AUTO), [LOCAL]: file(AUTO) })
    expect(at(root, MANAGED, file(ASK))).toEqual([])
  })

  it('ignores a hidden sibling and a sibling that does not read', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': file({ sandbox: { enabled: false } }) })
    expect(at(hidden, DROP_IN, file(REPORTING))).toEqual(['skipped'])
    const text = repo({ 'managed-settings.d/20-b.txt': '{' })
    expect(at(text, DROP_IN, file(REPORTING))).toEqual(['skipped'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(bad, DROP_IN, file(REPORTING))).toEqual([])
  })

  it('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({
      'managed-settings.d/20-b.json': file({ sandbox: { autoAllowBashIfSandboxed: false } }),
    })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, file(REPORTING))).toEqual([])
  })
})
