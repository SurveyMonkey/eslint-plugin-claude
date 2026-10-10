// A denied domain stays blocked although an `allowedDomains` entry matches it too:
// https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains
// The rule adds up the lists of one source: the project pair, or one managed source.
// The tests of a source use files on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-domain-overlap'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'

const network = (fields: object) => JSON.stringify({ sandbox: { network: fields } })
const at = (root: string, file: string, text: string) =>
  lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
const alone = (text: string, file = PROJECT) => at(repo({}), file, text)
const both = (allowed: string[], denied: string[]) =>
  network({ allowedDomains: allowed, deniedDomains: denied })

describe(`${name}: one file`, () => {
  it('reports a domain that is in both lists', () => {
    expect(alone(both(['example.com'], ['example.com']))).toEqual(['overlap'])
  })

  it('reports the allowed entry, at its line and column, and names the domain', () => {
    const text =
      '{\n  "sandbox": {\n    "network": {\n      "allowedDomains": ["a.com", "example.com"],\n      "deniedDomains": ["example.com"]\n    }\n  }\n}'
    const [message] = lintJson(name, text, '/repo/.claude/settings.json')
    expect([message?.line, message?.column]).toEqual([4, 35])
    expect(message?.message).toContain('example.com')
  })

  it('reports each allowed entry that a denied entry covers', () => {
    expect(alone(both(['a.com', 'b.com', 'a.com'], ['a.com']))).toEqual(['overlap', 'overlap'])
  })

  it('counts a trailing dot and a letter case as the same domain', () => {
    expect(alone(both(['example.com.'], ['example.com']))).toEqual(['overlap'])
    expect(alone(both(['Example.COM'], ['example.com.']))).toEqual(['overlap'])
    expect(alone(both(['example.com.:443'], ['example.com:443']))).toEqual(['overlap'])
  })

  it('reports an allowed entry with a port under a denied entry with no port', () => {
    expect(alone(both(['example.com:443'], ['example.com']))).toEqual(['overlap'])
    expect(alone(both(['example.com:443'], ['example.com:443']))).toEqual(['overlap'])
    expect(alone(both(['[::1]:443'], ['[::1]']))).toEqual(['overlap'])
  })

  it('is silent for an allowed entry with no port under a denied entry with a port', () => {
    expect(alone(both(['example.com'], ['example.com:443']))).toEqual([])
    expect(alone(both(['example.com:80'], ['example.com:443']))).toEqual([])
  })

  it('is silent for different domains, a wildcard, and one list', () => {
    expect(alone(both(['*.example.com'], ['api.example.com']))).toEqual([])
    expect(alone(both(['api.example.com'], ['*.example.com']))).toEqual([])
    expect(alone(both(['a.com'], ['b.com']))).toEqual([])
    expect(alone(network({ allowedDomains: ['a.com'] }))).toEqual([])
    expect(alone(network({ deniedDomains: ['a.com'] }))).toEqual([])
    expect(alone('{}')).toEqual([])
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(alone(both([1 as never, 'a.com'], [null as never, 'a.com']))).toEqual(['overlap'])
    expect(alone(network({ allowedDomains: 'a.com', deniedDomains: 'a.com' }))).toEqual([])
  })

  it('reports in a managed file and a drop-in', () => {
    expect(alone(both(['a.com'], ['a.com']), MANAGED)).toEqual(['overlap'])
    expect(alone(both(['a.com'], ['a.com']), DROP_IN)).toEqual(['overlap'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(both(['a.com'], ['a.com']), 'managed-settings.d/.10-a.json')).toEqual([])
  })

  it('is silent when the root is not an object', () => {
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  const ALLOW = network({ allowedDomains: ['a.com'] })
  const DENY = network({ deniedDomains: ['a.com'] })

  it('adds up the denied domains of the other file', () => {
    const root = repo({ [PROJECT]: ALLOW, [LOCAL]: DENY })
    expect(at(root, PROJECT, ALLOW)).toEqual(['overlap'])
    expect(at(root, LOCAL, DENY)).toEqual([])
    const swapped = repo({ [PROJECT]: DENY, [LOCAL]: ALLOW })
    expect(at(swapped, LOCAL, ALLOW)).toEqual(['overlap'])
  })

  it('is silent when the other file denies another domain', () => {
    const root = repo({ [LOCAL]: network({ deniedDomains: ['b.com'] }) })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: DENY })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
  })

  it('adds nothing for a sibling that does not read', () => {
    const root = repo({ [LOCAL]: '[1]' })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
    expect(at(root, PROJECT, both(['a.com'], ['a.com']))).toEqual(['overlap'])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const ALLOW = network({ allowedDomains: ['a.com'] })
  const DENY = network({ deniedDomains: ['a.com'] })

  it('adds up the denied domains of the other files of the source', () => {
    const root = repo({ [MANAGED]: DENY })
    expect(at(root, DROP_IN, ALLOW)).toEqual(['overlap'])
    const main = repo({ 'managed-settings.d/20-b.json': DENY })
    expect(at(main, MANAGED, ALLOW)).toEqual(['overlap'])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: DENY, [LOCAL]: DENY })
    expect(at(root, MANAGED, ALLOW)).toEqual([])
  })

  it('ignores a hidden sibling and a sibling that does not read', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': DENY })
    expect(at(hidden, DROP_IN, ALLOW)).toEqual([])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(bad, DROP_IN, ALLOW)).toEqual([])
  })

  it('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'managed-settings.d/20-b.json': DENY })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, ALLOW)).toEqual([])
  })
})
