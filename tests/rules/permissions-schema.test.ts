// The keys of `permissions` and their types, from the entries of the settings reference:
// https://code.claude.com/docs/en/settings-reference#permissions
// A managed settings file withholds `allow` and `additionalDirectories` while it has a `deny` or
// `ask` list that Claude Code cannot read:
// https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-schema'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const LISTS = ['allow', 'ask', 'deny', 'additionalDirectories']
const NOT_LISTS = ['Bash', 1, true, {}]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const permissions = (fields: object) => ({ permissions: fields })

describe(`${name}: a valid object`, () => {
  it('is silent for each key of permissions with a value of its type, in every file', () => {
    const code = permissions({
      allow: ['Bash(npm test)'],
      ask: ['Bash(git push *)'],
      deny: ['Read(./.env)'],
      additionalDirectories: ['../docs'],
      blockReadsOutsideWorkingDirectories: true,
      defaultMode: 'acceptEdits',
      disableBypassPermissionsMode: 'disable',
      disableAutoMode: 'disable',
    })
    for (const file of EVERY_FILE) {
      expect(ids(code, file), file).toEqual([])
    }
  })

  it('is silent for empty lists and a false Boolean', () => {
    const code = permissions({
      allow: [],
      ask: [],
      deny: [],
      additionalDirectories: [],
      blockReadsOutsideWorkingDirectories: false,
    })
    expect(ids(code)).toEqual([])
  })

  it('is silent for the keys that other rules check, whatever their value', () => {
    const code = permissions({
      defaultMode: 'nope',
      disableBypassPermissionsMode: true,
      disableAutoMode: 3,
    })
    expect(ids(code)).toEqual([])
  })

  it('is silent for an entry with a NUL byte: permissions-rule-syntax reports it', () => {
    expect(ids(permissions({ allow: ['Bash\u0000'] }))).toEqual([])
  })

  it('is silent for a key that is null', () => {
    for (const key of [...LISTS, 'blockReadsOutsideWorkingDirectories']) {
      expect(ids(permissions({ [key]: null })), key).toEqual([])
    }
  })
})

describe(`${name}: a key that is not in the list`, () => {
  it('reports each such key, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = permissions({ allow: [], Allow: [], sandbox: {}, 'deny ': [] })
      expect(ids(code, file), file).toEqual(['unknownKey', 'unknownKey', 'unknownKey'])
    }
  })

  it('names the key in the message', () => {
    const [message] = lint(permissions({ allowed: [] }))
    expect(message?.message).toContain('"allowed"')
  })

  it('reports the name of the key, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allowed": []\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[3, 5, 3, 14]])
  })

  it('reports a key whose value is null', () => {
    expect(ids(permissions({ allowed: null }))).toEqual(['unknownKey'])
  })

  it('reports the last of two keys of one name only', () => {
    expect(ids('{"permissions": {"allowed": [], "allowed": []}}')).toEqual(['unknownKey'])
  })
})

describe(`${name}: a list that is not an array`, () => {
  it('reports each list, in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      for (const key of LISTS) {
        for (const value of NOT_LISTS) {
          expect(ids(permissions({ [key]: value }), file), `${file} ${key}`).toEqual(['notArray'])
        }
      }
    }
  })

  it('reports allow and additionalDirectories in a managed file the same way', () => {
    for (const file of MANAGED_FILES) {
      for (const key of ['allow', 'additionalDirectories']) {
        expect(ids(permissions({ [key]: 'Bash' }), file), `${file} ${key}`).toEqual(['notArray'])
      }
    }
  })

  it('reports deny and ask in a managed file with the message for withheld grants', () => {
    for (const file of MANAGED_FILES) {
      for (const key of ['deny', 'ask']) {
        expect(ids(permissions({ [key]: 'Bash' }), file), `${file} ${key}`).toEqual([
          'listWithheld',
        ])
      }
    }
  })

  it('names the list in the message, and says what Claude Code withholds', () => {
    const [plain] = lint(permissions({ deny: 'Bash' }))
    expect(plain?.message).toContain('"deny"')
    const [withheld] = lint(permissions({ deny: 'Bash' }), MANAGED)
    expect(withheld?.message).toContain('"deny"')
    expect(withheld?.message).toContain('withholds "allow" and "additionalDirectories"')
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": "Bash"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 14]])
  })
})

describe(`${name}: an entry that is not a string`, () => {
  it('reports each such entry, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const key of LISTS) {
        const code = permissions({ [key]: ['Bash', 3, null, { a: 1 }, ['x']] })
        expect(ids(code, file), `${file} ${key}`).toEqual([
          'notString',
          'notString',
          'notString',
          'notString',
        ])
      }
    }
  })

  it('reports the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "deny": [\n      "Bash",\n      7\n    ]\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[5, 7]])
  })

  it('names the list in the message', () => {
    const [message] = lint(permissions({ additionalDirectories: [1] }))
    expect(message?.message).toContain('"additionalDirectories"')
  })
})

describe(`${name}: blockReadsOutsideWorkingDirectories`, () => {
  it('reports a value that is not a Boolean, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const value of ['true', 1, [], {}]) {
        const code = permissions({ blockReadsOutsideWorkingDirectories: value })
        expect(ids(code, file), `${file} ${JSON.stringify(value)}`).toEqual(['notBoolean'])
      }
    }
  })

  it('is silent for true and false', () => {
    expect(ids(permissions({ blockReadsOutsideWorkingDirectories: true }))).toEqual([])
    expect(ids(permissions({ blockReadsOutsideWorkingDirectories: false }))).toEqual([])
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it('is silent when permissions is not an object', () => {
    expect(ids({ permissions: 'x' })).toEqual([])
    expect(ids({ permissions: [] })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
    expect(ids({})).toEqual([])
  })

  it('is silent for a key outside permissions', () => {
    expect(ids({ allowed: [], allow: 'Bash' })).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })

  it('reads the last permissions object', () => {
    expect(ids('{"permissions": {"allow": "x"}, "permissions": {}}')).toEqual([])
    expect(ids('{"permissions": {}, "permissions": {"allow": "x"}}')).toEqual(['notArray'])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"permissions": {"allow": "x", "allow": []}}')).toEqual([])
    expect(ids('{"permissions": {"allow": [], "allow": "x"}}')).toEqual(['notArray'])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(permissions({ allowed: [], allow: 'x' }), HIDDEN)).toEqual([])
  })
})
