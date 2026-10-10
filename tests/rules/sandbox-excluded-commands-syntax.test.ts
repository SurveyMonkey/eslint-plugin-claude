// An `excludedCommands` entry has the syntax of the content of a `Bash(...)` rule, with no
// `Bash(` wrapper. Claude Code keeps a call sandboxed when it starts with `sudo`, `eval` or
// `xargs`, or holds a `cd`, `pushd` or `popd`:
// https://code.claude.com/docs/en/settings-reference#sandbox-excludedcommands
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-excluded-commands-syntax'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const excluded = (...entries: unknown[]) => ({ sandbox: { excludedCommands: entries } })

describe(`${name}: an entry in the syntax of the docs`, () => {
  it('is silent for an exact command, a prefix and a wildcard, in every file', () => {
    const code = excluded('npm test', 'docker *', 'docker compose *', 'git:*', '*')
    for (const file of EVERY_FILE) {
      expect(ids(code, file), file).toEqual([])
    }
  })

  it('is silent for a word that only starts like a shell word', () => {
    expect(ids(excluded('sudoku', 'evaluate', 'xargs2 x', 'cdk deploy', 'popdir'))).toEqual([])
  })

  it('is silent for the bare word Bash, which is a command name here', () => {
    expect(ids(excluded('Bash'))).toEqual([])
  })

  it('is silent for an empty entry', () => {
    expect(ids(excluded('', '  '))).toEqual([])
  })
})

describe(`${name}: the Bash wrapper`, () => {
  it('reports an entry in the form of a permission rule, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(excluded('Bash(npm test)', 'Bash(docker *)'), file), file).toEqual([
        'wrapper',
        'wrapper',
      ])
    }
  })

  it('reports a wrapper with white space around it', () => {
    expect(ids(excluded('  Bash(npm test)  '))).toEqual(['wrapper'])
  })

  it('reports one fault for a wrapper around a shell word', () => {
    expect(ids(excluded('Bash(sudo x)'))).toEqual(['wrapper'])
  })

  it('is silent for a tool name other than Bash', () => {
    expect(ids(excluded('Read(./x)', 'Bash (x)'))).toEqual([])
  })

  it('shows the command that the wrapper holds, in the message', () => {
    const [message] = lint(excluded('Bash(npm test)'))
    expect(message?.message).toContain('`Bash(npm test)`')
    expect(message?.message).toContain('`npm test`')
  })
})

describe(`${name}: a command that never leaves the sandbox`, () => {
  it('reports each of the six words, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = excluded('sudo x', 'eval x', 'xargs rm', 'cd build', 'pushd x', 'popd')
      expect(ids(code, file), file).toEqual(Array(6).fill('neverExcluded'))
    }
  })

  it('reads the first word of a pattern in the `:*` form and with white space', () => {
    expect(ids(excluded('sudo:*', '  sudo   x', 'cd *'))).toEqual([
      'neverExcluded',
      'neverExcluded',
      'neverExcluded',
    ])
  })

  it('names the word in the message', () => {
    const [message] = lint(excluded('sudo x'))
    expect(message?.message).toContain('`sudo`')
    expect(message?.message).toContain('`sudo x`')
  })
})

describe(`${name}: where the rule reports`, () => {
  it('reports the entry, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "excludedCommands": [\n      "npm test",\n      "sudo x"\n    ]\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[5, 7, 5, 15]])
  })

  it('reports the entries of the last excludedCommands only', () => {
    const text = '{"sandbox": {"excludedCommands": ["sudo x"], "excludedCommands": ["npm"]}}'
    expect(ids(text)).toEqual([])
    const reversed = '{"sandbox": {"excludedCommands": ["npm"], "excludedCommands": ["sudo x"]}}'
    expect(ids(reversed)).toEqual(['neverExcluded'])
  })

  it('reads the last sandbox object', () => {
    const text = '{"sandbox": {"excludedCommands": ["sudo x"]}, "sandbox": {}}'
    expect(ids(text)).toEqual([])
  })

  it('is silent when sandbox, excludedCommands or an entry has another type', () => {
    expect(ids({ sandbox: 'x' })).toEqual([])
    expect(ids({ sandbox: [] })).toEqual([])
    expect(ids({ sandbox: {} })).toEqual([])
    expect(ids({ sandbox: { excludedCommands: 'sudo x' } })).toEqual([])
    expect(ids({ sandbox: { excludedCommands: null } })).toEqual([])
    expect(ids(excluded(1, null, { a: 'sudo x' }, ['sudo x']))).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
  })

  it('is silent for the same key in another place', () => {
    expect(ids({ permissions: { excludedCommands: ['sudo x'] } })).toEqual([])
    expect(ids({ excludedCommands: ['sudo x'] })).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(excluded('sudo x', 'Bash(x)'), HIDDEN)).toEqual([])
  })
})
