// The permissions page, "Read and Edit": on Windows, Claude Code normalizes a path to POSIX form
// before it matches, so `C:\Users\alice` becomes `/c/Users/alice`, and a rule uses `//c/...`:
// https://code.claude.com/docs/en/permissions#read-and-edit
// A `Cd` rule shares the anchors of the `Read` and `Edit` rules:
// https://code.claude.com/docs/en/permissions#cd
// `Write(path)` rules are for `permissions-path-rule-tool`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-windows-path'
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
  it('reports a drive letter in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('deny', 'Read(C:\\Users\\alice\\.env)'), file), file).toEqual(['driveLetter'])
    }
  })

  it('reports a drive letter in allow, ask and deny, for Read, Edit and Cd', () => {
    for (const key of ['allow', 'ask', 'deny'] as const) {
      for (const tool of ['Read', 'Edit', 'Cd']) {
        expect(ids(list(key, `${tool}(C:\\Users\\alice)`)), `${key} ${tool}`).toEqual([
          'driveLetter',
        ])
      }
    }
  })

  it('reports a drive letter with a slash, in lower and upper case', () => {
    expect(ids(list('allow', 'Read(c:/Users/alice/**)', 'Edit(D:/work/**)'))).toEqual([
      'driveLetter',
      'driveLetter',
    ])
  })

  it('reports a backslash as a separator, with or without a drive letter', () => {
    for (const rule of [
      'Read(src\\app\\*.ts)',
      'Edit(.\\src\\**)',
      'Cd(~\\code\\*)',
      'Read(\\\\server\\share\\x)',
      'Read(src\\)',
      'Read(src\\.env)',
      'Read(a\\_b)',
      'Read(a\\1)',
    ]) {
      expect(ids(list('allow', rule)), rule).toEqual(['backslash'])
    }
  })

  it('says the drive letter or the backslash, the rule, and the POSIX form', () => {
    const [drive] = lint(list('deny', 'Read(C:\\Users\\alice)'))
    expect(drive?.message).toContain('`Read(C:\\Users\\alice)`')
    expect(drive?.message).toContain('/c/Users/alice')
    expect(drive?.message).toContain('//c/')
    const [slash] = lint(list('deny', 'Read(src\\app)'))
    expect(slash?.message).toContain('`Read(src\\app)`')
    expect(slash?.message).toContain('backslash')
  })

  it('reports each entry once, at its line, column and end', () => {
    const [message, ...rest] = lint(
      JSON.stringify(list('allow', 'Read(C:\\Users)', 'Read(src/**)')),
    )
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 43,
    ])
  })

  it('reports a drive letter in the form of a parameter, for a deny or ask rule', () => {
    // `paramName` reads the `C` of `C:\x` as a parameter name. A one-letter name is a drive.
    expect(ids(list('deny', 'Read(C:\\x)'))).toEqual(['driveLetter'])
    expect(ids(list('ask', 'Edit(C:/x)'))).toEqual(['driveLetter'])
  })
})

describe(`${name}: the edges of the drive and backslash tests`, () => {
  it('reads a parameter name of two letters as a parameter, not a drive', () => {
    expect(ids(list('deny', 'Read(CC:\\x)'))).toEqual([])
  })

  it('reports a backslash before a capital letter', () => {
    expect(ids(list('allow', 'Read(src\\Components)'))).toEqual(['backslash'])
  })
})

describe(`${name}: the paths that it leaves alone`, () => {
  it('is silent for the POSIX forms of the docs', () => {
    for (const rule of [
      'Read(//c/Users/alice/**)',
      'Read(//c/**/.env)',
      'Read(//**/.env)',
      'Edit(/c/Users/alice)',
      'Edit(/src/**/*.ts)',
      'Read(~/Documents/*.pdf)',
      'Read(./.env)',
      'Read(*.env)',
      'Cd(~/code/*)',
      'Cd(//c/work/**)',
    ]) {
      expect(ids(list('allow', rule)), rule).toEqual([])
    }
  })

  it('is silent for a backslash that escapes a character of a gitignore pattern', () => {
    for (const rule of [
      'Read(./\\[2024-06\\] Reports/**)',
      'Read(a\\*b)',
      'Read(a\\?b)',
      'Read(\\!x)',
      'Read(\\#x)',
      'Read(a\\ b)',
      'Read(a\\\\b)',
      'Read(./Finance \\(2024\\)/**)',
    ]) {
      expect(ids(list('deny', rule)), rule).toEqual([])
    }
  })

  it('is silent for a colon that is not a drive letter', () => {
    expect(ids(list('allow', 'Read(a:b)', 'Read(C:)', 'Read(CC:/x)', 'Read(~/C:x)'))).toEqual([])
  })

  it('is silent for a parameter rule, which permissions-param-rule reads', () => {
    expect(ids(list('deny', 'Read(offset:5)', 'Edit(replace_all:true)'))).toEqual([])
  })

  it('is silent for a tool that the docs give no POSIX path', () => {
    // `Write(path)` is for permissions-path-rule-tool. The others take no path.
    expect(
      ids(list('allow', 'Write(C:\\x)', 'Glob(C:\\x)', 'Bash(dir C:\\x)', 'Grep(C:\\x)')),
    ).toEqual([])
  })

  it('is silent for a bare tool name and an empty specifier', () => {
    expect(ids(list('allow', 'Read', 'Edit', 'Cd', 'Read()'))).toEqual([])
  })

  it('is silent for a string that does not parse, which permissions-rule-syntax reads', () => {
    expect(ids(list('allow', 'Read(C:\\x', 'Read(C:\\x) y', '(C:\\x)'))).toEqual([])
  })

  it('is silent for an entry that is not a string, and for lists that are not arrays', () => {
    expect(ids({ permissions: { allow: [3, null, 'Read(C:\\x)'] } })).toEqual(['driveLetter'])
    expect(ids({ permissions: { allow: 'Read(C:\\x)', deny: { a: 1 } } })).toEqual([])
    expect(ids({ permissions: 'Read(C:\\x)' })).toEqual([])
    expect(ids({ allow: ['Read(C:\\x)'] })).toEqual([])
  })

  it('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(list('allow', 'Read(C:\\x)'), HIDDEN)).toEqual([])
  })
})
