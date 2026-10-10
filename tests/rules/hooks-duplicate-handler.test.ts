// A hook that is in a plugin's `hooks/hooks.json` and in its `plugin.json` `hooks` loads from both
// (https://code.claude.com/docs/en/plugins/components#hooks). A hook that is in a settings file and in
// a plugin `hooks.json` runs twice
// (https://code.claude.com/docs/en/plugins/create#convert-an-existing-claude-setup). A handler that
// two settings files define runs once (https://code.claude.com/docs/en/hooks#hook-handler-fields).
// The rule reports on the later source: settings, then `hooks/hooks.json`, then `plugin.json`.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, hooks } from '../hooks.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-duplicate-handler'
const json = JSON.stringify
const HOOKS = hooks('PostToolUse', [command({ command: './fmt.sh' })], 'Write')
const PLUGIN_HOOKS = 'hooks/hooks.json'
const MANIFEST = '.claude-plugin/plugin.json'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const file = (value: unknown = HOOKS) => json({ hooks: value })
const manifest = (value: unknown = HOOKS) => json({ name: 'p', hooks: value })

/** The messages for the text `text` at `target` of a repository that holds `files`. */
function lint(files: Record<string, string>, text: string, target: string) {
  const root = repo(files)
  return lintJson(name, text, path.join(root, target))
}
const ids = (files: Record<string, string>, text: string, target: string) =>
  lint(files, text, target).map((message) => message.messageId)

describe(`${name}: plugin.json and hooks/hooks.json`, () => {
  it.fails('reports an inline handler that hooks/hooks.json also defines', () => {
    expect(ids({ [PLUGIN_HOOKS]: file() }, manifest(), MANIFEST)).toEqual(['duplicate'])
  })

  it.fails('reports at the handler, and names the other file', () => {
    const text = `{\n  "name": "p",\n  "hooks": {"PostToolUse": [{"matcher": "Write", "hooks": [{"type": "command", "command": "./fmt.sh"}]}]}\n}`
    const found = lint({ [PLUGIN_HOOKS]: file() }, text, MANIFEST)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['duplicate', 3, 61],
    ])
    expect(found[0]?.message).toBe(
      'This handler is identical to one in "hooks/hooks.json". Claude Code loads both, so the hook runs twice. Keep one copy.',
    )
  })

  it.fails('reads the inline objects of a hooks array, and skips its paths', () => {
    const value = ['./extra.json', HOOKS, { Stop: [{ hooks: [command()] }] }]
    expect(ids({ [PLUGIN_HOOKS]: file() }, manifest(value), MANIFEST)).toEqual(['duplicate'])
  })

  it.fails('reports each inline handler that has a twin', () => {
    const twice = { ...HOOKS, Stop: [{ hooks: [command()] }] }
    const sibling = file(twice)
    expect(ids({ [PLUGIN_HOOKS]: sibling }, manifest(twice), MANIFEST)).toEqual([
      'duplicate',
      'duplicate',
    ])
  })

  it.fails('compares the whole handler, whatever the order of its keys', () => {
    const sibling =
      '{"hooks":{"PostToolUse":[{"hooks":[{"command":"./fmt.sh","type":"command"}],"matcher":"Write"}]}}'
    expect(ids({ [PLUGIN_HOOKS]: sibling }, manifest(), MANIFEST)).toEqual(['duplicate'])
  })

  it.fails('compares a group with no matcher, and a nested handler field', () => {
    const plain = hooks('Stop', [command({ args: ['a'], if: 'Bash(x)' })])
    expect(ids({ [PLUGIN_HOOKS]: file(plain) }, manifest(plain), MANIFEST)).toEqual(['duplicate'])
  })

  it.fails('is silent when the handlers differ', () => {
    const base = { [PLUGIN_HOOKS]: file() }
    for (const other of [
      hooks('PostToolUse', [command({ command: './other.sh' })], 'Write'),
      hooks('PostToolUse', [command({ command: './fmt.sh' })], 'Edit'),
      hooks('PostToolUse', [command({ command: './fmt.sh' })]),
      hooks('PreToolUse', [command({ command: './fmt.sh' })], 'Write'),
      hooks('PostToolUse', [command({ command: './fmt.sh', timeout: 5 })], 'Write'),
      hooks('PostToolUse', [command({ command: './fmt.sh', args: [] })], 'Write'),
      hooks('PostToolUse', [{ type: 'http', url: './fmt.sh' }], 'Write'),
    ]) {
      expect(ids(base, manifest(other), MANIFEST), json(other)).toEqual([])
    }
  })

  it.fails('is silent when plugin.json holds a path, no hooks, or hooks of the wrong type', () => {
    const base = { [PLUGIN_HOOKS]: file() }
    for (const value of [
      './hooks/hooks.json',
      null,
      1,
      [],
      {},
      { PostToolUse: 1 },
      { PostToolUse: [1] },
    ]) {
      expect(ids(base, manifest(value), MANIFEST), json(value)).toEqual([])
    }
    expect(ids(base, json({ name: 'p' }), MANIFEST)).toEqual([])
    expect(ids(base, '[1]', MANIFEST)).toEqual([])
  })

  it.fails('is silent when hooks/hooks.json is not there, or holds no handler', () => {
    expect(ids({}, manifest(), MANIFEST)).toEqual([])
    for (const text of ['{}', '[]', '{"hooks": []}', '{"hooks": {"PostToolUse": 1}}', 'null']) {
      expect(ids({ [PLUGIN_HOOKS]: text }, manifest(), MANIFEST), text).toEqual([])
    }
  })

  it.fails('reports nothing for a plugin.json outside .claude-plugin', () => {
    expect(ids({ [PLUGIN_HOOKS]: file() }, manifest(), 'plugin.json')).toEqual([])
  })
})

