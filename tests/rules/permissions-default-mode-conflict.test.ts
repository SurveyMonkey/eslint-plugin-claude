// `disableBypassPermissionsMode: "disable"` stops anyone from entering bypassPermissions mode:
// https://code.claude.com/docs/en/settings-reference#permissionsdisablebypasspermissionsmode
// The lock takes the strictest value of any source. `defaultMode` comes from the highest source
// that sets it, so a sibling file of a managed source can change it:
// https://code.claude.com/docs/en/settings-reference#managed-settings-precedence
// The pair `disableAutoMode` with `defaultMode: "auto"` is for `settings-conflicting-keys`.
// The tests of a managed source use files on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-default-mode-conflict'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const LOCKED = { defaultMode: 'bypassPermissions', disableBypassPermissionsMode: 'disable' }

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const permissions = (fields: object) => ({ permissions: fields })

describe(`${name}: bypassPermissions with the lock`, () => {
  it.fails('reports defaultMode when the lock is disable, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(permissions(LOCKED), file), file).toEqual(['bypass'])
    }
  })

  it.fails('reports the key defaultMode, at its line and column', () => {
    const text =
      '{\n  "permissions": {\n    "disableBypassPermissionsMode": "disable",\n    "defaultMode": "bypassPermissions"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[4, 5]])
  })

  it.fails('says that Claude Code never enters the mode', () => {
    const [message] = lint(permissions(LOCKED))
    expect(message?.message).toContain('never enters')
  })

  it.fails('is silent for another defaultMode', () => {
    for (const value of ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'manual', true]) {
      const code = permissions({ ...LOCKED, defaultMode: value })
      expect(ids(code), String(value)).toEqual([])
    }
  })

  it.fails('is silent for a lock that is not disable, or unset', () => {
    for (const value of [true, 'enable', 'Disable', null]) {
      const code = permissions({ ...LOCKED, disableBypassPermissionsMode: value })
      expect(ids(code), String(value)).toEqual([])
    }
    expect(ids(permissions({ defaultMode: 'bypassPermissions' }))).toEqual([])
    expect(ids(permissions({ disableBypassPermissionsMode: 'disable' }))).toEqual([])
  })

  it.fails('is silent when defaultMode is null', () => {
    expect(ids(permissions({ ...LOCKED, defaultMode: null }))).toEqual([])
  })

  it.fails('is silent for the pair of auto: settings-conflicting-keys reports it', () => {
    const code = { disableAutoMode: 'disable', permissions: { defaultMode: 'auto' } }
    const nested = permissions({ disableAutoMode: 'disable', defaultMode: 'auto' })
    expect(ids(code)).toEqual([])
    expect(ids(nested)).toEqual([])
  })

  it.fails('is silent for a lock at the top level: it is no key there', () => {
    const code = {
      disableBypassPermissionsMode: 'disable',
      permissions: { defaultMode: 'bypassPermissions' },
    }
    expect(ids(code)).toEqual([])
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it.fails('is silent when permissions is not an object', () => {
    expect(ids({ permissions: 'x' })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
    expect(ids({})).toEqual([])
  })

  it.fails('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
  })

  it.fails('reads the last of two keys of one name', () => {
    const lock = '"disableBypassPermissionsMode": "disable"'
    const mode = '"defaultMode": "bypassPermissions"'
    expect(ids(`{"permissions": {${lock}, ${mode}, "defaultMode": "plan"}}`)).toEqual([])
    expect(ids(`{"permissions": {${lock}, "defaultMode": "plan", ${mode}}}`)).toEqual(['bypass'])
    expect(
      ids(`{"permissions": {${lock}, "disableBypassPermissionsMode": null, ${mode}}}`),
    ).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(permissions(LOCKED), HIDDEN)).toEqual([])
  })
})

// The managed settings page merges `managed-settings.json` and its drop-ins into one source.
describe(`${name}: the sibling files of a managed source, on disk`, () => {
  const TEXT = JSON.stringify(permissions(LOCKED))
  /** The message ids for `text` at `file` of the repository `root`. */
  const at = (root: string, file: string, text = TEXT) =>
    lintJson(name, text, path.join(root, file)).map((message) => message.messageId)

  it.fails('reports when no sibling sets defaultMode', () => {
    const root = repo({
      'managed-settings.d/20-b.json': '{"model": "opus", "permissions": {"deny": ["Bash"]}}',
      'managed-settings.d/30-c.json': '{"permissions": "x"}',
    })
    expect(at(root, 'managed-settings.json')).toEqual(['bypass'])
    expect(at(root, 'managed-settings.d/10-a.json')).toEqual(['bypass'])
  })

  it.fails('is silent when a sibling sets defaultMode again: the source decides the mode', () => {
    for (const sibling of [
      '{"permissions": {"defaultMode": "plan"}}',
      '{"permissions": {"defaultMode": null}}',
    ]) {
      const dropIn = repo({ 'managed-settings.d/20-b.json': sibling })
      expect(at(dropIn, 'managed-settings.d/10-a.json'), sibling).toEqual([])
      expect(at(dropIn, 'managed-settings.json'), sibling).toEqual([])
      const main = repo({ 'managed-settings.json': sibling })
      expect(at(main, 'managed-settings.d/10-a.json'), sibling).toEqual([])
    }
  })

  it.fails('ignores a hidden sibling and a sibling that does not end in .json', () => {
    const root = repo({
      'managed-settings.d/.20-b.json': '{"permissions": {"defaultMode": "plan"}}',
      'managed-settings.d/30-c.txt': '{"permissions": {"defaultMode": "plan"}}',
    })
    expect(at(root, 'managed-settings.d/10-a.json')).toEqual(['bypass'])
  })

  it.fails('is silent when a sibling does not parse to an object', () => {
    const root = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(root, 'managed-settings.d/10-a.json')).toEqual([])
  })

  it.fails('is silent when the drop-in directory is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'managed-settings.d/20-b.json': '{}' })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, 'managed-settings.json')).toEqual([])
  })

  it.fails('does not read the siblings for a project file', () => {
    const root = repo({ 'managed-settings.json': '{"permissions": {"defaultMode": "plan"}}' })
    expect(at(root, '.claude/settings.json')).toEqual(['bypass'])
  })
})
