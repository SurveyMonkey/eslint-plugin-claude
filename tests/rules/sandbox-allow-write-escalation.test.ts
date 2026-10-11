// An `allowWrite` entry for a shell startup file, a system configuration directory or a directory
// of executables lets a sandboxed command run code in another context:
// https://code.claude.com/docs/en/sandboxing#security-limitations
// The docs name "directories containing executables in `$PATH`, system configuration directories,
// or user shell configuration files such as `.bashrc` or `.zshrc`". The rule cannot read `$PATH`,
// so it uses a list of usual directories. The docs examples `~/.kube`, `/tmp/build` and `./build`
// stay silent.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-allow-write-escalation'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const write = (...entries: unknown[]) =>
  JSON.stringify({ sandbox: { filesystem: { allowWrite: entries } } })
const ids = (code: string, file = PROJECT) =>
  lintJson(name, code, file).map((message) => message.messageId)

describe(`${name}: reports`, () => {
  it.fails('reports a shell startup file, in every kind of file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(write('~/.zshrc'), file), file).toEqual(['startup'])
    }
  })

  it.fails('reports each usual startup file, by its home forms', () => {
    for (const entry of [
      '~/.bashrc',
      '~/.bash_profile',
      '~/.profile',
      '~/.zshenv',
      '~/.zprofile',
      '~/.config/fish/config.fish',
      '/Users/me/.zshrc',
      '/home/me/.bashrc',
      '/root/.bashrc',
      '//home/me/.bashrc',
    ]) {
      expect(ids(write(entry)), entry).toEqual(['startup'])
    }
  })

  it.fails('reports a system configuration directory and a path below it', () => {
    for (const entry of ['/etc', '/etc/', '/etc/**', '/etc/profile.d', '/etc/zshrc']) {
      expect(ids(write(entry)), entry).toEqual(['system'])
    }
  })

  it.fails('reports a directory of executables and a path below it', () => {
    for (const entry of [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/opt/homebrew/bin',
      '~/bin',
      '~/.local/bin',
      '~/.local/bin/',
      '~/.local/bin/tool',
    ]) {
      expect(ids(write(entry)), entry).toEqual(['executables'])
    }
  })

  it.fails('reports a directory that holds a startup file or an executables directory', () => {
    for (const entry of ['~', '~/', '/', '/usr', '/usr/local', '/Users/me', '/home/me']) {
      expect(ids(write(entry)), entry).toEqual(['broad'])
    }
  })

  it.fails('reports each entry, at its line and column, and names the entry', () => {
    const text =
      '{\n  "sandbox": {\n    "filesystem": {\n      "allowWrite": ["./build", "~/.zshrc"]\n    }\n  }\n}'
    const messages = lintJson(name, text, PROJECT)
    expect(messages).toHaveLength(1)
    expect([messages[0]?.line, messages[0]?.column]).toEqual([4, 33])
    expect(messages[0]?.message).toContain('`~/.zshrc`')
    expect(messages[0]?.message).toContain('startup')
  })
})

describe(`${name}: silent`, () => {
  it.fails('is silent for every entry that the docs give', () => {
    for (const entry of ['~/.kube', '/tmp/build', './build']) {
      expect(ids(write(entry)), entry).toEqual([])
    }
    expect(ids(write('/tmp/build', '~/.kube'))).toEqual([])
  })

  it.fails('is silent for a project path, a temp path and a similar name', () => {
    for (const entry of [
      'build',
      './.zshrc',
      '~/projects',
      '~/.zshrc.d',
      '~/zshrc',
      '/etcetera',
      '/usr/local/share',
      '/usr/binary',
      '~/.local/binx',
      '/var/tmp',
    ]) {
      expect(ids(write(entry)), entry).toEqual([])
    }
  })

  it.fails('does not read denyWrite, allowRead or Edit rules', () => {
    const code = JSON.stringify({
      sandbox: { filesystem: { denyWrite: ['~/.zshrc'], allowRead: ['/etc'], denyRead: ['~'] } },
      permissions: { allow: ['Edit(~/.zshrc)'] },
    })
    expect(ids(code)).toEqual([])
  })

  it.fails('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(write(1, null))).toEqual([])
    expect(ids(JSON.stringify({ sandbox: { filesystem: { allowWrite: '~/.zshrc' } } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(ids(write('/etc'), HIDDEN)).toEqual([])
  })
})
