// The keys of `autoMode` and their types, from the entry of the settings reference:
// https://code.claude.com/docs/en/settings-reference#automode
// https://code.claude.com/docs/en/settings-reference#automode-classifyallshell
// A managed file withholds `allow` and `environment` while `soft_deny` or `hard_deny` cannot be
// read, or lost an invalid entry:
// https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed
// The docs state no limit on how often `"$defaults"` can stand in one array.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-schema'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const ALL_FILES = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const LISTS = ['environment', 'allow', 'soft_deny', 'hard_deny']
const DENY_LISTS = ['soft_deny', 'hard_deny']
const NOT_LISTS = ['Bash', 1, true, {}]

const lint = (code: unknown, file = MANAGED) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = MANAGED) => lint(code, file).map((message) => message.messageId)
const autoMode = (fields: object) => ({ autoMode: fields })

describe(`${name}: a valid object`, () => {
  it('is silent for each key with a value of its type, in every file', () => {
    const code = autoMode({
      environment: ['$defaults', 'Trusted repo: github.com/acme'],
      allow: ['$defaults', 'Allow reading the build log'],
      soft_deny: ['Never run terraform apply', '$defaults'],
      hard_deny: ['$defaults'],
      classifyAllShell: true,
    })
    for (const file of ALL_FILES) {
      expect(ids(code, file), file).toEqual([])
    }
  })

  it('is silent for an empty object, empty lists and a false Boolean', () => {
    expect(ids(autoMode({}))).toEqual([])
    expect(ids(autoMode({ environment: [], allow: [], soft_deny: [], hard_deny: [] }))).toEqual([])
    expect(ids(autoMode({ classifyAllShell: false }))).toEqual([])
  })

  it('is silent for "$defaults" more than once: the docs state no limit', () => {
    expect(ids(autoMode({ soft_deny: ['$defaults', 'x', '$defaults'] }))).toEqual([])
  })

  it('is silent for a key that is null', () => {
    expect(ids({ autoMode: null })).toEqual([])
    for (const key of [...LISTS, 'classifyAllShell']) {
      expect(ids(autoMode({ [key]: null })), key).toEqual([])
    }
  })
})

describe(`${name}: a key that is not in the list`, () => {
  it('reports each such key, in every file', () => {
    for (const file of MANAGED_FILES) {
      const code = autoMode({ allow: [], softDeny: [], Allow: [], 'hard_deny ': [] })
      expect(ids(code, file), file).toEqual(['unknownKey', 'unknownKey', 'unknownKey'])
    }
  })

  it('names the key in the message', () => {
    const [message] = lint(autoMode({ soft_block: [] }))
    expect(message?.message).toContain('"soft_block"')
  })

  it('reports the name of the key, at its line and column', () => {
    const text = '{\n  "autoMode": {\n    "soft_block": []\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[3, 5, 3, 17]])
  })

  it('reports a key whose value is null, and the last of two keys of one name only', () => {
    expect(ids(autoMode({ soft_block: null }))).toEqual(['unknownKey'])
    expect(ids('{"autoMode": {"soft_block": [], "soft_block": []}}')).toEqual(['unknownKey'])
  })
})

describe(`${name}: autoMode itself`, () => {
  it('reports a value that is not an object, in every file', () => {
    for (const file of MANAGED_FILES) {
      for (const value of ['x', 1, true, []]) {
        expect(ids({ autoMode: value }, file), `${file} ${JSON.stringify(value)}`).toEqual([
          'notObject',
        ])
      }
    }
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "autoMode": "x"\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[2, 15]])
  })

  it('reads the last autoMode', () => {
    expect(ids('{"autoMode": "x", "autoMode": {}}')).toEqual([])
    expect(ids('{"autoMode": {}, "autoMode": "x"}')).toEqual(['notObject'])
  })

  it('is silent for a document that is not an object, or with no autoMode', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids({})).toEqual([])
    expect(ids({ permissions: { autoMode: 'x' } })).toEqual([])
  })
})

