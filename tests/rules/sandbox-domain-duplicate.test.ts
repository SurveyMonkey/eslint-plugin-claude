// A domain list holds an entry twice, with or without the final dot that marks a fully
// qualified name: `example.com.` blocks the same connections as `example.com`:
// https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains
// The rule reads one file. A list that two files hold is not added up.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-domain-duplicate'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const network = (fields: object) => JSON.stringify({ sandbox: { network: fields } })
const run = (text: string, file = PROJECT) => lintJson(name, text, file)
const ids = (text: string, file = PROJECT) => run(text, file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports a repeated entry of either list, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const list of ['allowedDomains', 'deniedDomains']) {
        expect(
          ids(network({ [list]: ['example.com', 'example.com'] }), file),
          `${list} ${file}`,
        ).toEqual(['duplicate'])
      }
    }
  })

  it('reports example.com and example.com. once', () => {
    expect(ids(network({ allowedDomains: ['example.com', 'example.com.'] }))).toEqual(['duplicate'])
    expect(ids(network({ deniedDomains: ['example.com.', 'example.com'] }))).toEqual(['duplicate'])
  })

  it('counts letter case and a port as part of the entry', () => {
    expect(ids(network({ allowedDomains: ['Example.COM', 'example.com'] }))).toEqual(['duplicate'])
    expect(ids(network({ allowedDomains: ['a.com:443', 'a.com.:443'] }))).toEqual(['duplicate'])
    expect(ids(network({ allowedDomains: ['*.a.com', '*.a.com'] }))).toEqual(['duplicate'])
    expect(ids(network({ allowedDomains: ['[::1]', '[::1]'] }))).toEqual(['duplicate'])
  })

  it('reports each later copy, at its line and column, and names the first', () => {
    const text =
      '{\n  "sandbox": {\n    "network": {\n      "allowedDomains": ["a.com", "b.com", "a.com", "a.com."]\n    }\n  }\n}'
    const messages = run(text)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([
      [4, 44],
      [4, 53],
    ])
    expect(messages[0]?.message).toContain('a.com')
  })

  it('reads each list alone', () => {
    expect(
      ids(network({ allowedDomains: ['a.com', 'a.com'], deniedDomains: ['b.com', 'b.com'] })),
    ).toEqual(['duplicate', 'duplicate'])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for distinct domains', () => {
    expect(ids(network({ allowedDomains: ['a.com', 'b.com', '*.a.com'] }))).toEqual([])
  })

  it('is silent for the same host with another port, or with and without a port', () => {
    expect(ids(network({ allowedDomains: ['a.com', 'a.com:443', 'a.com:80'] }))).toEqual([])
  })

  it('is silent for a domain in both lists, which sandbox-domain-overlap reports', () => {
    expect(ids(network({ allowedDomains: ['a.com'], deniedDomains: ['a.com'] }))).toEqual([])
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(network({ allowedDomains: [1, 1, null, null] }))).toEqual([])
    expect(ids(network({ allowedDomains: 'a.com', deniedDomains: { a: 1 } }))).toEqual([])
    expect(ids(network({ allowedDomains: [1, 'a.com', 'a.com'] }))).toEqual(['duplicate'])
  })

  it('is silent with no sandbox, and for a root that is not an object', () => {
    expect(ids('{}')).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(network({ allowedDomains: ['a.com', 'a.com'] }), HIDDEN)).toEqual([])
  })
})
