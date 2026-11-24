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

  it('reads auto-allow as true only for the Boolean true in a project file', () => {
    for (const value of [null, 'true', 'false', 1]) {
      const sandbox = { enabled: true, autoAllowBashIfSandboxed: value }
      expect(alone({ ...ASK, sandbox }), String(value)).toEqual([])
    }
  })

  it('reports a non-Boolean in a project file when minVersion is older than 2.1.324', () => {
    for (const value of [null, 'true', 'false']) {
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
      const auto = { ...sandbox, autoAllowBashIfSandboxed: true }
      expect(alone({ ...ASK, sandbox: auto }), JSON.stringify(auto)).toEqual([])
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

  // "If you set a Boolean key to a quoted `"true"` or `"false"`, the value counts as that Boolean."
  // "A key that turns the sandbox ... on, such as `enabled` ..., counts as `true`." So a managed
  // `enabled` of "true" or 1 is on, and a quoted "false" is off:
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('reads a quoted or invalid enabled in a managed source as on', () => {
    for (const enabled of ['true', 1]) {
      const sandbox = { enabled, autoAllowBashIfSandboxed: true }
      expect(alone({ ...ASK, sandbox }, MANAGED), String(enabled)).toEqual(['skipped'])
      expect(alone({ ...ASK, sandbox }, DROP_IN), String(enabled)).toEqual(['skipped'])
      const floor = [{ minVersion: '2.1.283' }]
      expect(alone({ ...ASK, sandbox }, MANAGED, floor), String(enabled)).toEqual(['skipped'])
    }
  })

  // "This per-field handling requires Claude Code v2.1.283 or later. On versions before v2.1.283,
  // Claude Code drops every `sandbox` field except `credentials` when a value outside
  // `credentials` is invalid." So an invalid `enabled` turns the sandbox off there:
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('is silent for an invalid managed enabled when minVersion is older than 2.1.283', () => {
    for (const enabled of ['true', 1, 'false']) {
      const sandbox = { enabled, autoAllowBashIfSandboxed: true }
      const options = [{ minVersion: '2.1.282' }]
      expect(alone({ ...ASK, sandbox }, MANAGED, options), String(enabled)).toEqual([])
      const root = repo({ [MANAGED]: file({ sandbox }) })
      expect(at(root, DROP_IN, file(REPORTING), options), String(enabled)).toEqual([])
    }
    expect(alone(REPORTING, MANAGED, [{ minVersion: '2.1.282' }])).toEqual(['skipped'])
    // A sibling that does not set `enabled` holds no invalid value, so it drops no block.
    const unset = repo({ [MANAGED]: file(ASK) })
    expect(at(unset, DROP_IN, file(REPORTING), [{ minVersion: '2.1.282' }])).toEqual(['skipped'])
    // The text names the managed block only. In a project pair, a quoted "true" is no value.
    const pair = repo({ [LOCAL]: file({ sandbox: { enabled: 'true' } }) })
    expect(at(pair, PROJECT, file(REPORTING), [{ minVersion: '2.1.282' }])).toEqual(['skipped'])
  })

  // The same text: a quoted "true" of `autoAllowBashIfSandboxed` is invalid before v2.1.283. So it
  // drops `enabled` too, and the sandbox is off:
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('is silent for a quoted managed auto-allow when minVersion is older than 2.1.283', () => {
    const sandbox = { enabled: true, autoAllowBashIfSandboxed: 'true' }
    expect(alone({ ...ASK, sandbox }, MANAGED, [{ minVersion: '2.1.282' }])).toEqual([])
    expect(alone({ ...ASK, sandbox }, MANAGED, [{ minVersion: '2.1.283' }])).toEqual(['skipped'])
    const root = repo({ [MANAGED]: file({ sandbox: { autoAllowBashIfSandboxed: 'true' } }) })
    expect(at(root, DROP_IN, file(REPORTING), [{ minVersion: '2.1.282' }])).toEqual([])
  })

  // The same text: a value of any other managed `sandbox` field outside `credentials` that is
  // invalid also drops `enabled` before v2.1.283. An unknown key is not invalid, and the rule
  // does not read `credentials`:
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('is silent for an invalid value of another managed field before v2.1.283', () => {
    const before = [{ minVersion: '2.1.282' }]
    const floor = [{ minVersion: '2.1.283' }]
    const block = (extra: object) => ({ ...ASK, sandbox: { ...AUTO.sandbox, ...extra } })
    for (const extra of [{ excludedCommands: 'x' }, { excludedCommands: [1] }]) {
      const text = JSON.stringify(extra)
      expect(alone(block(extra), MANAGED, before), text).toEqual([])
      expect(alone(block(extra), MANAGED, floor), text).toEqual(['skipped'])
      const root = repo({ [MANAGED]: file({ sandbox: extra }) })
      expect(at(root, DROP_IN, file(REPORTING), before), text).toEqual([])
    }
    const kept = [{ foo: 1 }, { credentials: { files: 'x' } }, { excludedCommands: ['git'] }]
    for (const extra of kept) {
      const text = JSON.stringify(extra)
      expect(alone(block(extra), MANAGED, before), text).toEqual(['skipped'])
      expect(alone(block(extra), MANAGED, floor), text).toEqual(['skipped'])
    }
    // A project file keeps its report: the drop is a managed behaviour.
    expect(alone(block({ excludedCommands: 'x' }), PROJECT, before)).toEqual(['skipped'])
  })

  // The docs name no `null` inside `sandbox`. For a top-level key, "A `null` removes the key":
  // https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed
  // The rule reads a `null` in `sandbox` the same way, so it drops no block.
  it('reads a managed null enabled as unset when minVersion is older than 2.1.283', () => {
    const root = repo({ [MANAGED]: file({ sandbox: { enabled: null } }) })
    expect(at(root, DROP_IN, file(REPORTING), [{ minVersion: '2.1.282' }])).toEqual(['skipped'])
  })

  // The default of `sandbox.enabled` is `false`:
  // https://code.claude.com/docs/en/settings-reference#sandbox-enabled
  it('is silent when no file of a managed source sets enabled', () => {
    const sandbox = { autoAllowBashIfSandboxed: true }
    expect(alone({ ...ASK, sandbox }, MANAGED)).toEqual([])
    expect(alone({ ...ASK, sandbox }, DROP_IN)).toEqual([])
  })

  // "If you set a Boolean key to a quoted `"true"` or `"false"`, the value counts as that Boolean":
  // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
  it('is silent when a managed drop-in sets enabled to a quoted "false"', () => {
    const root = repo({ 'managed-settings.d/20-b.json': file({ sandbox: { enabled: 'false' } }) })
    expect(at(root, DROP_IN, file(REPORTING))).toEqual([])
    expect(at(root, MANAGED, file(REPORTING))).toEqual([])
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
