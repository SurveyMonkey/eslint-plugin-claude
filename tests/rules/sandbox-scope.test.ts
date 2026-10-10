// Claude Code drops a `mode: "mask"` entry of `sandbox.credentials.files` and `envVars` from the
// project file `.claude/settings.json` and the local file `.claude/settings.local.json`:
// https://code.claude.com/docs/en/settings-reference#sandbox-credentials-files
// https://code.claude.com/docs/en/settings-reference#sandbox-credentials-envvars
// https://code.claude.com/docs/en/sandboxing#mask-credentials
// The scope of a key is for `settings-key-scope`, which reports `sandbox.bwrapPath` and the other
// keys of the settings index. This rule reads the value of `mode`, which that rule cannot see.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-scope'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const FILE = { path: '~/.config/gh/hosts.yml', mode: 'mask' }
const VAR = { name: 'GITHUB_TOKEN', mode: 'mask', injectHosts: ['api.github.com'] }
const credentials = (fields: object) => ({ sandbox: { credentials: fields } })

describe(`${name}: a mask entry in a repository file`, () => {
  it.fails('reports a file entry and a variable entry, in each project and local file', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(credentials({ files: [FILE] }), file), file).toEqual(['mask'])
      expect(ids(credentials({ envVars: [VAR] }), file), file).toEqual(['mask'])
    }
  })

  it.fails('reports each mask entry, and no deny entry', () => {
    const code = credentials({
      files: [{ path: '~/.aws', mode: 'deny' }, FILE, FILE],
      envVars: [VAR, { name: 'NPM_TOKEN', mode: 'deny' }],
    })
    expect(ids(code)).toEqual(['mask', 'mask', 'mask'])
  })

  it.fails('names the list in the message', () => {
    const [file] = lint(credentials({ files: [FILE] }))
    expect(file?.message).toContain('"sandbox.credentials.files"')
    const [variable] = lint(credentials({ envVars: [VAR] }))
    expect(variable?.message).toContain('"sandbox.credentials.envVars"')
  })

  it.fails('reports the value of mode, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "credentials": {\n      "files": [\n        { "path": "~/x", "mode": "mask" }\n      ]\n    }\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[5, 34, 5, 40]])
  })

  it.fails('reads the last of two keys of one name', () => {
    const first = '{"sandbox": {"credentials": {"files": [{"mode": "mask", "mode": "deny"}]}}}'
    expect(ids(first)).toEqual([])
    const second = '{"sandbox": {"credentials": {"files": [{"mode": "deny", "mode": "mask"}]}}}'
    expect(ids(second)).toEqual(['mask'])
    expect(
      ids('{"sandbox": {"credentials": {"files": [{"mode": "mask"}]}}, "sandbox": {}}'),
    ).toEqual([])
  })

  it.fails('is silent when a value has another type, or mode is not the word mask', () => {
    expect(ids({ sandbox: 'x' })).toEqual([])
    expect(ids({ sandbox: { credentials: 'x' } })).toEqual([])
    expect(ids(credentials({ files: FILE, envVars: 'x' }))).toEqual([])
    expect(ids(credentials({ files: [1, null, 'mask', ['mask'], { mode: ['mask'] }] }))).toEqual([])
    expect(
      ids(credentials({ files: [{ mode: 'Mask' }, { mode: 'deny' }, { path: 'x' }] })),
    ).toEqual([])
    expect(ids('[1]')).toEqual([])
  })
})

describe(`${name}: a file that keeps the entry`, () => {
  it.fails('is silent in each managed file', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(credentials({ files: [FILE], envVars: [VAR] }), file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(ids(credentials({ files: [FILE] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the scope of a key is for settings-key-scope`, () => {
  it.fails('is silent for each key that the settings index gives a narrow scope', () => {
    const code = {
      sandbox: {
        bwrapPath: '/opt/bwrap',
        socatPath: '/opt/socat',
        allowAppleEvents: true,
        ripgrep: { command: 'rg' },
        filesystem: { allowManagedReadPathsOnly: true, disabled: true },
        network: { allowManagedDomainsOnly: true, strictAllowlist: true, tlsTerminate: {} },
        credentials: { allowPlaintextInject: true, awsPairs: [], sigv4: {} },
      },
    }
    for (const file of PROJECT_FILES) {
      expect(ids(code, file), file).toEqual([])
    }
  })
})