describe(`${name}: the sibling that the rule cannot read`, () => {
  it.fails('is silent when hooks/hooks.json does not parse', () => {
    expect(ids({ [PLUGIN_HOOKS]: '{' }, manifest(), MANIFEST)).toEqual([])
  })

  it.fails('is silent when hooks/hooks.json links to a file out of the repository', () => {
    const root = repo({ [MANIFEST]: manifest() })
    const outside = path.join(path.dirname(root), 'outside-hooks.json')
    writeFileSync(outside, file())
    mkdirSync(path.join(root, 'hooks'))
    symlinkSync(outside, path.join(root, PLUGIN_HOOKS))
    expect(lintJson(name, manifest(), path.join(root, MANIFEST))).toEqual([])
  })

  it.fails('is silent when hooks/hooks.json is a dangling link', () => {
    const root = repo({ [MANIFEST]: manifest() })
    mkdirSync(path.join(root, 'hooks'))
    symlinkSync(path.join(root, 'nowhere.json'), path.join(root, PLUGIN_HOOKS))
    expect(lintJson(name, manifest(), path.join(root, MANIFEST))).toEqual([])
  })

  it.fails('is silent when hooks/hooks.json cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [PLUGIN_HOOKS]: file() })
    withoutAccess(path.join(root, PLUGIN_HOOKS), () => {
      expect(lintJson(name, manifest(), path.join(root, MANIFEST))).toEqual([])
    })
  })
})

