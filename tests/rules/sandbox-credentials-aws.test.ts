// The AWS rules of `sandbox.credentials`: `awsPairs` names whole-value `mask` entries of `envVars`,
// the access key and the secret key are masked together, and `onExtractNoMatch: "deny"` acts as
// `error` when `allowRead` or `filesystem.disabled` removes the read block:
// https://code.claude.com/docs/en/settings-reference#sandbox-credentials-awspairs
// https://code.claude.com/docs/en/sandboxing#re-sign-aws-requests
// Claude Code honors `awsPairs` and `mask` entries in managed settings only, so the rule reads the
// managed files. The tests of a source use files on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-credentials-aws'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'

type Entry = Record<string, unknown>
const KEY = 'AWS_ACCESS_KEY_ID'
const SECRET = 'AWS_SECRET_ACCESS_KEY'
const mask = (variable: string, fields: Entry = {}): Entry => ({
  name: variable,
  mode: 'mask',
  ...fields,
})
const pair = (accessKeyIdVar: string, secretAccessKeyVar: string, more: Entry = {}): Entry => ({
  accessKeyIdVar,
  secretAccessKeyVar,
  ...more,
})
const creds = (credentials: object, sandbox: object = {}) =>
  JSON.stringify({ sandbox: { ...sandbox, credentials } })
const at = (root: string, file: string, text: string) =>
  lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
const alone = (text: string, file = MANAGED) => at(repo({}), file, text)

describe(`${name}: awsPairs`, () => {
  const MASKED = [mask('K'), mask('S'), mask('T')]

  it('is silent for pairs that name whole-value mask entries', () => {
    const text = creds({ envVars: MASKED, awsPairs: [pair('K', 'S', { sessionTokenVar: 'T' })] })
    expect(alone(text)).toEqual([])
  })

  it('reports a named variable whose entry is not a whole-value mask', () => {
    for (const bad of [
      mask('K', { extract: '(a)' }),
      mask('K', { decode: 'jwt' }),
      { name: 'K', mode: 'deny' },
    ]) {
      const text = creds({ envVars: [bad, mask('S')], awsPairs: [pair('K', 'S')] })
      expect(alone(text), JSON.stringify(bad)).toEqual(['notWholeMask'])
    }
  })

  it('reports the variable name, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "credentials": {\n      "envVars": [{ "name": "K", "mode": "deny" }],\n      "awsPairs": [{ "accessKeyIdVar": "K", "secretAccessKeyVar": "S" }]\n    }\n  }\n}'
    const [message] = lintJson(name, text, '/repo/managed-settings.json')
    expect([message?.line, message?.column]).toEqual([5, 40])
    expect(message?.message).toContain('K')
  })

  it('reports a variable that is a deny entry and a mask entry', () => {
    const text = creds({
      envVars: [mask('K'), { name: 'K', mode: 'deny' }, mask('S')],
      awsPairs: [pair('K', 'S')],
    })
    expect(alone(text)).toEqual(['notWholeMask'])
  })

  it('is silent for a named variable with no entry: another file can supply it', () => {
    expect(alone(creds({ awsPairs: [pair('K', 'S')] }))).toEqual([])
  })

  it('reports a variable that fills a second slot, in one pair or in two', () => {
    expect(alone(creds({ envVars: MASKED, awsPairs: [pair('K', 'K')] }))).toEqual(['reused'])
    const two = creds({ envVars: MASKED, awsPairs: [pair('K', 'S'), pair('S', 'T')] })
    expect(alone(two)).toEqual(['reused'])
    const session = creds({ envVars: MASKED, awsPairs: [pair('K', 'S', { sessionTokenVar: 'K' })] })
    expect(alone(session)).toEqual(['reused'])
  })

  it('does not read a slot that is not a string, or a pair that is not an object', () => {
    const text = creds({ envVars: MASKED, awsPairs: [pair('K', 'S', { sessionTokenVar: 3 }), 'x'] })
    expect(alone(text)).toEqual([])
    expect(alone(creds({ awsPairs: 'x' }))).toEqual([])
  })

  it('is silent when another file of the source sets awsPairs: the key is taken whole', () => {
    const bad = creds({ envVars: [{ name: 'K', mode: 'deny' }], awsPairs: [pair('K', 'S')] })
    const root = repo({ 'managed-settings.d/20-b.json': creds({ awsPairs: [pair('X', 'Y')] }) })
    expect(at(root, DROP_IN, bad)).toEqual([])
  })

  it('reads an entry of another file of the source', () => {
    const root = repo({ [MANAGED]: creds({ envVars: [mask('K'), mask('S')] }) })
    expect(at(root, DROP_IN, creds({ awsPairs: [pair('K', 'S')] }))).toEqual([])
    const bad = repo({ [MANAGED]: creds({ envVars: [{ name: 'K', mode: 'deny' }] }) })
    expect(at(bad, DROP_IN, creds({ awsPairs: [pair('K', 'S')] }))).toEqual(['notWholeMask'])
  })
})

