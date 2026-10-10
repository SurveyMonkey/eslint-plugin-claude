// The permissions page, "Read and Edit": a deny or ask pattern that starts with `!` is a gitignore
// negation. It carves paths out of the `path` or `./path` rules listed before it, in the same
// source. A `!` rule listed first carves nothing out. A `!` pattern is read relative to the
// current directory, even when `/`, `~/` or `//` follows the `!`. A carve-out cannot reopen a file
// inside a directory that a rule blocks as a whole:
// https://code.claude.com/docs/en/permissions#read-and-edit
// The docs name the form for deny and ask rules only, so the rule reads no allow rule.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-negation'
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

describe(`${name}: the example of the docs`, () => {
  it.fails('is silent for a carve-out after the rule it carves, in every file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('deny', 'Read(*.env)', 'Read(!sample.env)'), file), file).toEqual([])
    }
  })

  it.fails('is silent in deny and ask, for Read and Edit, and with the ./ form', () => {
    for (const key of ['deny', 'ask'] as const) {
      for (const tool of ['Read', 'Edit']) {
        expect(ids(list(key, `${tool}(./config/**)`, `${tool}(!config/public/x)`)), key).toEqual([])
      }
    }
  })

  it.fails('is silent when a rule between the two is not a carve-out', () => {
    expect(ids(list('deny', 'Read(*.env)', 'Read(secrets/**)', 'Read(!sample.env)'))).toEqual([])
  })
})

describe(`${name}: a carve-out that carves nothing`, () => {
  it.fails('reports a ! rule listed first, in every file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('deny', 'Read(!sample.env)', 'Read(*.env)'), file), file).toEqual([
        'carvesNothing',
      ])
    }
  })

  it.fails('reports a ! rule that stands alone, in deny and in ask, for Read and Edit', () => {
    for (const key of ['deny', 'ask'] as const) {
      for (const tool of ['Read', 'Edit']) {
        expect(ids(list(key, `${tool}(!sample.env)`)), `${key} ${tool}`).toEqual(['carvesNothing'])
      }
    }
  })

  it.fails('reports each ! rule that has no rule of the right form before it', () => {
    expect(ids(list('deny', 'Read(!a)', 'Read(!b)'))).toEqual(['carvesNothing', 'carvesNothing'])
  })

  it.fails('reports when each earlier rule starts with /, ~/ or //, which a ! cannot reach', () => {
    expect(
      ids(list('deny', 'Read(/src/**)', 'Read(~/notes/**)', 'Read(//etc/**)', 'Read(!src/a)')),
    ).toEqual(['carvesNothing'])
  })

  it.fails('reports when the earlier rule is in another list or is a parameter rule', () => {
    expect(
      ids({ permissions: { ask: ['Read(*.env)'], deny: ['Read(offset:5)', 'Read(!sample.env)'] } }),
    ).toEqual(['carvesNothing'])
  })

  it.fails('says which rule carves nothing and what a carve-out needs', () => {
    const [message] = lint(list('deny', 'Read(!sample.env)'))
    expect(message?.message).toContain('`Read(!sample.env)`')
    expect(message?.message).toContain('before it')
  })
})

describe(`${name}: a bare !`, () => {
  it.fails('reports a bare ! in a deny or ask rule, for Read and Edit', () => {
    for (const key of ['deny', 'ask'] as const) {
      for (const tool of ['Read', 'Edit']) {
        expect(ids(list(key, `${tool}(*.env)`, `${tool}(!)`)), `${key} ${tool}`).toEqual(['bare'])
      }
    }
  })

  it.fails('says that Claude Code ignores it', () => {
    const [message] = lint(list('deny', 'Read(*.env)', 'Read(!)'))
    expect(message?.message).toContain('`Read(!)`')
    expect(message?.message).toContain('ignores')
  })
})

describe(`${name}: a ! before an anchor`, () => {
  it.fails('reports ! before /, ~/ and //, which Claude Code reads from the current directory', () => {
    for (const rule of ['Read(!/src/a)', 'Read(!~/notes/public/**)', 'Read(!//etc/a)']) {
      expect(ids(list('deny', 'Read(~/notes/**)', rule)), rule).toEqual(['anchored'])
    }
  })

  it.fails('reports it once when no earlier rule exists, as an anchored ! rule', () => {
    expect(ids(list('deny', 'Read(!~/notes/public/**)'))).toEqual(['anchored'])
  })

  it.fails('says that the anchor does not reach a rule', () => {
    const [message] = lint(list('deny', 'Read(~/notes/**)', 'Read(!~/notes/public/**)'))
    expect(message?.message).toContain('`Read(!~/notes/public/**)`')
    expect(message?.message).toContain('relative to the current directory')
  })

  it.fails('is silent for a ! before a relative path with a tilde or dot in it', () => {
    expect(ids(list('deny', 'Read(*.env)', 'Read(!~notes)', 'Read(!./a)', 'Read(!.env)'))).toEqual(
      [],
    )
  })
})

