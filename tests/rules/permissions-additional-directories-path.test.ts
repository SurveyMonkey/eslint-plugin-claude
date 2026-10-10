// The errors page, "Working directory is a network path": Claude Code refuses a UNC share such as
// `\\server\share` and an automount path such as `/net/<host>` as a working directory. A mapped
// drive letter and a `\\wsl$` path are not network paths:
// https://code.claude.com/docs/en/errors#working-directory-is-a-network-path
// The permissions page lists `additionalDirectories` as a way to add a working directory:
// https://code.claude.com/docs/en/permissions#working-directories
// The rule reads the text of the entry. It reads no directory out of the repository (ADR 001,
// Decision 14).
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-additional-directories-path'
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
const dirs = (...entries: unknown[]) => ({ permissions: { additionalDirectories: entries } })

describe(`${name}: a network path`, () => {
  it.fails('reports a UNC share in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(dirs('\\\\server\\share'), file), file).toEqual(['networkPath'])
    }
  })

  it.fails('reports a UNC share with a path below it, and a short host', () => {
    expect(ids(dirs('\\\\server\\share\\sub\\dir', '\\\\h\\s', '\\\\10.0.0.1\\data'))).toEqual([
      'networkPath',
      'networkPath',
      'networkPath',
    ])
  })

  it.fails('reports an automount path, with or without a path below the host', () => {
    expect(ids(dirs('/net/fileserver', '/net/fileserver/', '/net/fileserver/home/me'))).toEqual([
      'networkPath',
      'networkPath',
      'networkPath',
    ])
  })

  it.fails('says that Claude Code does not add the path, and names it', () => {
    const [unc] = lint(dirs('\\\\server\\share'))
    expect(unc?.message).toContain('`\\\\server\\share`')
    expect(unc?.message).toContain('network path')
    expect(unc?.message).toContain('working directory')
    const [net] = lint(dirs('/net/fileserver/home'))
    expect(net?.message).toContain('`/net/fileserver/home`')
  })

  it.fails('is silent for a mapped drive letter, a WSL path and a Windows device path', () => {
    for (const entry of [
      'Z:\\share',
      'C:\\work',
      '\\\\wsl$\\Ubuntu\\home\\me',
      '\\\\WSL$\\Ubuntu',
      '\\\\wsl.localhost\\Ubuntu',
      '\\\\?\\C:\\work',
      '\\\\.\\pipe\\x',
    ]) {
      expect(ids(dirs(entry)), entry).toEqual([])
    }
  })

  it.fails('is silent for a local path, and for a path that only looks like an automount', () => {
    for (const entry of [
      '../docs/',
      '/home/me/docs',
      '~/docs',
      './net/host',
      'net/host',
      '/net',
      '/net/',
      '/network/host',
      '/usr/net/host',
      '/netx/host',
      '\\server\\share',
      '//server/share',
      '',
    ]) {
      expect(ids(dirs(entry)), entry).toEqual([])
    }
  })
})

describe(`${name}: a NUL byte`, () => {
  it.fails('reports an entry with a NUL byte, in every file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(dirs('/work\0dir'), file), file).toEqual(['nulByte'])
    }
  })

  it.fails('says that Claude Code skips the entry', () => {
    const [message] = lint(dirs('a\0b'))
    expect(message?.message).toContain('NUL byte')
    expect(message?.message).toContain('skips')
  })

  it.fails('makes one report for an entry that also has a network path', () => {
    expect(ids(dirs('\\\\server\\share\0'))).toEqual(['nulByte'])
  })
})

describe(`${name}: the entries and files that it leaves alone`, () => {
  it.fails('reports each entry once, at its line, column and end', () => {
    const [message, ...rest] = lint(JSON.stringify(dirs('/ok', '/net/h', '/ok2')))
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 48, 1, 56,
    ])
  })

  it.fails('is silent for an entry that is not a string, which permissions-schema reads', () => {
    expect(ids(dirs(3, null, { a: '/net/h' }, ['/net/h'], '/net/h'))).toEqual(['networkPath'])
  })

  it.fails('is silent for a value that is not an array, and for a missing key', () => {
    expect(ids({ permissions: { additionalDirectories: '/net/h' } })).toEqual([])
    expect(ids({ permissions: { additionalDirectories: { a: '/net/h' } } })).toEqual([])
    expect(ids({ permissions: { additionalDirectories: null } })).toEqual([])
    expect(ids({ permissions: { allow: ['/net/h'] } })).toEqual([])
    expect(ids({ permissions: '/net/h' })).toEqual([])
    expect(ids({ additionalDirectories: ['/net/h'] })).toEqual([])
    expect(ids('[]')).toEqual([])
  })

  it.fails('reads the last of two keys, as JSON.parse does', () => {
    expect(
      ids('{"permissions":{"additionalDirectories":["/net/h"],"additionalDirectories":["/ok"]}}'),
    ).toEqual([])
    expect(
      ids('{"permissions":{"additionalDirectories":["/ok"],"additionalDirectories":["/net/h"]}}'),
    ).toEqual(['networkPath'])
  })

  it.fails('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(dirs('/net/h'), HIDDEN)).toEqual([])
  })

  it.fails('reads no directory out of the repository', () => {
    // The rule reads the text only. A path that does not exist gives the same result.
    expect(ids(dirs('/does/not/exist', '../missing'))).toEqual([])
  })
})
