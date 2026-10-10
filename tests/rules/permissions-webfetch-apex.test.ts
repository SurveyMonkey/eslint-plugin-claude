// `WebFetch(domain:*.example.com)` matches any subdomain, but not `example.com` itself. The apex
// needs a rule of its own. Matching ignores case and a trailing dot:
// https://code.claude.com/docs/en/permissions#webfetch
// The rule adds up each list over one source, so the tests use files on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-webfetch-apex'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const run = (text: string, file = PROJECT, files: Record<string, string> = {}) =>
  lintJson(name, text, path.join(repo(files), file))
const ids = (text: string, file = PROJECT, files: Record<string, string> = {}) =>
  run(text, file, files).map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports a wildcard subdomain rule alone in its list, in every file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(perms({ allow: ['WebFetch(domain:*.example.com)'] }), file), file).toEqual([
        'apex',
      ])
    }
  })

  it('reports in allow, ask and deny', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['WebFetch(domain:*.example.com)'] })), list).toEqual(['apex'])
    }
  })

  it('names the apex rule to add, and reports at the entry', () => {
    const text =
      '{\n  "permissions": {\n    "allow": ["Bash", "WebFetch(domain:*.Example.com.)"]\n  }\n}'
    const messages = run(text)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([[3, 23]])
    expect(messages[0]?.message).toContain('WebFetch(domain:example.com)')
  })

  it('reports when the apex rule is in another list', () => {
    expect(
      ids(
        perms({
          allow: ['WebFetch(domain:*.example.com)'],
          deny: ['WebFetch(domain:example.com)'],
        }),
      ),
    ).toEqual(['apex'])
  })

  it('reports when the rule with the apex names another host', () => {
    expect(
      ids(
        perms({
          allow: [
            'WebFetch(domain:*.example.com)',
            'WebFetch(domain:example.org)',
            'WebFetch(domain:sub.example.com)',
          ],
        }),
      ),
    ).toEqual(['apex'])
  })

  it('reports each wildcard rule that has no apex rule, with white space around the prefix', () => {
    const rules = [
      'WebFetch( domain : *.a.com )',
      'WebFetch(domain:*.b.com)',
      'WebFetch(domain:b.com)',
    ]
    expect(ids(perms({ allow: rules }))).toEqual(['apex'])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when the same list has the apex rule', () => {
    expect(
      ids(perms({ allow: ['WebFetch(domain:*.example.com)', 'WebFetch(domain:example.com)'] })),
    ).toEqual([])
  })

  it('compares without case and without a trailing dot', () => {
    for (const apex of [
      'WebFetch(domain:EXAMPLE.com)',
      'WebFetch(domain:example.com.)',
      'WebFetch(domain: example.com )',
    ]) {
      expect(ids(perms({ allow: ['WebFetch(domain:*.example.com)', apex] })), apex).toEqual([])
    }
    expect(
      ids(perms({ allow: ['WebFetch(domain:*.Example.COM.)', 'WebFetch(domain:example.com)'] })),
    ).toEqual([])
  })

  it('is silent when a bare WebFetch rule or domain:* is in the same list', () => {
    for (const cover of ['WebFetch', 'WebFetch(domain:*)']) {
      expect(ids(perms({ allow: ['WebFetch(domain:*.example.com)', cover] })), cover).toEqual([])
    }
  })

  it('is silent for a rule that is not a leading *. rule', () => {
    const rules = [
      'WebFetch(domain:example.com)',
      'WebFetch(domain:*)',
      'WebFetch(domain:example.*)',
      'WebFetch(domain:*.example.*)',
      'WebFetch(domain:*.*.example.com)',
      'WebFetch(domain:*.)',
      'WebFetch(domain:*example.com)',
      'WebFetch(*.example.com)',
      'WebFetch',
      'Read(domain:*.example.com)',
    ]
    expect(ids(perms({ allow: rules }))).toEqual([])
  })

  it('reports when the list holds only a WebFetch rule that has no domain prefix', () => {
    const rules = ['WebFetch(domain:*.example.com)', 'WebFetch(example.com)']
    expect(ids(perms({ allow: rules }))).toEqual(['apex'])
    expect(ids(perms({ deny: ['WebFetch(domain:*.example.com)', 'WebFetch(prompt:*)'] }))).toEqual([
      'apex',
    ])
  })

  it('is silent for a parameter rule in deny', () => {
    expect(ids(perms({ deny: ['WebFetch(prompt:*)'] }))).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['WebFetch(domain:*.example.com)'] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the allow rule that permissions-dead-allow owns`, () => {
  it('skips an allow rule that a deny or ask rule covers, and reports the equal deny rule', () => {
    const rule = 'WebFetch(domain:*.example.com)'
    expect(ids(perms({ allow: [rule], deny: [rule] }))).toEqual(['apex'])
    expect(ids(perms({ allow: [rule], ask: ['WebFetch'] }))).toEqual([])
    expect(ids(perms({ allow: [rule], deny: ['WebFetch'] }))).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  const WILD = perms({ allow: ['WebFetch(domain:*.example.com)'] })
  const APEX = perms({ allow: ['WebFetch(domain:example.com)'] })

  it('adds up the same list of the other file, whichever file holds the wildcard rule', () => {
    expect(ids(WILD, PROJECT, { [LOCAL]: APEX })).toEqual([])
    expect(ids(WILD, LOCAL, { [PROJECT]: APEX })).toEqual([])
  })

  it('reports when the apex rule of the other file is in another list', () => {
    const files = { [LOCAL]: perms({ deny: ['WebFetch(domain:example.com)'] }) }
    expect(ids(WILD, PROJECT, files)).toEqual(['apex'])
  })

  it('is silent when the other file cannot be read, because it can hold the apex rule', () => {
    expect(ids(WILD, PROJECT, { [LOCAL]: '[1]' })).toEqual([])
  })

  it('is silent when the deny rule of the other file covers the allow rule', () => {
    const files = { [LOCAL]: perms({ deny: ['WebFetch(domain:*.example.com)'] }) }
    expect(ids(WILD, PROJECT, files)).toEqual([])
  })

  it('reads a sibling list that is not an array, and entries that are no rule, as no rule', () => {
    const odd = JSON.stringify({
      permissions: { allow: [1, 'WebFetch(', 'WebFetch(domain:example.com)'] },
    })
    expect(ids(WILD, PROJECT, { [LOCAL]: odd })).toEqual([])
    const notList = JSON.stringify({ permissions: { allow: 'WebFetch' } })
    expect(ids(WILD, PROJECT, { [LOCAL]: notList })).toEqual(['apex'])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const WILD = perms({ allow: ['WebFetch(domain:*.example.com)'] })
  const APEX = perms({ allow: ['WebFetch(domain:example.com)'] })

  it('adds up the same list of the files of the source', () => {
    expect(ids(WILD, DROP_IN, { [MANAGED]: APEX })).toEqual([])
    expect(ids(WILD, MANAGED, { 'managed-settings.d/20-b.json': APEX })).toEqual([])
  })

  it('ignores a hidden sibling, and a project file', () => {
    expect(ids(WILD, DROP_IN, { 'managed-settings.d/.20-b.json': APEX })).toEqual(['apex'])
    expect(ids(WILD, MANAGED, { [PROJECT]: APEX })).toEqual(['apex'])
  })

  it('is silent when a sibling cannot be read', () => {
    expect(ids(WILD, DROP_IN, { 'managed-settings.d/20-b.json': '[1]' })).toEqual([])
  })
})
