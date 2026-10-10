// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#defaultshell): `"powershell"` works only
// while the PowerShell tool is on, and macOS, Linux and WSL need `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`.
// The platform is the option `platforms`, with the values of `hooks-ps1-needs-powershell-shell`
// (mid-round ruling 26). The variable can sit in the other file that Claude Code merges with the
// linted file, so each case builds a tree on disk. The file globs are in `tests/configs.test.ts`.
import { chmodSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'claude/settings-defaultshell-powershell-tool'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const HIDDEN = 'managed-settings.d/.30-h.json'
const SHELL = JSON.stringify({ defaultShell: 'powershell' })
const tool = (value: unknown) => JSON.stringify({ env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: value } })

/** The messages of the rule for the text `code` at `file` in the tree `dir`. */
function lint(dir: string, file: string, code: string, platforms?: string[]) {
  const filename = path.join(dir, file)
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [name]: platforms === undefined ? 'error' : ['error', { platforms }] },
      },
    ],
    { filename },
  )
}

const ids = (...args: Parameters<typeof lint>) => lint(...args).map((m) => m.messageId)

describe('settings-defaultshell-powershell-tool: the option platforms', () => {
  it('reports with a platform that has no PowerShell tool by default, in every settings file', () => {
    for (const platform of ['macos', 'linux', 'wsl']) {
      for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
        expect(ids(tree({}), file, SHELL, [platform]), `${platform} ${file}`).toEqual(['off'])
      }
    }
  })

  it('names the platforms that are not Windows, on the value', () => {
    const [message] = lint(tree({}), PROJECT, '{\n  "defaultShell": "powershell"\n}', [
      'windows-git-bash',
      'linux',
      'macos',
    ])
    expect(message?.message).toContain('"linux", "macos"')
    expect(message?.message).not.toContain('windows')
    expect([message?.line, message?.column]).toEqual([2, 19])
  })

  it('is silent when the option is unset, empty, or names only Windows values', () => {
    expect(ids(tree({}), PROJECT, SHELL)).toEqual([])
    expect(ids(tree({}), PROJECT, SHELL, [])).toEqual([])
    expect(ids(tree({}), PROJECT, SHELL, ['windows-git-bash'])).toEqual([])
    expect(ids(tree({}), PROJECT, SHELL, ['windows-no-git-bash'])).toEqual([])
    expect(ids(tree({}), PROJECT, SHELL, ['windows-git-bash', 'windows-no-git-bash'])).toEqual([])
  })

  it('refuses a value that is not a platform', () => {
    expect(() => ids(tree({}), PROJECT, SHELL, ['windows'])).toThrow()
    expect(() => ids(tree({}), PROJECT, SHELL, ['macos', 'macos'])).toThrow()
  })
})

describe('settings-defaultshell-powershell-tool: the tool variable', () => {
  const MACOS = ['macos']

  it('is silent when the file turns the tool on', () => {
    for (const value of ['1', 'true', 'On']) {
      const code = JSON.stringify({ defaultShell: 'powershell', env: JSON.parse(tool(value)).env })
      expect(ids(tree({}), PROJECT, code, MACOS), value).toEqual([])
    }
  })

  it('reports a file that sets the variable off, or sets another variable', () => {
    for (const env of [
      { CLAUDE_CODE_USE_POWERSHELL_TOOL: '0' },
      { CLAUDE_CODE_USE_POWERSHELL_TOOL: 1 },
      { CLAUDE_CODE_USE_POWERSHELL_TOOL: true },
      { CLAUDE_CODE_USE_POWERSHELL_TOOL: null },
      { OTHER: '1' },
      'x',
      {},
    ]) {
      const code = JSON.stringify({ defaultShell: 'powershell', env })
      expect(ids(tree({}), PROJECT, code, MACOS), JSON.stringify(env)).toEqual(['off'])
    }
  })

  it('is silent when the other project file turns the tool on', () => {
    expect(ids(tree({ [LOCAL]: tool('1') }), PROJECT, SHELL, MACOS)).toEqual([])
    expect(ids(tree({ [PROJECT]: tool('1') }), LOCAL, SHELL, MACOS)).toEqual([])
  })

  it('is silent when another file of the managed source turns the tool on', () => {
    expect(ids(tree({ [MANAGED]: tool('1') }), DROP_IN, SHELL, MACOS)).toEqual([])
    expect(ids(tree({ [DROP_IN]: tool('1') }), MANAGED, SHELL, MACOS)).toEqual([])
  })

  it('reports when a sibling does not turn the tool on', () => {
    expect(ids(tree({ [LOCAL]: tool('0') }), PROJECT, SHELL, MACOS)).toEqual(['off'])
    expect(ids(tree({ [LOCAL]: '{}' }), PROJECT, SHELL, MACOS)).toEqual(['off'])
    expect(ids(tree({ [MANAGED]: '{"env": 1}' }), DROP_IN, SHELL, MACOS)).toEqual(['off'])
    expect(ids(tree({ [MANAGED]: '{"env": null}' }), DROP_IN, SHELL, MACOS)).toEqual(['off'])
    for (const value of [1, true, null]) {
      const sibling = JSON.stringify({ env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: value } })
      expect(ids(tree({ [LOCAL]: sibling }), PROJECT, SHELL, MACOS), String(value)).toEqual(['off'])
    }
    expect(ids(tree({ [HIDDEN]: tool('1') }), MANAGED, SHELL, MACOS)).toEqual(['off'])
  })

  it('is silent when a sibling cannot be read', () => {
    expect(ids(tree({ [LOCAL]: '{' }), PROJECT, SHELL, MACOS)).toEqual([])
    expect(ids(tree({ [LOCAL]: '[]' }), PROJECT, SHELL, MACOS)).toEqual([])
    expect(ids(tree({ [MANAGED]: '{' }), DROP_IN, SHELL, MACOS)).toEqual([])
  })

  it.skipIf(noLinks)('is silent when a sibling is a link out of the repository', () => {
    // The outside file holds no tool variable, so a read of it would give a report.
    const outside = tree({ 'settings.local.json': '{}' }, false)
    const dir = tree({})
    link(dir, LOCAL, path.join(outside, 'settings.local.json'))
    expect(ids(dir, PROJECT, SHELL, MACOS)).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('is silent when a sibling has no read access', () => {
    const dir = tree({ [LOCAL]: '{}' })
    withoutAccess(path.join(dir, LOCAL), () => {
      expect(ids(dir, PROJECT, SHELL, MACOS)).toEqual([])
    })
    chmodSync(path.join(dir, LOCAL), 0o644)
  })
})

describe('settings-defaultshell-powershell-tool: the value', () => {
  const MACOS = ['macos']

  it('is silent for bash, other values, and a value that is not a string', () => {
    for (const value of ['bash', 'PowerShell', '', null, true, ['powershell']]) {
      expect(ids(tree({}), PROJECT, JSON.stringify({ defaultShell: value }), MACOS)).toEqual([])
    }
    expect(ids(tree({}), PROJECT, '{}', MACOS)).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const twice = (a: string, b: string) => `{"defaultShell": "${a}", "defaultShell": "${b}"}`
    expect(ids(tree({}), PROJECT, twice('powershell', 'bash'), MACOS)).toEqual([])
    expect(ids(tree({}), PROJECT, twice('bash', 'powershell'), MACOS)).toEqual(['off'])
  })

  it('reads no hidden drop-in', () => {
    expect(ids(tree({}), 'managed-settings.d/.30-hidden.json', SHELL, MACOS)).toEqual([])
  })
})
