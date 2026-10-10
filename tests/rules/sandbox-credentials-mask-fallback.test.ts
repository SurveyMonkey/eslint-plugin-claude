// Claude Code falls back to `deny` for a `mask` entry that it cannot mask safely: an `extract`
// pattern with no capturing group, a directory path, or a glob pattern:
// https://code.claude.com/docs/en/settings-reference#invalid-credential-entries-in-managed-settings
// https://code.claude.com/docs/en/sandboxing#mask-credential-files
// The rule reads the `mask` entries of managed files. `sandbox-scope` owns them in a project file.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-credentials-mask-fallback'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const files = (...entries: object[]) =>
  JSON.stringify({ sandbox: { credentials: { files: entries } } })
const vars = (...entries: object[]) =>
  JSON.stringify({ sandbox: { credentials: { envVars: entries } } })
const mask = (fields: object) => ({ path: '~/.config/gh/hosts.yml', mode: 'mask', ...fields })
const variable = (fields: object) => ({ name: 'TOKEN', mode: 'mask', ...fields })
const run = (text: string, file = MANAGED) => lintJson(name, text, file)
const ids = (text: string, file = MANAGED) => run(text, file).map((message) => message.messageId)

describe(`${name}: the extract report`, () => {
  it.fails('reports an extract with no capturing group, in a file entry and a variable entry', () => {
    expect(ids(files(mask({ extract: 'oauth_token:\\s*\\S+' })))).toEqual(['noGroup'])
    expect(ids(vars(variable({ extract: '://[^:]+:[^@]+@' })))).toEqual(['noGroup'])
  })

  it.fails('reports in a managed file and a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(files(mask({ extract: 'x+' })), file), file).toEqual(['noGroup'])
    }
  })

  it.fails('does not count a group that captures nothing, or a parenthesis that is not a group', () => {
    for (const extract of [
      '(?:a)b',
      '(?=a)b',
      '(?!a)b',
      '(?<=a)b',
      '(?<!a)b',
      '\\(a\\)',
      '[(]a',
      '',
    ]) {
      expect(ids(files(mask({ extract }))), extract).toEqual(['noGroup'])
    }
  })

  it.fails('reports at the pattern, and says that the entry falls back to deny', () => {
    const text =
      '{\n  "sandbox": {\n    "credentials": {\n      "files": [{ "path": "~/a", "mode": "mask", "extract": "x" }]\n    }\n  }\n}'
    const [message] = run(text)
    expect([message?.line, message?.column]).toEqual([4, 51])
    expect(message?.message).toContain('"deny"')
  })
})

describe(`${name}: the extract silent cases`, () => {
  it.fails('is silent for a pattern with a capturing group', () => {
    for (const extract of ['oauth_token:\\s*(\\S+)', '(?<token>\\S+)', '(a)|b', '[(]a(b)']) {
      expect(ids(files(mask({ extract }))), extract).toEqual([])
    }
    expect(ids(vars(variable({ extract: '://[^:]+:([^@]+)@' })))).toEqual([])
  })

  it.fails('is silent for a pattern that does not compile, which is not this fault', () => {
    expect(ids(files(mask({ extract: '(' })))).toEqual([])
    expect(ids(files(mask({ extract: '[' })))).toEqual([])
  })

  it.fails('is silent with no extract, or one that is not a string', () => {
    expect(ids(files(mask({})))).toEqual([])
    expect(ids(files(mask({ extract: 5 })))).toEqual([])
    expect(ids(vars(variable({ extract: null })))).toEqual([])
  })

  it.fails('is silent for a deny entry, which ignores its mask fields', () => {
    expect(ids(files(mask({ mode: 'deny', extract: 'x' })))).toEqual([])
  })

  it.fails('is silent in a project and a local file, where sandbox-scope reports a mask entry', () => {
    for (const file of [PROJECT, LOCAL]) {
      expect(ids(files(mask({ extract: 'x', path: '~/a/' })), file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(ids(files(mask({ extract: 'x', path: '~/a/' })), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the path report`, () => {
  it.fails('reports a path with a glob character', () => {
    for (const file of [
      '~/.aws/*',
      '~/.ssh/id_?',
      '~/keys/[ab].pem',
      '~/build/**',
      '/etc/*.conf',
    ]) {
      expect(ids(files(mask({ path: file }))), file).toEqual(['unmaskablePath'])
    }
  })

  it.fails('reports a path with a trailing slash', () => {
    for (const file of ['~/.aws/', '/etc/secrets/', './creds/']) {
      expect(ids(files(mask({ path: file }))), file).toEqual(['unmaskablePath'])
    }
  })

  it.fails('names a glob or a directory in the message', () => {
    expect(run(files(mask({ path: '~/a/*' })))[0]?.message).toContain('glob')
    expect(run(files(mask({ path: '~/a/' })))[0]?.message).toContain('directory')
  })

  it.fails('reports the path and the pattern of one entry, each once', () => {
    expect(ids(files(mask({ path: '~/a/*', extract: 'x' })))).toEqual(['noGroup', 'unmaskablePath'])
  })

  it.fails('reports at the path', () => {
    const text =
      '{\n  "sandbox": {\n    "credentials": {\n      "files": [{ "path": "~/a/", "mode": "mask" }]\n    }\n  }\n}'
    const [message] = run(text)
    expect([message?.line, message?.column]).toEqual([4, 25])
  })
})

describe(`${name}: the path silent cases`, () => {
  it.fails('is silent for a plain file path', () => {
    for (const file of ['~/.config/gh/hosts.yml', '/etc/app/token', './token.json', 'token']) {
      expect(ids(files(mask({ path: file }))), file).toEqual([])
    }
  })

  it.fails('does not decide for a directory path with no trailing slash', () => {
    expect(ids(files(mask({ path: '~/.aws' })))).toEqual([])
  })

  it.fails('is silent for a deny entry, a path that is not a string, and an entry with no path', () => {
    expect(ids(files(mask({ mode: 'deny', path: '~/.aws/' })))).toEqual([])
    expect(ids(files(mask({ path: 5 })))).toEqual([])
    expect(ids(files({ mode: 'mask' }))).toEqual([])
  })

  it.fails('does not read a path in a variable entry', () => {
    expect(ids(vars(variable({ path: '~/a/*' })))).toEqual([])
  })

  it.fails('is silent for no credentials, and for a list that is not an array', () => {
    expect(ids('{}')).toEqual([])
    expect(ids(JSON.stringify({ sandbox: { credentials: { files: 'x', envVars: 5 } } }))).toEqual(
      [],
    )
    expect(ids(files(5 as never, 'x' as never))).toEqual([])
  })
})