describe(`${name}: the access key and the secret key`, () => {
  it('reports a masked secret key with no masked access key, and the reverse', () => {
    expect(alone(creds({ envVars: [mask(SECRET)] }))).toEqual(['unpaired'])
    expect(alone(creds({ envVars: [mask(KEY)] }))).toEqual(['unpaired'])
  })

  it('names the lone variable, and the one that is missing', () => {
    const [message] = lintJson(
      name,
      creds({ envVars: [mask(SECRET)] }),
      '/repo/managed-settings.json',
    )
    expect(message?.message).toContain(SECRET)
    expect(message?.message).toContain(KEY)
  })

  it('is silent when both are masked, or neither', () => {
    expect(alone(creds({ envVars: [mask(KEY), mask(SECRET)] }))).toEqual([])
    expect(alone(creds({ envVars: [mask('OTHER')] }))).toEqual([])
    expect(alone(creds({ envVars: [{ name: KEY, mode: 'deny' }] }))).toEqual([])
  })

  it('counts a mask entry of another file of the source', () => {
    const root = repo({ [MANAGED]: creds({ envVars: [mask(KEY)] }) })
    expect(at(root, DROP_IN, creds({ envVars: [mask(SECRET)] }))).toEqual([])
  })

  it('is silent when a pair names a conventional variable: the pair replaces the automatic one', () => {
    const text = creds({ envVars: [mask(SECRET)], awsPairs: [pair('K', SECRET)] })
    expect(alone(text)).toEqual([])
  })

  it('is silent when another file sets awsPairs: the rule cannot tell which pairs hold', () => {
    const root = repo({ 'managed-settings.d/20-b.json': creds({ awsPairs: [pair('K', 'S')] }) })
    expect(at(root, DROP_IN, creds({ envVars: [mask(SECRET)] }))).toEqual([])
  })
})

describe(`${name}: onExtractNoMatch deny with a read block that does not hold`, () => {
  const FILE = {
    path: '~/.aws/credentials',
    mode: 'mask',
    extract: '(a)',
    onExtractNoMatch: 'deny',
  }
  const withRead = (allowRead: string[], entry: Entry = FILE) =>
    creds({ files: [entry] }, { filesystem: { allowRead } })

  it('reports when allowRead re-opens the path: the same path, or a directory above it', () => {
    for (const allowed of ['~/.aws/credentials', '~/.aws', '~/.aws/', '~/.aws/**', '~']) {
      expect(alone(withRead([allowed])), allowed).toEqual(['denyReopened'])
    }
  })

  it('reports the onExtractNoMatch value, and names the cause', () => {
    const [message] = lintJson(name, withRead(['~/.aws']), '/repo/managed-settings.json')
    expect(message?.message).toContain('allowRead')
    const off = lintJson(
      name,
      creds({ files: [FILE] }, { filesystem: { disabled: true } }),
      '/repo/managed-settings.json',
    )
    expect(off[0]?.message).toContain('filesystem.disabled')
  })

  it('reports when filesystem.disabled is true', () => {
    expect(alone(creds({ files: [FILE] }, { filesystem: { disabled: true } }))).toEqual([
      'denyReopened',
    ])
  })

  it('is silent for another path, another value, or an entry that is not a mask', () => {
    expect(alone(withRead(['~/.ssh', '~/.awsx', '~/.aws/credentials/x']))).toEqual([])
    for (const value of ['warn', 'error', undefined]) {
      expect(alone(withRead(['~/.aws'], { ...FILE, onExtractNoMatch: value }))).toEqual([])
    }
    expect(alone(withRead(['~/.aws'], { ...FILE, mode: 'deny' }))).toEqual([])
    expect(alone(withRead(['~/.aws'], { ...FILE, path: 3 }))).toEqual([])
    expect(alone(creds({ files: [FILE] }, { filesystem: { disabled: false } }))).toEqual([])
    expect(alone(creds({ files: [FILE] }))).toEqual([])
  })

  it('reads allowRead and disabled in another file of the source', () => {
    const allow = repo({
      [MANAGED]: JSON.stringify({ sandbox: { filesystem: { allowRead: ['~'] } } }),
    })
    expect(at(allow, DROP_IN, creds({ files: [FILE] }))).toEqual(['denyReopened'])
    const off = repo({ [MANAGED]: JSON.stringify({ sandbox: { filesystem: { disabled: true } } }) })
    expect(at(off, DROP_IN, creds({ files: [FILE] }))).toEqual(['denyReopened'])
  })
})

