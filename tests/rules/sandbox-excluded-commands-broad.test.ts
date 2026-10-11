// An `excludedCommands` entry that takes every command, or a shell or an interpreter with any
// arguments, out of the sandbox. An excluded command runs with full access, and the docs warn
// about a pattern that covers an interpreter:
// https://code.claude.com/docs/en/sandboxing#run-commands-outside-the-sandbox-with-excludedcommands
// The docs give `docker *`, `docker compose *`, `gh *`, `open *` and `git *` as entries, so the
// rule leaves them alone. `sandbox-excluded-commands-syntax` owns the `Bash(...)` wrapper and the
// words `sudo`, `eval`, `xargs`, `cd`, `pushd` and `popd`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-excluded-commands-broad'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const excluded = (...entries: unknown[]) =>
  JSON.stringify({ sandbox: { excludedCommands: entries } })
const ids = (code: string, file = PROJECT) =>
  lintJson(name, code, file).map((message) => message.messageId)

describe(`${name}: reports`, () => {
  it('reports the entry * in every kind of file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(excluded('*'), file), file).toEqual(['everything'])
    }
  })

  it('reports a star twice, and the legacy :* suffix on a star', () => {
    for (const entry of ['* *', '*:*']) {
      expect(ids(excluded(entry)), entry).toEqual(['everything'])
    }
  })

  it('is silent for a star with a word after it, which matches only some calls', () => {
    expect(ids(excluded('* --version'))).toEqual([])
  })

  it('reports a shell or an interpreter that takes any arguments', () => {
    for (const entry of [
      'bash *',
      'sh *',
      'dash *',
      'ksh *',
      'fish *',
      'deno *',
      'bun *',
      'php *',
      'zsh *',
      'python3 *',
      'python *',
      'node *',
      'ruby *',
      'perl *',
      'bash -c *',
      'node --inspect *',
      'sh:*',
      '  bash *  ',
    ]) {
      expect(ids(excluded(entry)), entry).toEqual(['interpreter'])
    }
  })

  it('names the entry without the white space around it', () => {
    const [message] = lintJson(name, excluded('  bash *  '), PROJECT)
    expect(message?.message).toContain('`bash *` takes')
  })

  it('reports each broad entry, at its line and column, and names it', () => {
    const text = '{\n  "sandbox": {\n    "excludedCommands": ["docker *", "bash *"]\n  }\n}'
    const messages = lintJson(name, text, PROJECT)
    expect(messages).toHaveLength(1)
    expect([messages[0]?.line, messages[0]?.column]).toEqual([3, 38])
    expect(messages[0]?.message).toContain('`bash *`')
    expect(messages[0]?.message).toContain('`bash`')
  })
})

describe(`${name}: silent`, () => {
  it('is silent for every entry that the docs give', () => {
    for (const entry of ['docker *', 'docker compose *', 'docker', 'gh *', 'open *', 'git *']) {
      expect(ids(excluded(entry)), entry).toEqual([])
    }
  })

  it('is silent for an exact entry, which matches that call only', () => {
    // A pattern with no wildcard is an exact match, so `bash` matches `bash` with no arguments.
    expect(ids(excluded('bash'))).toEqual([])
    expect(ids(excluded('python3 build.py'))).toEqual([])
  })

  it('is silent when the arguments are named before the wildcard', () => {
    expect(ids(excluded('python3 -m pytest *'))).toEqual([])
    expect(ids(excluded('node scripts/build.js *'))).toEqual([])
  })

  it('is silent for a name that only starts with an interpreter name, and for other tools', () => {
    for (const entry of ['bashful *', 'nodemon *', 'npm run *', 'make *', 'kubectl *']) {
      expect(ids(excluded(entry)), entry).toEqual([])
    }
  })

  it('leaves the entries of sandbox-excluded-commands-syntax to that rule', () => {
    for (const entry of ['Bash(bash *)', 'Bash(*)', 'sudo *', 'eval *', 'xargs *', 'cd *']) {
      expect(ids(excluded(entry)), entry).toEqual([])
    }
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(excluded(1, null, ['bash *']))).toEqual([])
    expect(ids(JSON.stringify({ sandbox: { excludedCommands: 'bash *' } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(excluded('*'), HIDDEN)).toEqual([])
  })
})
