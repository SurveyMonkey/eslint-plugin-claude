// The sandbox honors two wildcard forms in a `WebFetch(domain:...)` rule: a leading `*.` and a
// bare `*`. A wildcard in any other position still matches fetches and has no effect on
// sandboxed commands:
// https://code.claude.com/docs/en/sandboxing#network-isolation
// https://code.claude.com/docs/en/permissions#webfetch
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-webfetch-mid-wildcard'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const settings = (fields: Record<string, string[]>, sandbox: unknown = { enabled: true }) =>
  JSON.stringify({ permissions: fields, sandbox })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports domain:example.* with sandbox.enabled true, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(settings({ allow: ['WebFetch(domain:example.*)'] }), file), file).toEqual([
        'inert',
      ])
    }
  })

  it('reports in allow and deny, which the sandbox reads as its domain lists', () => {
    for (const list of ['allow', 'deny']) {
      expect(ids(settings({ [list]: ['WebFetch(domain:example.*)'] })), list).toEqual(['inert'])
    }
  })

  it('reports a wildcard in the middle or in a label, and one after a leading *.', () => {
    const rules = [
      'a.*.com',
      'ex*.com',
      '*.example.*',
      '*.*',
      '**.example.com',
      'api.*',
      '*example.com',
    ]
    for (const host of rules) {
      expect(ids(settings({ allow: [`WebFetch(domain:${host})`] })), host).toEqual(['inert'])
    }
  })

  it('reads white space and a trailing dot around the host', () => {
    expect(ids(settings({ allow: ['WebFetch( domain : example.*. )'] }))).toEqual(['inert'])
  })

  it('reports each entry, at its line and column, and names the rule', () => {
    const text = JSON.stringify(
      {
        permissions: { allow: ['Bash', 'WebFetch(domain:example.*)'] },
        sandbox: { enabled: true },
      },
      null,
      2,
    )
    const messages = lintJson(name, text, PROJECT)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([[5, 7]])
    expect(messages[0]?.message).toContain('WebFetch(domain:example.*)')
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent without sandbox.enabled, or with it false or not a Boolean', () => {
    const rules = { allow: ['WebFetch(domain:example.*)'] }
    for (const sandbox of [null, {}, { enabled: false }, { enabled: 'true' }, 'on', []]) {
      expect(ids(settings(rules, sandbox)), JSON.stringify(sandbox)).toEqual([])
    }
  })

  it('is silent for the two forms that the sandbox honors', () => {
    const rules = ['WebFetch(domain:*.example.com)', 'WebFetch(domain:*)', 'WebFetch( domain : * )']
    expect(ids(settings({ allow: rules, deny: rules }))).toEqual([])
  })

  it('is silent for a host with no wildcard, a bare WebFetch, and another tool', () => {
    const rules = [
      'WebFetch(domain:example.com)',
      'WebFetch',
      'WebFetch(example.*)',
      'Read(domain:example.*)',
    ]
    expect(ids(settings({ allow: rules }))).toEqual([])
  })

  it('is silent in ask, which the sandbox does not read', () => {
    expect(ids(settings({ ask: ['WebFetch(domain:example.*)'] }))).toEqual([])
  })

  it('is silent for a parameter rule in deny', () => {
    expect(ids(settings({ deny: ['WebFetch(prompt:example.*)'] }))).toEqual([])
  })

  it('reads sandbox.enabled in the same file only', () => {
    const root = repo({
      '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }),
    })
    const text = JSON.stringify({ permissions: { allow: ['WebFetch(domain:example.*)'] } })
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(settings({ allow: ['WebFetch(domain:example.*)'] }), HIDDEN)).toEqual([])
  })

  it('is silent when a list or an entry is not a string', () => {
    const text = JSON.stringify({
      permissions: { allow: [1, 'WebFetch(domain:example.*'] },
      sandbox: { enabled: true },
    })
    expect(ids(text)).toEqual([])
  })
})

describe(`${name}: the allow rule that permissions-dead-allow owns`, () => {
  const RULE = 'WebFetch(domain:example.*)'
  const rootWith = (files: Record<string, string>) =>
    path.join(repo(files), '.claude/settings.json')

  it('is silent for an allow rule that an equal deny or ask rule, or a bare deny, covers', () => {
    expect(ids(settings({ allow: [RULE], ask: [RULE] }))).toEqual([])
    expect(ids(settings({ allow: [RULE], deny: ['WebFetch'] }))).toEqual([])
  })

  it('reports the deny rule that covers the allow rule', () => {
    expect(ids(settings({ allow: [RULE], deny: [RULE] }))).toEqual(['inert'])
  })

  it('is silent when the other file of the pair holds the covering rule', () => {
    const file = rootWith({ '.claude/settings.local.json': settings({ deny: [RULE] }) })
    expect(lintJson(name, settings({ allow: [RULE] }), file)).toEqual([])
    const open = rootWith({ '.claude/settings.local.json': settings({ deny: ['Bash'] }) })
    expect(lintJson(name, settings({ allow: [RULE] }), open).map((m) => m.messageId)).toEqual([
      'inert',
    ])
  })
})