describe(`${name}: the files that it reads`, () => {
  const BAD = creds({ envVars: [mask(SECRET)] })

  it('reads a managed file and a drop-in', () => {
    expect(alone(BAD, MANAGED)).toEqual(['unpaired'])
    expect(alone(BAD, DROP_IN)).toEqual(['unpaired'])
  })

  it('is silent in a project or local file: the keys are for managed settings', () => {
    for (const file of [PROJECT, LOCAL]) {
      expect(alone(BAD, file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(BAD, 'managed-settings.d/.10-a.json')).toEqual([])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: creds({ envVars: [mask(KEY)] }) })
    expect(at(root, MANAGED, BAD)).toEqual(['unpaired'])
  })

  it('ignores a hidden sibling, and a sibling that does not read adds nothing', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': creds({ envVars: [mask(KEY)] }) })
    expect(at(hidden, DROP_IN, BAD)).toEqual(['unpaired'])
    const absent = repo({})
    expect(at(absent, DROP_IN, BAD)).toEqual(['unpaired'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(bad, DROP_IN, BAD)).toEqual([])
  })

  it('is silent on an absence check when a file of the source does not read', () => {
    const bad = repo({ 'managed-settings.d/20-b.json': '{' })
    const reused = creds({ awsPairs: [pair('K', 'S'), pair('K', 'T')], envVars: [mask('K')] })
    expect(at(repo({}), DROP_IN, reused)).toEqual(['reused'])
    expect(at(bad, DROP_IN, reused)).toEqual([])
    const whole = creds({ awsPairs: [pair('K', 'S')], envVars: [mask('K', { extract: 'x' })] })
    expect(at(repo({}), DROP_IN, whole)).toEqual(['notWholeMask'])
    expect(at(bad, DROP_IN, whole)).toEqual([])
  })

  it('still reports from present values when a file of the source does not read', () => {
    const bad = repo({ 'managed-settings.d/20-b.json': '{' })
    const text = creds(
      {
        files: [
          { path: '~/.aws/credentials', mode: 'mask', extract: 'x', onExtractNoMatch: 'deny' },
        ],
      },
      { filesystem: { allowRead: ['~/.aws'] } },
    )
    expect(at(bad, DROP_IN, text)).toEqual(['denyReopened'])
  })

  it('is silent on filesystem.disabled when a file of the source does not read', () => {
    const bad = repo({ 'managed-settings.d/20-b.json': '{' })
    const text = creds(
      {
        files: [
          { path: '~/.aws/credentials', mode: 'mask', extract: 'x', onExtractNoMatch: 'deny' },
        ],
      },
      { filesystem: { disabled: true } },
    )
    expect(at(repo({}), DROP_IN, text)).toEqual(['denyReopened'])
    expect(at(bad, DROP_IN, text)).toEqual([])
  })

  it('reports a decode-only entry, and allowRead when the disabled values disagree', () => {
    const root = repo({
      'managed-settings.d/05-a.json': JSON.stringify({
        sandbox: { filesystem: { disabled: true } },
      }),
    })
    const decode = [
      { path: '~/.aws/credentials', mode: 'mask', decode: 'base64', onExtractNoMatch: 'deny' },
    ]
    expect(
      at(root, DROP_IN, creds({ files: decode }, { filesystem: { disabled: false } })),
    ).toEqual([])
    expect(at(root, DROP_IN, creds({ files: decode }))).toEqual(['denyReopened'])
    const reopen = { filesystem: { disabled: false, allowRead: ['~/.aws'] } }
    expect(at(root, DROP_IN, creds({ files: decode }, reopen))).toEqual(['denyReopened'])
  })

  it('is silent when two files disagree on filesystem.disabled', () => {
    const files = [
      { path: '~/.aws/credentials', mode: 'mask', extract: 'x', onExtractNoMatch: 'deny' },
    ]
    const root = repo({
      'managed-settings.d/20-b.json': JSON.stringify({
        sandbox: { filesystem: { disabled: false } },
      }),
    })
    const text = creds({ files }, { filesystem: { disabled: true } })
    expect(at(root, DROP_IN, text)).toEqual([])
    expect(at(repo({}), DROP_IN, text)).toEqual(['denyReopened'])
  })

  it('does not report onExtractNoMatch deny on a file entry with no extract or decode', () => {
    const files = [{ path: '~/.aws/credentials', mode: 'mask', onExtractNoMatch: 'deny' }]
    expect(alone(creds({ files }, { filesystem: { disabled: true } }))).toEqual([])
  })

  it('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'managed-settings.d/20-b.json': creds({ envVars: [mask(KEY)] }) })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, BAD)).toEqual([])
  })

  it('does not read a value that is not an object', () => {
    expect(alone('{}')).toEqual([])
    expect(alone('[1]')).toEqual([])
    expect(alone(creds({ envVars: [1, null], files: ['x'] }))).toEqual([])
    expect(alone(creds({ envVars: 'x' }))).toEqual([])
  })
})
