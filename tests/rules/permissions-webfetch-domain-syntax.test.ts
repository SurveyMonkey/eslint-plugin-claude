// The permissions page, "WebFetch": a rule uses a `domain:` prefix and matches the hostname of
// the requested URL. It supports `*` wildcards, and strips a trailing `.` from the rule and the
// hostname:
// https://code.claude.com/docs/en/permissions#webfetch
// The tools reference lists `WebFetch(domain:example.com)` as the rule form:
// https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-webfetch-domain-syntax'
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
const list = (key: 'allow' | 'ask' | 'deny', ...rules: string[]) => ({
  permissions: { [key]: rules },
})

describe(`${name}: the host forms of the docs`, () => {
  it('is silent for a hostname, a wildcard, and a bare WebFetch', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(
        ids(
          list(
            'allow',
            'WebFetch(domain:example.com)',
            'WebFetch(domain:*.example.com)',
            'WebFetch(domain:*)',
            'WebFetch(domain:example.*)',
            'WebFetch',
          ),
          file,
        ),
        file,
      ).toEqual([])
    }
  })

  it('is silent for a trailing dot, upper case, a digit, a hyphen and an underscore', () => {
    for (const host of ['example.com.', 'Example.COM', 'a-b.example.com', 'a1.b2.io', 'a_b.test']) {
      expect(ids(list('allow', `WebFetch(domain:${host})`)), host).toEqual([])
    }
  })

  it('is silent for an IPv4 address, a bracketed IPv6 address, and a name with no dot', () => {
    for (const host of ['127.0.0.1', '[::1]', '[2001:db8::1]', 'intranet']) {
      expect(ids(list('allow', `WebFetch(domain:${host})`)), host).toEqual([])
    }
  })

  it('is silent for white space around the prefix and the host', () => {
    expect(ids(list('allow', 'WebFetch( domain : example.com )'))).toEqual([])
  })

  it('is silent in deny and ask, where the same forms are valid', () => {
    for (const key of ['deny', 'ask'] as const) {
      expect(
        ids(list(key, 'WebFetch(domain:example.com)', 'WebFetch(domain:*)', 'WebFetch')),
        key,
      ).toEqual([])
    }
  })
})

describe(`${name}: the reports`, () => {
  it('reports a URL scheme, in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('allow', 'WebFetch(domain:https://example.com)'), file), file).toEqual([
        'scheme',
      ])
    }
  })

  it('reports a path, a query and a fragment', () => {
    for (const host of ['example.com/docs', 'example.com/', 'example.com?q=1', 'example.com#top']) {
      expect(ids(list('allow', `WebFetch(domain:${host})`)), host).toEqual(['path'])
    }
  })

  it('reports a port, for a name, an address and a bracketed IPv6 address', () => {
    for (const host of ['example.com:8080', '127.0.0.1:3000', '[::1]:8080', '*.example.com:443']) {
      expect(ids(list('allow', `WebFetch(domain:${host})`)), host).toEqual(['port'])
    }
  })

  it('reports an empty host and a host with a character that no hostname holds', () => {
    for (const host of ['', 'user@example.com', 'exa mple.com', 'example.com:', 'a\\b', 'a:b']) {
      expect(ids(list('allow', `WebFetch(domain:${host})`)), host).toEqual(['notHost'])
    }
  })

  it('reports a specifier with no domain: prefix, in allow', () => {
    for (const specifier of ['example.com', '*.example.com', 'url:https://example.com', '']) {
      expect(ids(list('allow', `WebFetch(${specifier})`)), specifier).toEqual(['missingPrefix'])
    }
  })

  it('reports a specifier with no domain: prefix, in deny and ask, when it is no parameter', () => {
    for (const key of ['deny', 'ask'] as const) {
      expect(ids(list(key, 'WebFetch(example.com)', 'WebFetch(*.example.com)')), key).toEqual([
        'missingPrefix',
        'missingPrefix',
      ])
    }
  })

  it('reports a URL as a whole, in allow, deny and ask', () => {
    for (const key of ['allow', 'deny', 'ask'] as const) {
      expect(
        ids(list(key, 'WebFetch(https://example.com/docs)', 'WebFetch(http://x.io)')),
        key,
      ).toEqual(['scheme', 'scheme'])
    }
  })

  it('reports the prefix of another case as no domain: prefix', () => {
    expect(ids(list('allow', 'WebFetch(Domain:example.com)'))).toEqual(['missingPrefix'])
  })

  it('reports one fault for an entry: the scheme before the path and the port', () => {
    expect(ids(list('allow', 'WebFetch(domain:https://example.com:8080/docs)'))).toEqual(['scheme'])
    expect(ids(list('allow', 'WebFetch(domain:example.com:8080/docs)'))).toEqual(['path'])
  })

  it('says what is wrong and what the rule takes', () => {
    const cases: [string, string, string][] = [
      ['WebFetch(domain:https://example.com)', 'scheme', 'https://example.com'],
      ['WebFetch(domain:example.com/docs)', 'path', 'example.com/docs'],
      ['WebFetch(domain:example.com:8080)', 'port', 'example.com:8080'],
      ['WebFetch(domain:a@b)', 'not a hostname', 'a@b'],
      ['WebFetch(example.com)', 'domain:', 'example.com'],
    ]
    for (const [rule, text, shown] of cases) {
      const [message] = lint(list('allow', rule))
      expect(message?.message, rule).toContain(text)
      expect(message?.message, rule).toContain(`\`${shown}\``)
      expect(message?.message, rule).toContain('hostname')
    }
  })

  it('reports each entry once, at its line, column and end', () => {
    const [message, ...rest] = lint(
      JSON.stringify(list('allow', 'WebFetch(domain:a/b)', 'WebFetch(domain:a.b)')),
    )
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 48,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent for a parameter rule in deny and ask, which permissions-param-rule reads', () => {
    for (const key of ['deny', 'ask'] as const) {
      expect(
        ids(list(key, 'WebFetch(prompt:*)', 'WebFetch(url:https://example.com)')),
        key,
      ).toEqual([])
    }
  })

  it('is silent for other tools, even with a domain: specifier', () => {
    expect(
      ids(list('allow', 'Read(domain:https://x.com)', 'Bash(curl https://x.com)', 'WebSearch')),
    ).toEqual([])
  })

  it('is silent for a string that does not parse, which permissions-rule-syntax reads', () => {
    expect(
      ids(list('allow', 'WebFetch(domain:a/b', 'WebFetch(domain:a/b) c', '(domain:a/b)')),
    ).toEqual([])
  })

  it('is silent for an entry that is not a string, and for lists that are not arrays', () => {
    expect(ids({ permissions: { allow: [3, null, 'WebFetch(domain:a/b)'] } })).toEqual(['path'])
    expect(ids({ permissions: { allow: 'WebFetch(domain:a/b)', deny: { a: 1 } } })).toEqual([])
    expect(ids({ permissions: 'WebFetch(domain:a/b)' })).toEqual([])
    expect(ids({ allow: ['WebFetch(domain:a/b)'] })).toEqual([])
  })

  it('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(list('allow', 'WebFetch(domain:a/b)'), HIDDEN)).toEqual([])
  })
})
