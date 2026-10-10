// The permissions page, "Read and Edit": `Read` and `Edit` rules use gitignore pattern syntax.
// "A deny or ask rule whose path isn't usable as a gitignore pattern still guards that exact
// path. An allow rule with an unusable pattern doesn't approve anything."
// https://code.claude.com/docs/en/permissions#read-and-edit
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-invalid-path-pattern'
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

describe(`${name}: the reports`, () => {
  it('reports an unclosed bracket in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('allow', 'Edit(docs/[draft/**)'), file), file).toEqual(['approvesNothing'])
    }
  })

  it('reports an allow rule as one that approves nothing', () => {
    const [message] = lint(list('allow', 'Read(src/[a-z.ts)'))
    expect(message?.messageId).toBe('approvesNothing')
    expect(message?.message).toContain('`Read(src/[a-z.ts)`')
    expect(message?.message).toContain('approves nothing')
  })

  it('reports a deny or ask rule as one that guards the literal path only', () => {
    for (const key of ['deny', 'ask'] as const) {
      const [message, ...rest] = lint(list(key, 'Read(./secrets[1/**)'))
      expect(rest).toEqual([])
      expect(message?.messageId, key).toBe('guardsLiteralPath')
      expect(message?.message, key).toContain(`\`${key}\``)
      expect(message?.message, key).toContain('guards only the literal path')
    }
  })

  it('reports for Read and Edit, and for a bracket in each position', () => {
    for (const rule of [
      'Read([)',
      'Edit(a[)',
      'Edit(a[b)',
      'Read([!a)',
      'Read([^a)',
      'Read([]a)',
      'Read([!]a)',
      'Read([^]a)',
      'Read(a/[b/c/**)',
      'Read(a\\\\[b)',
      'Read(!a[b)',
      'Read(~/a[b)',
      'Read(a[b]c[d)',
      'Read([a][b)',
    ]) {
      expect(ids(list('deny', rule)), rule).toEqual(['guardsLiteralPath'])
    }
  })

  it('reports a deny or ask rule in the form of a parameter name of one letter', () => {
    // A one-letter name is a path with a colon, as in `permissions-windows-path`.
    expect(ids(list('deny', 'Read(a:[b)'))).toEqual(['guardsLiteralPath'])
  })

  it('reports each entry once, at its line, column and end', () => {
    const [message, ...rest] = lint(JSON.stringify(list('deny', 'Read(a[b)', 'Read(a/b)')))
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 25, 1, 36,
    ])
  })
})

describe(`${name}: the patterns that it leaves alone`, () => {
  it('is silent for a closed bracket expression', () => {
    for (const rule of [
      'Read(src/[ab].ts)',
      'Read([a-z]*.ts)',
      'Read([!a].ts)',
      'Read([^a].ts)',
      'Read([]].ts)',
      'Read([!]].ts)',
      'Read([[])',
      'Read([a[b])',
      'Edit(**/[Dd]ocs/**)',
      'Read(a[b]c[d]e)',
    ]) {
      expect(ids(list('allow', rule)), rule).toEqual([])
    }
  })

  it('is silent for an escaped bracket, as Claude Code writes after "don\'t ask again"', () => {
    for (const rule of [
      'Read(./\\[2024-06\\] Reports/**)',
      'Read(a\\[b)',
      'Read(a\\\\\\[b)',
      'Read(a\\[b\\])',
      'Read(a]b)',
      'Read(a\\])',
    ]) {
      expect(ids(list('allow', rule)), rule).toEqual([])
    }
  })

  it('is silent for the parentheses of a path, which need no escape', () => {
    expect(ids(list('allow', 'Edit(./Finance (2024)/**)'))).toEqual([])
  })

  it('is silent for the tools that take no gitignore pattern', () => {
    // `Cd` matches the whole path, and `Write(path)` is for permissions-path-rule-tool.
    expect(
      ids(list('allow', 'Cd(~/a[b)', 'Write(a[b)', 'Glob(a[b)', 'Bash(ls [a)', 'Grep(a[b)')),
    ).toEqual([])
  })

  it('is silent for a parameter rule, which permissions-param-rule reads', () => {
    expect(ids(list('deny', 'Read(offset:[5)', 'Edit(old_string:[)'))).toEqual([])
  })

  it('is silent for a bare tool name and an empty specifier', () => {
    expect(ids(list('allow', 'Read', 'Edit', 'Read()'))).toEqual([])
  })

  it('is silent for a string that does not parse, which permissions-rule-syntax reads', () => {
    expect(ids(list('allow', 'Read(a[b', 'Read(a[b) c', '(a[b)'))).toEqual([])
  })

  it('is silent for an entry that is not a string, and for lists that are not arrays', () => {
    expect(ids({ permissions: { allow: [3, null, 'Read(a[b)'] } })).toEqual(['approvesNothing'])
    expect(ids({ permissions: { allow: 'Read(a[b)', deny: { a: 1 } } })).toEqual([])
    expect(ids({ permissions: 'Read(a[b)' })).toEqual([])
    expect(ids({ allow: ['Read(a[b)'] })).toEqual([])
  })

  it('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(list('allow', 'Read(a[b)'), HIDDEN)).toEqual([])
  })
})
