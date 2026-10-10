// An entry of `sandbox.network.allowedDomains` or `deniedDomains` is a domain, a wildcard pattern
// or an IP literal, with an optional `:port` suffix. A person writes an IPv6 literal in brackets:
// https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains
// https://code.claude.com/docs/en/sandboxing#ipv6-addresses-in-domain-lists
// A managed file withholds `allowedDomains` while `deniedDomains` has an entry that is not valid:
// https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-domain-syntax'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const KEYS = ['allowedDomains', 'deniedDomains']

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const network = (key: string, ...entries: unknown[]) => ({
  sandbox: { network: { [key]: entries } },
})
/** The fault of one entry, in both lists. */
const fault = (entry: string, file = PROJECT) => {
  const [allowed, denied] = KEYS.map((key) => ids(network(key, entry), file))
  expect(denied, `${entry} in deniedDomains`).toEqual(allowed)
  return allowed
}

describe(`${name}: an entry in the syntax of the docs`, () => {
  it('is silent for a hostname, a wildcard, an IP literal and a port, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const entry of [
        'github.com',
        '*.npmjs.org',
        '*',
        'localhost',
        'api.example.com:443',
        'example.com.',
        '192.168.0.1',
        '192.168.0.1:8080',
        '[::1]',
        '[::1]:443',
        '[2001:db8::1]:8080',
        'a.com:1',
        'a.com:65535',
        '*.a.com:9',
      ]) {
        expect(fault(entry, file), `${file} ${entry}`).toEqual([])
      }
    }
  })
})

describe(`${name}: the faults`, () => {
  it('reports a URL scheme', () => {
    expect(fault('https://github.com')).toEqual(['scheme'])
  })

  it('reports a path, a query and a fragment', () => {
    for (const entry of ['a.com/x', 'a.com?x=1', 'a.com#x', 'a.com:443/x']) {
      expect(fault(entry), entry).toEqual(['path'])
    }
  })

  it('reports a port with a leading zero, zero, out of range, or not a number', () => {
    for (const entry of [
      'a.com:080',
      'a.com:0',
      'a.com:65536',
      'a.com:100000',
      'a.com:',
      'a.com:x',
      'a.com:-1',
      'a.com:80.5',
      '[::1]:0',
      '[::1]:080',
      '[::1]:',
      '[::1]:443:1',
    ]) {
      expect(fault(entry), entry).toEqual(['port'])
    }
  })

  it('reports text that is not a host: user info, white space, a backslash, empty', () => {
    for (const entry of ['a@b.com', 'a b.com', ' a.com', 'a.com ', 'a\\b.com', '', ':443']) {
      expect(fault(entry), JSON.stringify(entry)).toEqual(['notHost'])
    }
  })

  it('reports an IPv6 literal with a wildcard or a broken pair of brackets', () => {
    for (const entry of ['[*::1]', '[::1', '::1]', '[::1]x', '[]', '[g::1]']) {
      expect(fault(entry), entry).toEqual(['notHost'])
    }
  })

  it('reports an IPv6 address with no brackets', () => {
    for (const entry of ['::1', '::1:443', '2001:db8::1', 'fe80::1:2:3:4']) {
      expect(fault(entry), entry).toEqual(['unbracketedIpv6'])
    }
  })

  it('reports a name with two colons that is not an address', () => {
    expect(fault('host:80:90')).toEqual(['notHost'])
  })

  it('reports each faulty entry of the list, and no valid one', () => {
    const code = network('allowedDomains', 'a.com', 'a.com:0', 'b.com', 'https://c.com')
    expect(ids(code)).toEqual(['port', 'scheme'])
  })

  it('reports in every file', () => {
    for (const file of EVERY_FILE) {
      expect(fault('https://a.com', file), file).toEqual(['scheme'])
    }
  })

  it('names the entry in the message', () => {
    const [message] = lint(network('allowedDomains', 'a.com:080'))
    expect(message?.message).toContain('`a.com:080`')
  })

  it('says how to write the bracketed form for an IPv6 address', () => {
    const [message] = lint(network('allowedDomains', '::1'))
    expect(message?.message).toContain('`[::1]`')
  })
})

describe(`${name}: a managed file`, () => {
  it('says that an entry of deniedDomains withholds allowedDomains', () => {
    for (const file of [MANAGED, DROP_IN]) {
      const [message] = lint(network('deniedDomains', 'a.com:0'), file)
      expect(message?.message, file).toContain('withholds "sandbox.network.allowedDomains"')
    }
  })

  it('does not say it for allowedDomains, or in a project file', () => {
    const [allowed] = lint(network('allowedDomains', 'a.com:0'), MANAGED)
    expect(allowed?.message).not.toContain('withholds')
    for (const file of [PROJECT, LOCAL]) {
      const [denied] = lint(network('deniedDomains', 'a.com:0'), file)
      expect(denied?.message, file).not.toContain('withholds')
    }
  })
})

describe(`${name}: where the rule reports`, () => {
  it('reports the entry, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "network": {\n      "allowedDomains": [\n        "a.com",\n        "a.com:0"\n      ]\n    }\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[6, 9, 6, 18]])
  })

  it('reads the last of two keys of one name', () => {
    const first = '{"sandbox": {"network": {"allowedDomains": ["a.com:0"], "allowedDomains": []}}}'
    expect(ids(first)).toEqual([])
    const second = '{"sandbox": {"network": {"allowedDomains": [], "allowedDomains": ["a.com:0"]}}}'
    expect(ids(second)).toEqual(['port'])
    expect(ids('{"sandbox": {"network": {"allowedDomains": ["a.com:0"]}}, "sandbox": {}}')).toEqual(
      [],
    )
    expect(ids('{"sandbox": {"network": {"allowedDomains": ["a.com:0"]}, "network": {}}}')).toEqual(
      [],
    )
  })

  it('is silent when an object, a list or an entry has another type', () => {
    expect(ids({ sandbox: 'x' })).toEqual([])
    expect(ids({ sandbox: { network: 'x' } })).toEqual([])
    expect(ids({ sandbox: { network: [] } })).toEqual([])
    expect(ids({ sandbox: { network: { allowedDomains: 'a.com:0' } } })).toEqual([])
    expect(ids({ sandbox: { network: { allowedDomains: null } } })).toEqual([])
    expect(ids(network('allowedDomains', 1, null, ['a.com:0'], { a: 1 }))).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
  })

  it('is silent for the lists in another place or under another name', () => {
    expect(ids({ network: { allowedDomains: ['a.com:0'] } })).toEqual([])
    expect(ids({ sandbox: { allowedDomains: ['a.com:0'] } })).toEqual([])
    expect(ids(network('allowedHosts', 'a.com:0'))).toEqual([])
    expect(ids({ permissions: { allow: ['WebFetch(domain:a.com:0)'] } })).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(network('allowedDomains', 'a.com:0'), HIDDEN)).toEqual([])
  })
})
