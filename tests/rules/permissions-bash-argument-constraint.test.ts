// A Bash rule that constrains a URL is fragile; the docs advise WebFetch and a deny rule:
// https://code.claude.com/docs/en/permissions#read-only-commands
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-argument-constraint'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

describe(`${name}: the reports`, () => {
  it.fails('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(allow('Bash(curl http://github.com/ *)'), file), file).toEqual(['argument'])
    }
  })

  it.fails('reports wget, an exact rule, and a Monitor and a PowerShell rule', () => {
    expect(
      ids(
        allow(
          'Bash(wget https://example.com/a.tgz)',
          'Monitor(curl https://example.com/ *)',
          'PowerShell(curl https://example.com/ *)',
        ),
      ),
    ).toEqual(['argument', 'argument', 'argument'])
  })

  it.fails('reports a URL after an option, and a rule with the :* suffix', () => {
    expect(ids(allow('Bash(curl -sS https://api.example.com/v1:*)'))).toEqual(['argument'])
  })

  it.fails('names the rule and the host, and advises WebFetch and a deny rule', () => {
    const [message] = lint(allow('Bash(curl http://github.com/ *)'))
    expect(message?.message).toContain('`Bash(curl http://github.com/ *)`')
    expect(message?.message).toContain('`WebFetch(domain:github.com)`')
    expect(message?.message).toContain('`Bash(curl *)`')
    expect(message?.message).toContain('sandbox')
  })

  it.fails('writes a placeholder for a URL with no host', () => {
    const [message] = lint(allow('Bash(curl ://x *)'))
    expect(message?.message).toContain('`WebFetch(domain:<host>)`')
  })

  it.fails('names wget in the deny advice', () => {
    expect(lint(allow('Bash(wget http://a.test/ *)'))[0]?.message).toContain('`Bash(wget *)`')
  })

  it.fails('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(allow('Bash(curl https://a.test/)')))
    expect([message?.line, message?.column]).toEqual([1, 26])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent for the rule that the docs advise', () => {
    expect(ids(allow('WebFetch(domain:github.com)'))).toEqual([])
  })

  it.fails('is silent for a rule with no URL, and for other programs', () => {
    expect(
      ids(
        allow(
          'Bash(curl *)',
          'Bash(curl -s *)',
          'Bash(npm test)',
          'Bash(git clone https://a.test/r)',
        ),
      ),
    ).toEqual([])
  })

  it.fails('is silent when the URL is not in the rule', () => {
    expect(ids(allow('Bash(curl:*)', 'Bash(echo curl http://a.test/)'))).toEqual([])
  })

  it.fails('is silent in deny and ask, which hold no grant', () => {
    expect(
      ids({
        permissions: { deny: ['Bash(curl http://a.test/ *)'], ask: ['Bash(wget http://a.test/)'] },
      }),
    ).toEqual([])
  })

  it.fails('is silent for a rule that does not parse, in a hidden drop-in, and with no rules', () => {
    expect(ids(allow('Bash(curl http://a.test/'))).toEqual([])
    expect(ids(allow('Bash(curl http://a.test/ *)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
  })
})
