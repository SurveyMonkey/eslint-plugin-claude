// A `*` before the subcommand in an allow rule also matches the options that sit at that
// position, so `Bash(git * main)` approves `git -c core.fsmonitor=<script> diff main`:
// https://code.claude.com/docs/en/permissions#wildcard-patterns
// https://code.claude.com/docs/en/errors#has-a-wildcard-before-the-rest-of-the-command
// The rule reads allow rules only, and each command tool of the permissions page.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-wildcard-before-subcommand'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

describe(`${name}: the reports`, () => {
  it('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(allow('Bash(git * main)'), file), file).toEqual(['wildcard'])
    }
  })

  it('reports a * before the subcommand, and a * as the first word', () => {
    for (const rule of [
      'Bash(git * main)',
      'Bash(git -C * status *)',
      'Bash(git -c * diff main)',
      'Bash(* --version)',
      'Bash(* --help *)',
      'Bash(docker * ps)',
      'Bash(git * status:*)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual(['wildcard'])
    }
  })

  it('reports the tools that take the pattern of a Bash rule', () => {
    for (const tool of ['Monitor', 'PowerShell']) {
      expect(ids(allow(`${tool}(git * main)`)), tool).toEqual(['wildcard'])
    }
  })

  it('reports each entry once', () => {
    expect(ids(allow('Bash(git * main)', 'Bash(npm run *)', 'Bash(* --version)'))).toEqual([
      'wildcard',
      'wildcard',
    ])
  })

  it('names the rule, and says that it matches options without a prompt', () => {
    const [message] = lint(allow('Bash(git * main)'))
    expect(message?.message).toContain('`Bash(git * main)`')
    expect(message?.message).toContain('options')
    expect(message?.message).toContain('more than you intend')
  })

  it('reports the entry, at its line, column and end', () => {
    const [message] = lint(JSON.stringify(allow('Bash(git * main)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 44,
    ])
  })

  it('reads the last of two keys of one name', () => {
    expect(
      ids('{"permissions": {"allow": ["Bash(git * main)"], "allow": ["Bash(git log *)"]}}'),
    ).toEqual([])
    expect(
      ids('{"permissions": {"allow": ["Bash(git log *)"], "allow": ["Bash(git * main)"]}}'),
    ).toEqual(['wildcard'])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent when the * comes after the subcommand', () => {
    for (const rule of [
      'Bash(git log * main)',
      'Bash(npm run *)',
      'Bash(git status *)',
      'Bash(git commit -m *)',
      'Bash(ls *)',
      'Bash(git *)',
      'Bash(git:*)',
      'Bash(git status)',
      'Bash(git -C . status *)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a rule with no word after the first *', () => {
    for (const rule of ['Bash(*)', 'Bash(* *)', 'Bash(git * *)', 'Bash', 'Bash()', 'Bash( )']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a * that is part of a word, and for a :* in the middle', () => {
    for (const rule of ['Bash(ls*)', 'Bash(git sta* main)', 'Bash(git:* push)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent when a word that is not an option comes before the *', () => {
    expect(ids(allow('Bash(docker -H host * ps)'))).toEqual([])
  })

  it('is silent for a tool that takes no command pattern', () => {
    for (const rule of ['Read(* foo)', 'Edit(* --version)', 'WebFetch(domain:*)', 'Skill(* x)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent in deny and ask, which the docs do not warn about', () => {
    expect(
      ids({ permissions: { deny: ['Bash(git * main)'], ask: ['Bash(* --version)'] } }),
    ).toEqual([])
  })

  it('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids(allow('Bash(git * main'))).toEqual([])
    expect(ids(allow('(git * main)'))).toEqual([])
  })

  it('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { allow: [3, null, ['Bash(git * main)']] } })).toEqual([])
    expect(ids({ permissions: { allow: 'Bash(git * main)' } })).toEqual([])
    expect(ids({ permissions: 'Bash(git * main)' })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(allow('Bash(git * main)'), HIDDEN)).toEqual([])
  })

  it('is silent when a hyphen sits inside a subcommand, and names the tool in the message', () => {
    expect(ids(allow('Bash(git cherry-pick * main)', 'Bash(npm run-script * x)'))).toEqual([])
    expect(lint(allow('PowerShell(git * main)'))[0]?.message).toContain('`PowerShell(git * main)`')
  })
})
