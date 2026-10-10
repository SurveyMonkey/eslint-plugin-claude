// `disableAllHooks: true` turns off the hooks that the same file defines
// (https://code.claude.com/docs/en/settings-reference#disableallhooks). A settings file with a
// higher scope can set the key again, so the rule reads the siblings on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, hooks } from '../hooks.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-disabled-by-disableallhooks'
const json = JSON.stringify
const HOOKS = hooks('Stop', [command()])
const OFF = { disableAllHooks: true, hooks: HOOKS }
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MAIN = 'managed-settings.json'
const DROP = 'managed-settings.d/10-a.json'

/** The message ids for the text `code` at `file` of a repository that holds `files`. */
function idsAt(files: Record<string, string>, code: unknown, file = PROJECT) {
  const root = repo(files)
  const text = typeof code === 'string' ? code : json(code)
  return lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
}

describe(`${name}: the report`, () => {
  it('reports hooks in each settings file that also sets disableAllHooks to true', () => {
    for (const file of [PROJECT, LOCAL, MAIN, DROP]) {
      expect(idsAt({}, OFF, file), file).toEqual(['off'])
    }
  })

  it('reports at the hooks key, and names the key that turns them off', () => {
    const root = repo({})
    const text = '{\n  "disableAllHooks": true,\n  "hooks": {"Stop": []}\n}'
    const found = lintJson(name, text, path.join(root, PROJECT))
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['off', 3, 3],
    ])
    expect(found[0]?.message).toBe(
      'Claude Code runs none of the hooks in this file: "disableAllHooks" is true.',
    )
  })

  it('reads the last of two keys of one name', () => {
    expect(
      idsAt({}, '{"disableAllHooks": false, "disableAllHooks": true, "hooks": {"Stop": []}}'),
    ).toEqual(['off'])
    expect(
      idsAt({}, '{"disableAllHooks": true, "disableAllHooks": false, "hooks": {"Stop": []}}'),
    ).toEqual([])
  })
})

describe(`${name}: the files that the rule reads`, () => {
  it('reads the last of two hooks keys', () => {
    expect(idsAt({}, '{"disableAllHooks": true, "hooks": {"Stop": []}, "hooks": {}}')).toEqual([])
    expect(idsAt({}, '{"disableAllHooks": true, "hooks": {}, "hooks": {"Stop": []}}')).toEqual([
      'off',
    ])
  })

  it('reads no sibling for the local file, which is the top of the project scopes', () => {
    expect(idsAt({ [LOCAL]: '{"disableAllHooks": false}' }, OFF, LOCAL)).toEqual(['off'])
    expect(idsAt({ [LOCAL]: '{' }, OFF, LOCAL)).toEqual(['off'])
  })

  it('is silent when a managed sibling sets the key, whatever its value', () => {
    expect(idsAt({ [DROP]: '{"disableAllHooks": true}' }, OFF, MAIN)).toEqual([])
    expect(idsAt({ [MAIN]: '{"disableAllHooks": false}' }, OFF, DROP)).toEqual([])
  })

  it('reports when the local file sets a value that is not the Boolean false', () => {
    for (const value of [0, '', null, 'false']) {
      expect(idsAt({ [LOCAL]: json({ disableAllHooks: value }) }, OFF), String(value)).toEqual([
        'off',
      ])
    }
  })
})

describe(`${name}: silent cases`, () => {
  it('is silent when disableAllHooks is false, unset or not true', () => {
    expect(idsAt({}, { disableAllHooks: false, hooks: HOOKS })).toEqual([])
    expect(idsAt({}, { hooks: HOOKS })).toEqual([])
    expect(idsAt({}, { disableAllHooks: 'true', hooks: HOOKS })).toEqual([])
    expect(idsAt({}, { disableAllHooks: null, hooks: HOOKS })).toEqual([])
  })

  it('is silent when the file defines no hooks', () => {
    expect(idsAt({}, { disableAllHooks: true })).toEqual([])
    expect(idsAt({}, { disableAllHooks: true, hooks: {} })).toEqual([])
    expect(idsAt({}, { disableAllHooks: true, hooks: null })).toEqual([])
    expect(idsAt({}, { disableAllHooks: true, hooks: [] })).toEqual([])
    expect(idsAt({}, '[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(idsAt({}, OFF, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})

describe(`${name}: the scope that sets the key again`, () => {
  it('is silent when the local file sets disableAllHooks to false', () => {
    const files = { [LOCAL]: json({ disableAllHooks: false }) }
    expect(idsAt(files, OFF, PROJECT)).toEqual([])
  })

  it('is silent when the local file does not parse to an object', () => {
    expect(idsAt({ [LOCAL]: '{' }, OFF, PROJECT)).toEqual([])
    expect(idsAt({ [LOCAL]: '[1]' }, OFF, PROJECT)).toEqual([])
    expect(idsAt({ [LOCAL]: 'null' }, OFF, PROJECT)).toEqual([])
  })

  it('reports when the local file sets disableAllHooks to true, or sets nothing', () => {
    expect(idsAt({ [LOCAL]: json({ disableAllHooks: true }) }, OFF, PROJECT)).toEqual(['off'])
    expect(idsAt({ [LOCAL]: json({ model: 'opus' }) }, OFF, PROJECT)).toEqual(['off'])
  })

  it('reports a local file whose project file sets false, as the local file wins', () => {
    const files = { [PROJECT]: json({ disableAllHooks: false }) }
    expect(idsAt(files, OFF, LOCAL)).toEqual(['off'])
  })

  it('is silent when a sibling of the managed source sets the key', () => {
    const files = { [DROP]: json({ disableAllHooks: false }) }
    expect(idsAt(files, OFF, MAIN)).toEqual([])
    const base = { [MAIN]: json({ disableAllHooks: false }) }
    expect(idsAt(base, OFF, 'managed-settings.d/20-b.json')).toEqual([])
  })

  it('reports when no sibling of the managed source sets the key', () => {
    const files = { [DROP]: json({ model: 'opus' }) }
    expect(idsAt(files, OFF, MAIN)).toEqual(['off'])
  })

  it('is silent when a sibling cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [LOCAL]: '{}', [PROJECT]: '{}' })
    withoutAccess(path.join(root, LOCAL), () => {
      expect(lintJson(name, json(OFF), path.join(root, PROJECT))).toEqual([])
    })
    const managed = repo({ [DROP]: '{}' })
    withoutAccess(path.join(managed, DROP), () => {
      expect(lintJson(name, json(OFF), path.join(managed, MAIN))).toEqual([])
    })
  })
})
