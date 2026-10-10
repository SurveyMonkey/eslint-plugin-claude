// The rules between the fields of a `mask` entry of `sandbox.credentials`:
// https://code.claude.com/docs/en/settings-reference#mask-fields-for-files
// https://code.claude.com/docs/en/settings-reference#mask-fields-for-environment-variables
// Claude Code drops a `mask` entry in a project or local file, so `sandbox-scope` reports it there
// and this rule reads the mask entries of a managed source only. The tests of a source use files
// on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-credentials-mask'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'

type Entry = Record<string, unknown>
const TLS = { tlsTerminate: {} }
/** A settings file with the credentials `files` and `envVars`, and the network `network`. */
const settings = (credentials: object, network: object = TLS) =>
  JSON.stringify({ sandbox: { network, credentials } })
const env = (...envVars: Entry[]) => settings({ envVars })
const files = (...entries: Entry[]) => settings({ files: entries })
const mask = (fields: Entry = {}): Entry => ({ name: 'T', mode: 'mask', ...fields })
const maskFile = (fields: Entry = {}): Entry => ({ path: '~/f', mode: 'mask', ...fields })
const at = (root: string, file: string, text: string) =>
  lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
const alone = (text: string, file = MANAGED) => at(repo({}), file, text)

describe(`${name}: the mask entries of a managed file`, () => {
  it('is silent for a plain mask entry', () => {
    expect(alone(env(mask()))).toEqual([])
    expect(alone(files(maskFile()))).toEqual([])
  })

  it('reports a mask entry when no file holds tlsTerminate or allowPlaintextInject', () => {
    expect(alone(env(mask()).replace('"tlsTerminate":{}', ''))).toEqual(['noTls'])
    expect(alone(settings({ files: [maskFile()] }, {}))).toEqual(['noTls'])
    expect(alone(settings({ envVars: [mask(), mask({ name: 'U' })] }, {}))).toEqual([
      'noTls',
      'noTls',
    ])
  })

  it('is silent when tlsTerminate has a path, or allowPlaintextInject is true', () => {
    const paths = { tlsTerminate: { caCertPath: '/a', caKeyPath: '/b' } }
    expect(alone(settings({ envVars: [mask()] }, paths))).toEqual([])
    expect(alone(settings({ envVars: [mask()], allowPlaintextInject: true }, {}))).toEqual([])
  })

  it('reports when tlsTerminate is not an object and allowPlaintextInject is not true', () => {
    for (const credentials of [{ allowPlaintextInject: false }, { allowPlaintextInject: 'true' }]) {
      const text = settings({ envVars: [mask()], ...credentials }, { tlsTerminate: null })
      expect(alone(text), JSON.stringify(credentials)).toEqual(['noTls'])
    }
  })

  it('reports the mode value, at its line and column, and says what the mask needs', () => {
    const text =
      '{\n  "sandbox": {\n    "credentials": {\n      "envVars": [{ "name": "T", "mode": "mask" }]\n    }\n  }\n}'
    const [message] = lintJson(name, text, '/repo/managed-settings.json')
    expect([message?.line, message?.column]).toEqual([4, 42])
    expect(message?.message).toContain('tlsTerminate')
    expect(message?.message).toContain('allowPlaintextInject')
  })

  it('reports maskClaims without decode', () => {
    expect(alone(env(mask({ maskClaims: ['sub'] })))).toEqual(['claimsNeedDecode'])
    expect(alone(files(maskFile({ maskClaims: ['sub'] })))).toEqual(['claimsNeedDecode'])
    expect(alone(env(mask({ maskClaims: ['sub'], decode: 'x' })))).toEqual(['claimsNeedDecode'])
  })

  it('is silent for maskClaims with decode, and reports an empty list', () => {
    expect(alone(env(mask({ maskClaims: ['sub'], decode: 'jwt' })))).toEqual([])
    expect(alone(files(maskFile({ maskClaims: ['sub'], decode: 'jwt' })))).toEqual([])
    expect(alone(env(mask({ maskClaims: [], decode: 'jwt' })))).toEqual(['emptyClaims'])
    expect(alone(env(mask({ maskClaims: 'sub', decode: 'jwt' })))).toEqual([])
  })

  it('reports maskDuplicates in a file entry without extract or decode', () => {
    expect(alone(files(maskFile({ maskDuplicates: true })))).toEqual(['duplicatesNeedExtract'])
    expect(alone(files(maskFile({ maskDuplicates: true, extract: '(a)' })))).toEqual([])
    expect(alone(files(maskFile({ maskDuplicates: true, decode: 'jwt' })))).toEqual([])
  })

  it('reports extract with decode in an environment variable entry only', () => {
    expect(alone(env(mask({ extract: '(a)', decode: 'jwt' })))).toEqual(['extractAndDecode'])
    expect(alone(files(maskFile({ extract: '(a)', decode: 'jwt' })))).toEqual([])
    expect(alone(env(mask({ extract: '(a)' })))).toEqual([])
    expect(alone(env(mask({ decode: 'jwt' })))).toEqual([])
  })

  it('reports onExtractNoMatch other than warn with decode in an environment variable entry', () => {
    for (const value of ['deny', 'error']) {
      const entry = mask({ decode: 'jwt', onExtractNoMatch: value })
      expect(alone(env(entry)), value).toEqual(['decodeWarnOnly'])
    }
    expect(alone(env(mask({ decode: 'jwt', onExtractNoMatch: 'warn' })))).toEqual([])
    expect(alone(env(mask({ decode: 'jwt', onExtractNoMatch: 3 })))).toEqual([])
    expect(alone(env(mask({ onExtractNoMatch: 'deny' })))).toEqual([])
    expect(alone(files(maskFile({ decode: 'jwt', onExtractNoMatch: 'deny' })))).toEqual([])
  })

  it('reports an injectHosts entry that is a bracketed or zone-ID IPv6 address', () => {
    for (const host of ['[::1]', '[::1]:443', 'fe80::1%eth0']) {
      expect(alone(env(mask({ injectHosts: [host] }))), host).toEqual(['injectIpv6'])
    }
    expect(alone(files(maskFile({ injectHosts: ['[::1]'] })))).toEqual(['injectIpv6'])
  })

  it('is silent for an injectHosts entry that is a host or a bare address', () => {
    expect(alone(env(mask({ injectHosts: ['api.github.com', '::1', '*.a.com', 3] })))).toEqual([])
    expect(alone(env(mask({ injectHosts: 'api.github.com' })))).toEqual([])
  })

  it('reports a mask entry for a variable that a deny entry names too', () => {
    expect(alone(env(mask(), { name: 'T', mode: 'deny' }))).toEqual(['denyWins'])
    expect(alone(env({ name: 'T', mode: 'deny' }, mask()))).toEqual(['denyWins'])
    expect(alone(env(mask(), { name: 'U', mode: 'deny' }))).toEqual([])
    expect(alone(env(mask(), mask()))).toEqual([])
  })

  it('reports a fault once per entry, and each entry', () => {
    const entry = mask({
      maskClaims: ['a'],
      extract: '(a)',
      decode: 'jwt',
      onExtractNoMatch: 'deny',
    })
    expect(alone(env(entry, entry))).toEqual([
      'extractAndDecode',
      'decodeWarnOnly',
      'extractAndDecode',
      'decodeWarnOnly',
    ])
  })

  it('reads a drop-in like the main file', () => {
    expect(alone(env(mask({ maskClaims: ['a'] })), DROP_IN)).toEqual(['claimsNeedDecode'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(env(mask({ maskClaims: ['a'] })), 'managed-settings.d/.10-a.json')).toEqual([])
  })

  it('does not read an entry that is not an object, or a list that is not an array', () => {
    expect(alone(settings({ envVars: [1, null, 'x'], files: 'x' }))).toEqual([])
    expect(alone(settings({ envVars: [{ name: 'T', mode: 'x', maskClaims: ['a'] }] }))).toEqual([])
    expect(alone('{}')).toEqual([])
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: the deny entries of every file`, () => {
  const DENY_FILE = { path: '~/f', mode: 'deny' }
  const DENY_VAR = { name: 'T', mode: 'deny' }

  it('reports a deny entry that holds mask fields', () => {
    for (const field of ['extract', 'onExtractNoMatch', 'decode', 'maskClaims', 'injectHosts']) {
      for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
        expect(alone(env({ ...DENY_VAR, [field]: 'x' }), file), `${field} ${file}`).toEqual([
          'denyFields',
        ])
      }
    }
    expect(alone(files({ ...DENY_FILE, maskDuplicates: true }))).toEqual(['denyFields'])
    expect(alone(files({ ...DENY_FILE, maskDuplicates: true }), PROJECT)).toEqual(['denyFields'])
  })

  it('names every mask field of the entry in one report', () => {
    const [message] = lintJson(
      name,
      env({ ...DENY_VAR, extract: '(a)', injectHosts: [] }),
      '/repo/managed-settings.json',
    )
    expect(message?.message).toContain('extract')
    expect(message?.message).toContain('injectHosts')
  })

  it('is silent for a deny entry with no mask field', () => {
    expect(alone(env(DENY_VAR), PROJECT)).toEqual([])
    expect(alone(files(DENY_FILE), PROJECT)).toEqual([])
    expect(alone(env({ ...DENY_VAR, maskDuplicates: true }))).toEqual([])
  })

  it('is silent for a mask entry in a project or local file: sandbox-scope reports it', () => {
    const entry = mask({ maskClaims: ['a'], extract: '(a)', decode: 'jwt', injectHosts: ['[::1]'] })
    for (const file of [PROJECT, LOCAL]) {
      expect(alone(env(entry, { name: 'T', mode: 'deny' }), file), file).toEqual([])
      expect(alone(settings({ envVars: [mask()] }, {}), file), file).toEqual([])
    }
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const BARE = settings({ envVars: [mask()] }, {})

  it('reads tlsTerminate and allowPlaintextInject from any file of the source', () => {
    const tls = repo({
      'managed-settings.d/20-b.json': JSON.stringify({ sandbox: { network: TLS } }),
    })
    expect(at(tls, DROP_IN, BARE)).toEqual([])
    const plain = repo({
      [MANAGED]: JSON.stringify({ sandbox: { credentials: { allowPlaintextInject: true } } }),
    })
    expect(at(plain, DROP_IN, BARE)).toEqual([])
  })

  it('reads a deny entry of another file of the source', () => {
    const root = repo({ [MANAGED]: settings({ envVars: [{ name: 'T', mode: 'deny' }] }) })
    expect(at(root, DROP_IN, env(mask()))).toEqual(['denyWins'])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({
      [PROJECT]: settings({}),
      [LOCAL]: JSON.stringify({ sandbox: { network: TLS } }),
    })
    expect(at(root, MANAGED, BARE)).toEqual(['noTls'])
  })

  it('ignores a hidden sibling', () => {
    const root = repo({
      'managed-settings.d/.20-b.json': JSON.stringify({ sandbox: { network: TLS } }),
    })
    expect(at(root, DROP_IN, BARE)).toEqual(['noTls'])
  })

  it('adds nothing for a sibling that does not read', () => {
    const root = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(root, DROP_IN, BARE)).toEqual(['noTls'])
    expect(at(root, DROP_IN, env(mask()))).toEqual([])
  })

  it('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({
      'managed-settings.d/20-b.json': JSON.stringify({ sandbox: { network: TLS } }),
    })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, BARE)).toEqual(['noTls'])
  })

  it('does not read the other file of a project pair for a deny entry', () => {
    const root = repo({
      [LOCAL]: settings({ envVars: [{ name: 'T', mode: 'deny', extract: 'x' }] }),
    })
    expect(at(root, PROJECT, env({ name: 'T', mode: 'deny' }))).toEqual([])
  })
})
