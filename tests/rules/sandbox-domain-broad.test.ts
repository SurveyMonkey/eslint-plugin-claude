// An `allowedDomains` entry that allows every host (`*`), or a whole top-level domain (`*.com`).
// The security limitations warn that a broad allowed domain opens a path for exfiltration and
// domain fronting: https://code.claude.com/docs/en/sandboxing#security-limitations
// The docs name `github.com` as an example of a broad domain, and also use it in two examples of
// `allowedDomains`. So the rule reports it only when the option `broad` lists it.
// `sandbox-domain-syntax` owns an entry with a URL scheme, a path or a bad port.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'sandbox-domain-broad'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

// The shared helper `lintJson` takes no options, so this file lints with its own Linter.
const lint = (code: string, file = PROJECT, options?: unknown) =>
  new Linter({ cwd: path.parse(file).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: {
          [`claude/${name}`]: options === undefined ? 'error' : ['error', options as object],
        },
      },
    ],
    { filename: file },
  )
const allowed = (...entries: unknown[]) =>
  JSON.stringify({ sandbox: { network: { allowedDomains: entries } } })
const ids = (code: string, file = PROJECT, options?: unknown) =>
  lint(code, file, options).map((message) => message.messageId)

describe(`${name}: the default`, () => {
  it('reports * and a wildcard on one label, in every kind of file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(allowed('*', '*.com'), file), file).toEqual(['wildcard', 'wildcard'])
    }
  })

  it('reports a wildcard on any one label, with a port, in capitals, or with a final dot', () => {
    for (const entry of ['*.io', '*.COM', '*.com:443', '*.org.', '*:8080']) {
      expect(ids(allowed(entry)), entry).toEqual(['wildcard'])
    }
  })

  it('reports at the entry, and names it', () => {
    const text =
      '{\n  "sandbox": {\n    "network": {\n      "allowedDomains": ["a.com", "*.com"]\n    }\n  }\n}'
    const [message] = lint(text)
    expect([message?.line, message?.column]).toEqual([4, 35])
    expect(message?.message).toContain('`*.com`')
    expect(message?.message).toContain('domain fronting')
  })

  it('is silent for every entry that the docs give', () => {
    for (const entry of ['github.com', '*.npmjs.org', 'api.example.com:443', '*.example.com']) {
      expect(ids(allowed(entry)), entry).toEqual([])
    }
    expect(ids(allowed('github.com', '*.npmjs.org', 'api.example.com:443'))).toEqual([])
  })

  it('is silent for a narrow wildcard, a host, and an address', () => {
    for (const entry of [
      '*.co.uk',
      '*.a.b.com',
      'api.*.com',
      '127.0.0.1:8080',
      '[::1]',
      'localhost',
    ]) {
      expect(ids(allowed(entry)), entry).toEqual([])
    }
  })

  it('leaves the entries of sandbox-domain-syntax to that rule', () => {
    for (const entry of ['https://*.com', '*.com/path', '*.com:x']) {
      expect(ids(allowed(entry)), entry).toEqual([])
    }
  })

  it('does not read deniedDomains, an entry that is not a string, or a list that is not an array', () => {
    expect(
      ids(JSON.stringify({ sandbox: { network: { deniedDomains: ['*', '*.com'] } } })),
    ).toEqual([])
    expect(ids(allowed(1, null))).toEqual([])
    expect(ids(JSON.stringify({ sandbox: { network: { allowedDomains: '*' } } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('reports a wildcard with a bad port too: the breadth is a fault of its own', () => {
    expect(ids(allowed('*.com:99999'))).toEqual(['wildcard'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(allowed('*'), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the option broad`, () => {
  it('reports a listed host, with or without a port, in any letter case', () => {
    const options = { broad: ['github.com'] }
    for (const entry of ['github.com', 'GitHub.com', 'github.com:443', 'github.com.']) {
      expect(ids(allowed(entry), PROJECT, options), entry).toEqual(['listed'])
    }
    expect(lint(allowed('github.com'), PROJECT, options)[0]?.message).toContain('`github.com`')
  })

  it('reads a listed host in any letter case, and drops its port and final dot', () => {
    const options = { broad: ['GitHub.com:443', 'example.org.'] }
    expect(ids(allowed('github.com', 'EXAMPLE.org'), PROJECT, options)).toEqual([
      'listed',
      'listed',
    ])
  })

  it('does not report a host that the list does not hold, or a subdomain of a listed host', () => {
    const options = { broad: ['github.com'] }
    for (const entry of ['gist.github.com', '*.github.com', 'example.com']) {
      expect(ids(allowed(entry), PROJECT, options), entry).toEqual([])
    }
  })

  it('still reports * and a one-label wildcard, and reports an entry once', () => {
    expect(ids(allowed('*.com'), PROJECT, { broad: ['*.com'] })).toEqual(['wildcard'])
    expect(ids(allowed('*', 'github.com'), PROJECT, { broad: ['github.com'] })).toEqual([
      'wildcard',
      'listed',
    ])
  })

  it('takes an empty list as the default', () => {
    expect(ids(allowed('github.com'), PROJECT, { broad: [] })).toEqual([])
  })

  it('refuses an option that is not a list of non-empty strings', () => {
    for (const options of [{ broad: 'github.com' }, { broad: [''] }, { broad: [1] }, { x: 1 }]) {
      expect(() => lint(allowed('*'), PROJECT, options), JSON.stringify(options)).toThrow(/should/)
    }
  })
})
