// A script that launches `claude` with a proxy variable set puts the variable in the shell only.
// A background agent does not run in that shell. The docs say to set the variables in the `env`
// block of settings:
// https://code.claude.com/docs/en/sandboxing#network-isolation
// https://code.claude.com/docs/en/network-config#set-network-variables-in-settings-not-the-shell
// The rule lints the shared project file, with the sandbox on. A script is a command of the
// `scripts` of a tracked `package.json` in the project folder. The repositories are real.
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { isolateGitConfig, plain, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-proxy-env'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const file = (fields: object) => JSON.stringify(fields)
const ON = { sandbox: { enabled: true } }
const scripts = (command: string) => ({ 'package.json': file({ scripts: { claude: command } }) })
const PROXY = scripts('HTTPS_PROXY=http://proxy.example.com:8080 claude')
const lint = (root: string, fields: object | string, name_ = PROJECT) =>
  lintJson(name, typeof fields === 'string' ? fields : file(fields), path.join(root, name_))
const ids = (root: string, fields: object | string, name_ = PROJECT) =>
  lint(root, fields, name_).map((message) => message.messageId)
const tracking = (files: Record<string, string> = {}) => repo({ [PROJECT]: '{}', ...files })

describe(`${name}: reports`, () => {
  it.fails('reports a proxy variable in a script that runs claude, with no env entry', () => {
    expect(ids(tracking(PROXY), ON)).toEqual(['env'])
  })

  it.fails('reports at the value of enabled, and names the variable and the docs advice', () => {
    const text = '{\n  "sandbox": {\n    "enabled": true\n  }\n}'
    const [message] = lint(tracking(PROXY), text)
    expect([message?.line, message?.column]).toEqual([3, 16])
    expect(message?.message).toContain('`HTTPS_PROXY`')
    expect(message?.message).toContain('"env"')
  })

  it.fails('reads the forms of an assignment', () => {
    for (const command of [
      'HTTPS_PROXY=http://p:1 claude',
      'export HTTPS_PROXY=http://p:1; claude',
      'cross-env HTTPS_PROXY=http://p:1 claude --resume',
      'npm ci && HTTP_PROXY=http://p:1 claude',
      'https_proxy=http://p:1 claude',
      'NO_PROXY=localhost claude',
      '(export HTTP_PROXY=http://p:1 && claude)',
    ]) {
      expect(ids(tracking(scripts(command)), ON), command).toEqual(['env'])
    }
  })

  it.fails('names each variable that the env block lacks, once', () => {
    const command = 'HTTPS_PROXY=a HTTP_PROXY=b NO_PROXY=c claude'
    const [message] = lint(tracking(scripts(command)), { ...ON, env: { HTTPS_PROXY: 'a' } })
    expect(message?.message).toContain('`HTTP_PROXY`')
    expect(message?.message).toContain('`NO_PROXY`')
    expect(message?.message).not.toContain('`HTTPS_PROXY`')
  })

  it.fails('reports at the file when the sandbox is on in the other project file only', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: file(ON), ...PROXY })
    expect(lint(root, '{}')[0]).toMatchObject({ messageId: 'env', line: 1, column: 1 })
  })
})

describe(`${name}: silent`, () => {
  it.fails('is silent when the env block of the source sets the variable, in any letter case', () => {
    expect(ids(tracking(PROXY), { ...ON, env: { HTTPS_PROXY: 'http://p:1' } })).toEqual([])
    expect(ids(tracking(PROXY), { ...ON, env: { https_proxy: 'http://p:1' } })).toEqual([])
    const root = repo({ [PROJECT]: '{}', [LOCAL]: file({ env: { HTTPS_PROXY: 'x' } }), ...PROXY })
    expect(ids(root, ON)).toEqual([])
  })

  it.fails('reports when the env block names other variables, or is not an object', () => {
    expect(ids(tracking(PROXY), { ...ON, env: { FOO: '1' } })).toEqual(['env'])
    expect(ids(tracking(PROXY), { ...ON, env: 'HTTPS_PROXY' })).toEqual(['env'])
  })

  it.fails('is silent for a script that does not run claude, or sets no proxy variable', () => {
    for (const command of [
      'HTTPS_PROXY=http://p:1 npm ci',
      'claude --resume',
      'echo HTTPS_PROXY=x',
      'claudette --x HTTPS_PROXY=x',
      'HTTPS_PROXY_FILE=x claude',
      'claude "$HTTPS_PROXY"',
    ]) {
      expect(ids(tracking(scripts(command)), ON), command).toEqual([])
    }
  })

  it.fails('is silent when the project has no tracked package.json, or it does not read', () => {
    expect(ids(tracking(), ON)).toEqual([])
    const untracked = repo({ [PROJECT]: '{}' }, [], PROXY)
    expect(ids(untracked, ON)).toEqual([])
    for (const text of [
      '{',
      '[1]',
      'null',
      file({ scripts: 'claude' }),
      file({ scripts: { a: 1 } }),
    ]) {
      expect(ids(tracking({ 'package.json': text }), ON), text).toEqual([])
    }
  })

  it.fails('is silent when the sandbox is off, unset or not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(ids(tracking(PROXY), { sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(ids(tracking(PROXY), {})).toEqual([])
    expect(ids(tracking(PROXY), '[1]')).toEqual([])
  })

  it.fails('is silent when the other project file turns the sandbox off or does not read', () => {
    const off = repo({ [PROJECT]: '{}', [LOCAL]: file({ sandbox: { enabled: false } }), ...PROXY })
    expect(ids(off, ON)).toEqual([])
    for (const text of ['[1]', '{']) {
      expect(ids(repo({ [PROJECT]: '{}', [LOCAL]: text, ...PROXY }), ON), text).toEqual([])
    }
  })

  it.fails('lints the shared file only, not the local or a managed file', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}', [MANAGED]: '{}', ...PROXY })
    expect(ids(root, ON, LOCAL)).toEqual([])
    expect(ids(root, ON, MANAGED)).toEqual([])
  })

  it.fails('is silent with no .git', () => {
    expect(ids(plain({ [PROJECT]: '{}', ...PROXY }), ON)).toEqual([])
  })
})