describe(`${name}: settings files and hooks/hooks.json`, () => {
  it.fails('reports a plugin handler that .claude/settings.json also defines', () => {
    expect(ids({ [PROJECT]: file() }, file(), PLUGIN_HOOKS)).toEqual(['duplicate'])
    expect(ids({ [LOCAL]: file() }, file(), PLUGIN_HOOKS)).toEqual(['duplicate'])
  })

  it.fails('names the settings file, relative to the plugin root', () => {
    const [message] = lint({ [PROJECT]: file() }, file(), PLUGIN_HOOKS)
    expect(message?.message).toBe(
      'This handler is identical to one in ".claude/settings.json". Claude Code loads both, so the hook runs twice. Keep one copy.',
    )
  })

  it.fails('finds the settings of the project above a plugin folder', () => {
    const files = { [PROJECT]: file() }
    expect(ids(files, file(), 'plugins/p/hooks/hooks.json')).toEqual(['duplicate'])
    expect(ids(files, manifest(), 'plugins/p/.claude-plugin/plugin.json')).toEqual(['duplicate'])
    const [message] = lint(files, file(), 'plugins/p/hooks/hooks.json')
    expect(message?.message).toContain('"../../.claude/settings.json"')
  })

  it.fails('reports a plugin.json handler that a settings file defines, once', () => {
    const files = { [PROJECT]: file(), [PLUGIN_HOOKS]: file() }
    expect(ids(files, manifest(), MANIFEST)).toEqual(['duplicate'])
    expect(ids(files, file(), PLUGIN_HOOKS)).toEqual(['duplicate'])
  })

  it.fails('is silent for two settings files that define the same handler', () => {
    expect(ids({ [LOCAL]: file() }, file(), PROJECT)).toEqual([])
    expect(ids({ [PROJECT]: file() }, file(), LOCAL)).toEqual([])
  })

  it.fails('is silent when the settings differ, hold no hooks, or cannot be read', () => {
    const other = file(hooks('PostToolUse', [command({ command: './other.sh' })], 'Write'))
    for (const text of [other, '{}', '{', '[1]', 'null', '{"hooks": 1}', '{"hooks": []}']) {
      expect(ids({ [PROJECT]: text }, file(), PLUGIN_HOOKS), text).toEqual([])
    }
  })

  it.fails('is silent when the settings file sets disableAllHooks to true', () => {
    const off = json({ disableAllHooks: true, hooks: HOOKS })
    expect(ids({ [PROJECT]: off }, file(), PLUGIN_HOOKS)).toEqual([])
  })

  it.fails('reads no settings file above the repository', () => {
    const root = repo({})
    const parent = path.dirname(root)
    mkdirSync(path.join(parent, '.claude'), { recursive: true })
    writeFileSync(path.join(parent, PROJECT), file())
    expect(lintJson(name, file(), path.join(root, PLUGIN_HOOKS))).toEqual([])
  })

  it.fails('reads the settings of the plugin folder only when the folder holds no .git', () => {
    const root = repo({ [PROJECT]: file() })
    rmSync(path.join(root, '.git'), { recursive: true })
    expect(lintJson(name, file(), path.join(root, PLUGIN_HOOKS)).map((m) => m.messageId)).toEqual([
      'duplicate',
    ])
    mkdirSync(path.join(root, 'sub/hooks'), { recursive: true })
    expect(lintJson(name, file(), path.join(root, 'sub', PLUGIN_HOOKS))).toEqual([])
  })

  it.fails('is silent when the settings link to a file out of the repository', () => {
    const root = repo({})
    const outside = path.join(path.dirname(root), 'outside-settings.json')
    writeFileSync(outside, file())
    mkdirSync(path.join(root, '.claude'))
    symlinkSync(outside, path.join(root, PROJECT))
    expect(lintJson(name, file(), path.join(root, PLUGIN_HOOKS))).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it.fails('is silent in a settings file and a hooks.json that Claude Code does not read', () => {
    const files = { [PROJECT]: file(), [PLUGIN_HOOKS]: file() }
    expect(ids(files, file(), LOCAL)).toEqual([])
    expect(ids(files, file(), 'managed-settings.json')).toEqual([])
    expect(ids(files, file(), '.claude/hooks.json')).toEqual([])
    expect(ids(files, file(), '.claude/hooks/hooks.json')).toEqual([])
  })

  it.fails('is silent for a hooks.json with no hooks object', () => {
    const files = { [PROJECT]: file() }
    expect(ids(files, '{"modules": []}', PLUGIN_HOOKS)).toEqual([])
    expect(ids(files, '[1]', PLUGIN_HOOKS)).toEqual([])
  })
})