describe(`${name}: a directory that a rule blocks whole`, () => {
  it.fails('reports a carve-out inside a directory that an earlier rule blocks with /**', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(list('deny', 'Read(secrets/**)', 'Read(!secrets/public/**)'), file), file).toEqual(
        ['reopen'],
      )
    }
  })

  it.fails('reports it in ask, for Edit, and with the ./ form on either side', () => {
    expect(ids(list('ask', 'Edit(./secrets/**)', 'Edit(!secrets/public)'))).toEqual(['reopen'])
    expect(ids(list('deny', 'Read(secrets/**)', 'Read(!./secrets/a.md)'))).toEqual(['reopen'])
    expect(ids(list('deny', 'Read(a/b/**)', 'Read(!a/b/c/d)'))).toEqual(['reopen'])
  })

  it.fails('reports it when another rule comes first, and when the carve-out has a wildcard', () => {
    expect(ids(list('deny', 'Read(*.env)', 'Read(secrets/**)', 'Read(!secrets/*.md)'))).toEqual([
      'reopen',
    ])
  })

  it.fails('says which rule cannot reopen a path', () => {
    const [message] = lint(list('deny', 'Read(secrets/**)', 'Read(!secrets/public/**)'))
    expect(message?.message).toContain('`Read(!secrets/public/**)`')
    expect(message?.message).toContain('blocks whole')
  })

  it.fails('is silent for a path outside the directory, and for the directory itself', () => {
    for (const rule of ['Read(!other/x)', 'Read(!secrets)', 'Read(!secrets2/x)', 'Read(!*.md)']) {
      expect(ids(list('deny', 'Read(secrets/**)', rule)), rule).toEqual([])
    }
  })

  it.fails('is silent when the earlier rule is not a whole directory', () => {
    for (const earlier of ['Read(secrets/*.md)', 'Read(**/secrets/**)', 'Read(secrets)']) {
      expect(ids(list('deny', earlier, 'Read(!secrets/public)')), earlier).toEqual([])
    }
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent in allow, which the docs do not describe for a ! pattern', () => {
    expect(ids(list('allow', 'Read(!sample.env)', 'Read(!)', 'Read(!/x)'))).toEqual([])
  })

  it.fails('is silent for a Read carve-out after an Edit rule: the docs name no tool pair', () => {
    expect(ids(list('deny', 'Edit(*.env)', 'Read(!sample.env)'))).toEqual([])
  })

  it.fails('is silent for the tools that take no gitignore pattern', () => {
    expect(
      ids(list('deny', 'Write(!a)', 'Cd(!a)', 'Glob(!a)', 'Bash(!ls)', 'Grep(!a)', 'Read', 'Edit')),
    ).toEqual([])
  })

  it.fails('is silent for a parameter rule, a bare name and an empty specifier', () => {
    expect(ids(list('deny', 'Read(offset:!5)', 'Read', 'Read()'))).toEqual([])
  })

  it.fails('is silent for a string that does not parse, which permissions-rule-syntax reads', () => {
    expect(ids(list('deny', 'Read(!a', 'Read(!a) b', '(!a)'))).toEqual([])
  })

  it.fails('is silent for an entry that is not a string, and for lists that are not arrays', () => {
    expect(ids({ permissions: { deny: [3, null, 'Read(!a)'] } })).toEqual(['carvesNothing'])
    expect(ids({ permissions: { deny: 'Read(!a)', ask: { a: 1 } } })).toEqual([])
    expect(ids({ permissions: 'Read(!a)' })).toEqual([])
    expect(ids({ deny: ['Read(!a)'] })).toEqual([])
  })

  it.fails('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(list('deny', 'Read(!a)'), HIDDEN)).toEqual([])
  })

  it.fails('reports the entry, at its line, column and end', () => {
    const [message, ...rest] = lint(JSON.stringify(list('deny', 'Read(!a)')))
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 25, 1, 35,
    ])
  })
})
