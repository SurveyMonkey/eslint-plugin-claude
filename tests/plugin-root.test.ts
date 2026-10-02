import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPluginRoot } from '../src/plugin-root.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

// `repo/` is the repository. `outside/` is a sibling that holds the targets of links.
let scratch = ''
beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'plugin-root-'))
  mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
  mkdirSync(path.join(scratch, 'outside'))
})
afterEach(() => rmSync(scratch, { recursive: true, force: true }))

const repo = (...parts: string[]) => path.join(scratch, 'repo', ...parts)
const outside = (...parts: string[]) => path.join(scratch, 'outside', ...parts)
const put = (file: string, text = '{}') => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return file
}

it('is a plugin root when it holds a manifest file', () => {
  put(repo('p', '.claude-plugin', 'plugin.json'))
  expect(isPluginRoot(repo('p'))).toBe(true)
})

it('is not a plugin root when the manifest is absent', () => {
  mkdirSync(repo('q', '.claude-plugin'), { recursive: true })
  mkdirSync(repo('r'), { recursive: true })
  put(repo('s', '.claude-plugin'), 'a file, not a directory')
  expect(isPluginRoot(repo('q'))).toBe(false)
  expect(isPluginRoot(repo('r'))).toBe(false)
  expect(isPluginRoot(repo('s'))).toBe(false)
  expect(isPluginRoot(repo('none'))).toBe(false)
  expect(isPluginRoot(repo())).toBe(false)
})

describe.skipIf(process.platform === 'win32')('a link', () => {
  it('is a plugin root when the manifest is a link to a file out of the repository', () => {
    const target = put(outside('plugin.json'))
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync(target, repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it.fails('is a plugin root when the manifest is a dangling link', () => {
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync('missing.json', repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is a plugin root when the manifest is a link to a directory', () => {
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync(repo(), repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it.fails('is unseen when `.claude-plugin/` is a link to a directory out of the repository', () => {
    put(outside('meta', 'plugin.json'))
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync(outside('meta'), repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
  })

  it('is a plugin root when `.claude-plugin/` is a link to a directory in the repository', () => {
    put(repo('shared', 'plugin.json'))
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync(repo('shared'), repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is not a plugin root when `.claude-plugin/` is a dangling link', () => {
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync('missing', repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(false)
  })
})

describe.skipIf(chmodCannotBlock)('a path that the check cannot read', () => {
  it.fails('is unseen when `.claude-plugin/` cannot be searched', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    withoutAccess(repo('p', '.claude-plugin'), () => {
      expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    })
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it.fails('is unseen when the directory above `.claude-plugin/` cannot be searched', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    withoutAccess(repo('p'), () => {
      expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    })
  })
})
