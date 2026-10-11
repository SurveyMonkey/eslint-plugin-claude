// With `sandbox.filesystem.disabled` set to `true`, Claude Code does not enforce `denyRead` or the
// `deny` entries of `credentials.files`. Only user settings, managed settings and `--settings` can
// set the key. A project or local file cannot, so the rule reads managed files:
// https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-disabled
// https://code.claude.com/docs/en/sandboxing#which-settings-can-disable-it
// https://code.claude.com/docs/en/sandboxing#what-changes-when-filesystem-isolation-is-off
// A quoted Boolean in a managed `sandbox` block counts as that Boolean:
// https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-filesystem-disabled-conflict'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const MANAGED_FILES = [MANAGED, DROP_IN]

const lint = (code: unknown, file = MANAGED) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = MANAGED) => lint(code, file).map((message) => message.messageId)
const DENY_FILE = { path: '~/.aws/credentials', mode: 'deny' }
const MASK_FILE = { path: '~/.config/gh/hosts.yml', mode: 'mask' }
const sandbox = (filesystem: object, credentials?: object) => ({
  sandbox: { filesystem, ...(credentials && { credentials }) },
})

describe(`${name}: a file that Claude Code reads the key from`, () => {
  it('reports disabled with a denyRead entry, in each managed file', () => {
    for (const file of MANAGED_FILES) {
      const code = sandbox({ disabled: true, denyRead: ['~/.aws'] })
      expect(ids(code, file), file).toEqual(['conflict'])
    }
  })

  it('reports disabled with a deny entry in credentials.files', () => {
    const code = sandbox({ disabled: true }, { files: [MASK_FILE, DENY_FILE] })
    expect(ids(code)).toEqual(['conflict'])
  })

  it('reports one fault for both kinds of entry, and names both', () => {
    const code = sandbox({ disabled: true, denyRead: ['~/.ssh'] }, { files: [DENY_FILE] })
    const messages = lint(code)
    expect(messages.map((message) => message.messageId)).toEqual(['conflict'])
    expect(messages[0]?.message).toContain('`filesystem.denyRead`')
    expect(messages[0]?.message).toContain('`credentials.files`')
  })

  it('names only the entries that the file holds', () => {
    const [read] = lint(sandbox({ disabled: true, denyRead: ['~/.ssh'] }))
    expect(read?.message).toContain('`filesystem.denyRead`')
    expect(read?.message).not.toContain('`credentials.files`')
    const [creds] = lint(sandbox({ disabled: true }, { files: [DENY_FILE] }))
    expect(creds?.message).toContain('`credentials.files`')
    expect(creds?.message).not.toContain('`filesystem.denyRead`')
  })

  it('reads a quoted true as true, as Claude Code does in managed settings', () => {
    expect(ids(sandbox({ disabled: 'true', denyRead: ['~/.aws'] }))).toEqual(['conflict'])
  })

  it('reports the value of disabled, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "filesystem": {\n      "disabled": true,\n      "denyRead": ["~/.aws"]\n    }\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[4, 19, 4, 23]])
  })
})

describe(`${name}: what is not a conflict`, () => {
  it('is silent for disabled with no entry that it switches off', () => {
    expect(ids(sandbox({ disabled: true }))).toEqual([])
    expect(ids(sandbox({ disabled: true, allowWrite: ['./out'], denyWrite: ['/etc'] }))).toEqual([])
    expect(ids(sandbox({ disabled: true, denyRead: [] }))).toEqual([])
    expect(ids(sandbox({ disabled: true }, { files: [] }))).toEqual([])
  })

  it('is silent for a mask entry, which stays in force', () => {
    expect(ids(sandbox({ disabled: true }, { files: [MASK_FILE] }))).toEqual([])
  })

  it('is silent when disabled is not true', () => {
    for (const value of [false, 'false', 'yes', 1, null, [], {}]) {
      expect(ids(sandbox({ disabled: value, denyRead: ['~/.aws'] })), String(value)).toEqual([])
    }
  })

  it('is silent for denyRead without disabled', () => {
    expect(ids(sandbox({ denyRead: ['~/.aws'] }, { files: [DENY_FILE] }))).toEqual([])
  })

  it('is silent for an entry that is not a string, and a file entry that is no deny', () => {
    expect(ids(sandbox({ disabled: true, denyRead: [1, null, {}] }))).toEqual([])
    const odd = [1, null, 'deny', { mode: 'allow' }, { mode: ['deny'] }, { path: 'x' }]
    expect(ids(sandbox({ disabled: true }, { files: odd }))).toEqual([])
  })

  it('is silent when a value has another type', () => {
    expect(ids({ sandbox: 'x' })).toEqual([])
    expect(ids({ sandbox: { filesystem: 'x' } })).toEqual([])
    expect(ids(sandbox({ disabled: true, denyRead: '~/.aws' }))).toEqual([])
    expect(ids(sandbox({ disabled: true }, { files: DENY_FILE }))).toEqual([])
    expect(ids({ sandbox: { filesystem: { disabled: true }, credentials: 'x' } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const first =
      '{"sandbox": {"filesystem": {"disabled": true, "denyRead": ["a"], "disabled": false}}}'
    expect(ids(first)).toEqual([])
    const second =
      '{"sandbox": {"filesystem": {"disabled": false, "denyRead": ["a"], "disabled": true}}}'
    expect(ids(second)).toEqual(['conflict'])
    const sandboxes =
      '{"sandbox": {"filesystem": {"disabled": true, "denyRead": ["a"]}}, "sandbox": {}}'
    expect(ids(sandboxes)).toEqual([])
  })
})

describe(`${name}: a file that Claude Code does not read the key from`, () => {
  it('is silent in a project or local file: it ignores disabled, so denyRead holds', () => {
    for (const file of [PROJECT, LOCAL]) {
      const code = sandbox({ disabled: true, denyRead: ['~/.aws'] }, { files: [DENY_FILE] })
      expect(ids(code, file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(sandbox({ disabled: true, denyRead: ['~/.aws'] }), HIDDEN)).toEqual([])
  })
})