describe(`${name}: a list that is not an array`, () => {
  it('is silent in a project or local file, where settings-key-scope reports autoMode', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(autoMode({ allow: 'x', soft_block: [], classifyAllShell: 1 }), file)).toEqual([])
      expect(ids({ autoMode: 'x' }, file)).toEqual([])
    }
  })

  it('reports each value that is not an array, in a managed file', () => {
    for (const value of NOT_LISTS) {
      expect(ids(autoMode({ environment: value, allow: value })), JSON.stringify(value)).toEqual([
        'notArray',
        'notArray',
      ])
    }
  })

  it('reports environment and allow in a managed file the same way', () => {
    for (const file of MANAGED_FILES) {
      for (const key of ['environment', 'allow']) {
        expect(ids(autoMode({ [key]: 'x' }), file), `${file} ${key}`).toEqual(['notArray'])
      }
    }
  })

  it('reports soft_deny and hard_deny in a managed file with the message for withheld lists', () => {
    for (const file of MANAGED_FILES) {
      for (const key of DENY_LISTS) {
        expect(ids(autoMode({ [key]: 'x' }), file), `${file} ${key}`).toEqual(['listWithheld'])
      }
    }
  })

  it('names the list, and says what Claude Code withholds', () => {
    const [plain] = lint(autoMode({ allow: 'x' }))
    expect(plain?.message).toContain('"allow"')
    expect(plain?.message).not.toContain('withholds')
    const [withheld] = lint(autoMode({ hard_deny: 'x' }), MANAGED)
    expect(withheld?.message).toContain('"hard_deny"')
    expect(withheld?.message).toContain('withholds "allow" and "environment"')
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "autoMode": {\n    "allow": "x"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 14]])
  })
})

describe(`${name}: an entry that is not a string`, () => {
  it('reports each such entry, for environment and allow', () => {
    for (const file of MANAGED_FILES) {
      for (const key of ['environment', 'allow']) {
        const code = autoMode({ [key]: ['x', 3, null, { a: 1 }, ['x']] })
        expect(ids(code, file), `${file} ${key}`).toEqual([
          'notString',
          'notString',
          'notString',
          'notString',
        ])
      }
    }
  })

  it('says what Claude Code withholds for an entry of soft_deny or hard_deny in a managed file', () => {
    for (const file of MANAGED_FILES) {
      for (const key of DENY_LISTS) {
        const messages = lint(autoMode({ [key]: ['x', 3] }), file)
        expect(
          messages.map((message) => message.messageId),
          `${file} ${key}`,
        ).toEqual(['entryWithheld'])
        expect(messages[0]?.message).toContain('withholds "allow" and "environment"')
      }
    }
  })

  it('reports the entry, at its line and column', () => {
    const text = '{\n  "autoMode": {\n    "allow": [\n      "x",\n      7\n    ]\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[5, 7]])
  })
})

describe(`${name}: classifyAllShell`, () => {
  it('reports a value that is not a Boolean, in a managed file', () => {
    for (const file of MANAGED_FILES) {
      for (const value of ['yes', 'TRUE', 1, [], {}]) {
        expect(
          ids(autoMode({ classifyAllShell: value }), file),
          `${file} ${JSON.stringify(value)}`,
        ).toEqual(['notBoolean'])
      }
    }
  })

  it('reads a quoted Boolean as that Boolean in a managed file', () => {
    for (const value of ['true', 'false']) {
      expect(ids(autoMode({ classifyAllShell: value }))).toEqual([])
    }
  })

  it('is silent for true and false', () => {
    expect(ids(autoMode({ classifyAllShell: true }))).toEqual([])
    expect(ids(autoMode({ classifyAllShell: false }))).toEqual([])
  })
})

describe(`${name}: a hidden drop-in`, () => {
  it('is silent, because Claude Code ignores it', () => {
    expect(ids(autoMode({ soft_block: [], allow: 'x', classifyAllShell: 1 }), HIDDEN)).toEqual([])
    expect(ids({ autoMode: 'x' }, HIDDEN)).toEqual([])
  })
})
