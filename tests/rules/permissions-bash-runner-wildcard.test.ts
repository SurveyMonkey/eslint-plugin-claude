// An allow rule that ends in `*` after an environment runner matches whatever comes after the
// runner, so `Bash(devbox run *)` approves `devbox run rm -rf .`:
// https://code.claude.com/docs/en/permissions#process-wrappers
// The runners are `direnv exec`, `devbox run`, `mise exec`, `npx` and `docker exec`. The option
// `runners` replaces that list.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'permissions-bash-runner-wildcard'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

// The shared helper `lintJson` takes no options, so this file lints with its own Linter.
const lint = (code: unknown, file = PROJECT, runners?: unknown) =>
  new Linter({ cwd: path.parse(file).root }).verify(
    typeof code === 'string' ? code : JSON.stringify(code),
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: {
          [`claude/${name}`]:
            runners === undefined ? 'error' : ['error', { runners } as Record<string, unknown>],
        },
      },
    ],
    { filename: file },
  )
const ids = (code: unknown, file = PROJECT, runners?: unknown) =>
  lint(code, file, runners).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

describe(`${name}: the default runners`, () => {
  it.fails('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(allow('Bash(devbox run *)'), file), file).toEqual(['runner'])
    }
  })

  it.fails('reports each runner of the docs', () => {
    for (const rule of [
      'Bash(direnv exec *)',
      'Bash(devbox run *)',
      'Bash(mise exec *)',
      'Bash(npx *)',
      'Bash(docker exec *)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual(['runner'])
    }
  })

  it.fails('reads the :* suffix as a trailing *', () => {
    expect(ids(allow('Bash(npx:*)', 'Bash(devbox run:*)'))).toEqual(['runner', 'runner'])
  })

  it.fails('reports a Monitor rule, which uses the rules of Bash', () => {
    expect(ids(allow('Monitor(npx *)'))).toEqual(['runner'])
  })

  it.fails('reports each entry once', () => {
    expect(ids(allow('Bash(npx *)', 'Bash(npx prettier *)', 'Bash(mise exec *)'))).toEqual([
      'runner',
      'runner',
    ])
  })

  it.fails('names the rule and the runner, and says to write a rule for each inner command', () => {
    const [message] = lint(allow('Bash(devbox run *)'))
    expect(message?.message).toContain('`Bash(devbox run *)`')
    expect(message?.message).toContain('`devbox run`')
    expect(message?.message).toContain('each inner command')
  })

  it.fails('reports the entry, at its line, column and end', () => {
    const [message] = lint(JSON.stringify(allow('Bash(npx *)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 39,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent for a rule that names the inner command', () => {
    for (const rule of [
      'Bash(devbox run npm test)',
      'Bash(devbox run npm *)',
      'Bash(npx prettier --check *)',
      'Bash(mise exec -- node *)',
      'Bash(docker exec c *)',
      'Bash(direnv exec . make *)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it.fails('is silent for the runner alone, and for a runner that is not a whole word', () => {
    for (const rule of [
      'Bash(npx)',
      'Bash(devbox run)',
      'Bash(npx*)',
      'Bash(npxy *)',
      'Bash(devbox *)',
      'Bash(docker *)',
      'Bash(direnv *)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it.fails('is silent for a wrapper that Claude Code strips, which is not a runner', () => {
    for (const rule of ['Bash(timeout 30 *)', 'Bash(nice *)', 'Bash(nohup *)', 'Bash(time *)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it.fails('is silent for a * in the middle, and for a runner after another word', () => {
    expect(ids(allow('Bash(npx * --yes)', 'Bash(sudo npx *)', 'Bash(* npx *)'))).toEqual([])
  })

  it.fails('is silent for a tool with another pattern syntax', () => {
    expect(ids(allow('PowerShell(npx *)', 'Read(npx *)', 'Skill(npx *)'))).toEqual([])
  })

  it.fails('is silent in deny and ask, which hold no grant', () => {
    expect(ids({ permissions: { deny: ['Bash(npx *)'], ask: ['Bash(npx *)'] } })).toEqual([])
  })

  it.fails('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids(allow('Bash(npx *'))).toEqual([])
  })

  it.fails('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { allow: [3, null] } })).toEqual([])
    expect(ids({ permissions: { allow: 'Bash(npx *)' } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(allow('Bash(npx *)'), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the option runners`, () => {
  it.fails('replaces the list, so a configured runner is reported and a default one is not', () => {
    expect(ids(allow('Bash(task run *)'), PROJECT, ['task run'])).toEqual(['runner'])
    expect(ids(allow('Bash(npx *)'), PROJECT, ['task run'])).toEqual([])
  })

  it.fails('reads a runner of one word, and many words, and ignores extra white space', () => {
    expect(
      ids(allow('Bash(poetry run *)', 'Bash(uvx *)'), PROJECT, [' poetry   run ', 'uvx']),
    ).toEqual(['runner', 'runner'])
  })

  it.fails('reports nothing for an empty list', () => {
    expect(ids(allow('Bash(npx *)', 'Bash(devbox run *)'), PROJECT, [])).toEqual([])
  })

  it.fails('refuses an option that is no list of strings', () => {
    for (const bad of [[''], [3], 'npx', ['npx', 'npx']]) {
      expect(() => lint(allow('Bash(npx *)'), PROJECT, bad), JSON.stringify(bad)).toThrow(
        /Value .* should/s,
      )
    }
  })
})
