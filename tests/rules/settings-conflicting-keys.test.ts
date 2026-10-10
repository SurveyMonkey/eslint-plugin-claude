// Each pair is a sentence of the settings reference, or of the channels page:
// https://code.claude.com/docs/en/settings-reference
// https://code.claude.com/docs/en/channels#restrict-which-channel-plugins-can-run
// `lintJson` runs the rule on a file at a path. These rules read no second file.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-conflicting-keys'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)

describe(`${name}: verbose and viewMode`, () => {
  it.fails('reports verbose when viewMode is set, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ verbose: true, viewMode: 'default' }, file), file).toEqual(['verbose'])
      expect(ids({ viewMode: 'focus', verbose: false }, file), file).toEqual(['verbose'])
    }
  })

  it.fails('reports the key verbose, at its line and column', () => {
    const text = '{\n  "viewMode": "verbose",\n  "verbose": true\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 3]])
  })

  it.fails('is silent for verbose alone, viewMode alone, or a viewMode that is no view', () => {
    expect(ids({ verbose: true })).toEqual([])
    expect(ids({ viewMode: 'verbose' })).toEqual([])
    expect(ids({ verbose: true, viewMode: 'loud' })).toEqual([])
    expect(ids({ verbose: true, viewMode: 3 })).toEqual([])
  })

  it.fails('is silent when either key is null: a null removes the key', () => {
    expect(ids({ verbose: true, viewMode: null })).toEqual([])
    expect(ids({ verbose: null, viewMode: 'default' })).toEqual([])
  })

  it.fails('reads the last of two keys of one name', () => {
    expect(ids('{"viewMode": "default", "viewMode": null, "verbose": true}')).toEqual([])
    expect(ids('{"viewMode": null, "viewMode": "default", "verbose": true}')).toEqual(['verbose'])
    expect(ids('{"verbose": true, "viewMode": "default", "verbose": null}')).toEqual([])
    expect(ids('{"verbose": true, "verbose": true, "viewMode": "default"}')).toEqual(['verbose'])
  })
})

describe(`${name}: spinnerTipsOverride and spinnerTipsEnabled`, () => {
  it.fails('reports spinnerTipsOverride when spinnerTipsEnabled is false, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = { spinnerTipsOverride: { tips: ['a'] }, spinnerTipsEnabled: false }
      expect(ids(code, file), file).toEqual(['tipsHidden'])
    }
  })

  it.fails('reports the key spinnerTipsOverride, at its line and column', () => {
    const text = '{\n  "spinnerTipsEnabled": false,\n  "spinnerTipsOverride": {}\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 3]])
  })

  it.fails('is silent when spinnerTipsEnabled is true, unset, null, or not false', () => {
    expect(ids({ spinnerTipsOverride: {}, spinnerTipsEnabled: true })).toEqual([])
    expect(ids({ spinnerTipsOverride: {} })).toEqual([])
    expect(ids({ spinnerTipsOverride: {}, spinnerTipsEnabled: null })).toEqual([])
    expect(ids({ spinnerTipsOverride: {}, spinnerTipsEnabled: 'false' })).toEqual([])
    expect(ids({ spinnerTipsEnabled: false })).toEqual([])
  })

  it.fails('is silent when spinnerTipsOverride is null', () => {
    expect(ids({ spinnerTipsOverride: null, spinnerTipsEnabled: false })).toEqual([])
  })
})

describe(`${name}: enableWorkflows and disableWorkflows`, () => {
  it.fails('reports enableWorkflows true when disableWorkflows is true, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ enableWorkflows: true, disableWorkflows: true }, file), file).toEqual([
        'workflows',
      ])
    }
  })

  it.fails('is silent for every other pair of values', () => {
    expect(ids({ enableWorkflows: true, disableWorkflows: false })).toEqual([])
    expect(ids({ enableWorkflows: false, disableWorkflows: true })).toEqual([])
    expect(ids({ enableWorkflows: true })).toEqual([])
    expect(ids({ disableWorkflows: true })).toEqual([])
    expect(ids({ enableWorkflows: true, disableWorkflows: null })).toEqual([])
    expect(ids({ enableWorkflows: null, disableWorkflows: true })).toEqual([])
    expect(ids({ enableWorkflows: 'true', disableWorkflows: true })).toEqual([])
  })
})

describe(`${name}: the status line and file suggestion gates`, () => {
  it.fails('reports each command key when disableAllHooks is true, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const key of ['statusLine', 'subagentStatusLine', 'fileSuggestion']) {
        const code = { [key]: { type: 'command', command: 'x' }, disableAllHooks: true }
        expect(ids(code, file), `${file} ${key}`).toEqual(['hooksOff'])
      }
    }
  })

  it.fails('reports each of the three keys once', () => {
    const code = {
      statusLine: {},
      subagentStatusLine: {},
      fileSuggestion: {},
      disableAllHooks: true,
    }
    expect(ids(code)).toEqual(['hooksOff', 'hooksOff', 'hooksOff'])
  })

  it.fails('names the key in the message', () => {
    const [message] = lint({ fileSuggestion: {}, disableAllHooks: true })
    expect(message?.message).toContain('"fileSuggestion"')
  })

  it.fails('is silent when disableAllHooks is false, unset, null or not true', () => {
    expect(ids({ statusLine: {}, disableAllHooks: false })).toEqual([])
    expect(ids({ statusLine: {} })).toEqual([])
    expect(ids({ statusLine: {}, disableAllHooks: null })).toEqual([])
    expect(ids({ statusLine: {}, disableAllHooks: 'true' })).toEqual([])
    expect(ids({ disableAllHooks: true })).toEqual([])
  })

  it.fails('is silent for a null command key', () => {
    expect(ids({ statusLine: null, disableAllHooks: true })).toEqual([])
  })
})

describe(`${name}: viewMode focus and tui`, () => {
  it.fails('reports viewMode focus when tui is default, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ viewMode: 'focus', tui: 'default' }, file), file).toEqual(['focus'])
    }
  })

  it.fails('reports the key viewMode, at its line and column', () => {
    const text = '{\n  "tui": "default",\n  "viewMode": "focus"\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 3]])
  })

  it.fails('is silent when tui is fullscreen, unset or null: another renderer rule decides', () => {
    expect(ids({ viewMode: 'focus', tui: 'fullscreen' })).toEqual([])
    expect(ids({ viewMode: 'focus' })).toEqual([])
    expect(ids({ viewMode: 'focus', tui: null })).toEqual([])
  })

  it.fails('is silent for a viewMode other than focus', () => {
    expect(ids({ viewMode: 'default', tui: 'default' })).toEqual([])
    expect(ids({ viewMode: 'verbose', tui: 'default' })).toEqual([])
    expect(ids({ viewMode: null, tui: 'default' })).toEqual([])
    expect(ids({ tui: 'default' })).toEqual([])
  })
})

describe(`${name}: vimInsertModeRemaps and editorMode`, () => {
  it.fails('reports the remaps in a managed file that sets editorMode to normal', () => {
    for (const file of MANAGED_FILES) {
      const code = { vimInsertModeRemaps: { jj: '<Esc>' }, editorMode: 'normal' }
      expect(ids(code, file), file).toEqual(['vimRemaps'])
    }
  })

  it.fails('names the editorMode value in the message', () => {
    const [message] = lint({ vimInsertModeRemaps: {}, editorMode: 'normal' }, MANAGED)
    expect(message?.message).toContain('"normal"')
  })

  it.fails('is silent when editorMode is vim, unset or null: a user file can set vim', () => {
    expect(ids({ vimInsertModeRemaps: {}, editorMode: 'vim' }, MANAGED)).toEqual([])
    expect(ids({ vimInsertModeRemaps: {} }, MANAGED)).toEqual([])
    expect(ids({ vimInsertModeRemaps: {}, editorMode: null }, MANAGED)).toEqual([])
    expect(ids({ vimInsertModeRemaps: {}, editorMode: 3 }, MANAGED)).toEqual([])
  })

  it.fails('is silent when vimInsertModeRemaps is null', () => {
    expect(ids({ vimInsertModeRemaps: null, editorMode: 'normal' }, MANAGED)).toEqual([])
  })

  it.fails('is silent in a project file: settings-key-scope reports the key there', () => {
    for (const file of PROJECT_FILES) {
      expect(ids({ vimInsertModeRemaps: {}, editorMode: 'normal' }, file), file).toEqual([])
    }
  })
})

describe(`${name}: disableAutoMode and defaultMode`, () => {
  it.fails('reports defaultMode auto when disableAutoMode is disable, in every file', () => {
    for (const file of EVERY_FILE) {
      const top = { disableAutoMode: 'disable', permissions: { defaultMode: 'auto' } }
      const nested = { permissions: { disableAutoMode: 'disable', defaultMode: 'auto' } }
      expect(ids(top, file), file).toEqual(['autoMode'])
      expect(ids(nested, file), file).toEqual(['autoMode'])
    }
  })

  it.fails('reports the key defaultMode, at its line and column', () => {
    const text =
      '{\n  "disableAutoMode": "disable",\n  "permissions": {\n    "defaultMode": "auto"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[4, 5]])
  })

  it.fails('is silent for another defaultMode, or a disableAutoMode that is not disable', () => {
    expect(ids({ disableAutoMode: 'disable', permissions: { defaultMode: 'plan' } })).toEqual([])
    expect(ids({ disableAutoMode: 'enable', permissions: { defaultMode: 'auto' } })).toEqual([])
    expect(ids({ disableAutoMode: true, permissions: { defaultMode: 'auto' } })).toEqual([])
    expect(ids({ permissions: { defaultMode: 'auto' } })).toEqual([])
    expect(ids({ disableAutoMode: 'disable' })).toEqual([])
    expect(ids({ disableAutoMode: 'disable', permissions: {} })).toEqual([])
    expect(ids({ disableAutoMode: 'disable', permissions: 'auto' })).toEqual([])
  })

  it.fails('is silent when a key is null', () => {
    expect(ids({ disableAutoMode: null, permissions: { defaultMode: 'auto' } })).toEqual([])
    expect(ids({ disableAutoMode: 'disable', permissions: { defaultMode: null } })).toEqual([])
    expect(
      ids({
        disableAutoMode: 'disable',
        permissions: { disableAutoMode: null, defaultMode: 'auto' },
      }),
    ).toEqual(['autoMode'])
    expect(
      ids({ disableAutoMode: null, permissions: { disableAutoMode: null, defaultMode: 'auto' } }),
    ).toEqual([])
  })
})

describe(`${name}: timeZone and timeFormat`, () => {
  it.fails('reports timeZone when timeFormat is 24-hour-utc, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ timeZone: 'Europe/Dublin', timeFormat: '24-hour-utc' }, file), file).toEqual([
        'timeZone',
      ])
    }
  })

  it.fails('is silent for another timeFormat, or an unset or null key', () => {
    expect(ids({ timeZone: 'UTC', timeFormat: '24-hour' })).toEqual([])
    expect(ids({ timeZone: 'UTC', timeFormat: '%H:%M' })).toEqual([])
    expect(ids({ timeZone: 'UTC' })).toEqual([])
    expect(ids({ timeFormat: '24-hour-utc' })).toEqual([])
    expect(ids({ timeZone: null, timeFormat: '24-hour-utc' })).toEqual([])
    expect(ids({ timeZone: 'UTC', timeFormat: null })).toEqual([])
  })
})

describe(`${name}: allowedChannelPlugins and channelsEnabled`, () => {
  const plugins = [{ marketplace: 'claude-plugins-official', plugin: 'telegram' }]

  it.fails('reports the list in a managed file when channelsEnabled is not true', () => {
    for (const file of MANAGED_FILES) {
      expect(ids({ allowedChannelPlugins: plugins }, file), file).toEqual(['channels'])
      expect(ids({ allowedChannelPlugins: plugins, channelsEnabled: false }, file), file).toEqual([
        'channels',
      ])
      expect(ids({ allowedChannelPlugins: plugins, channelsEnabled: null }, file), file).toEqual([
        'channels',
      ])
      expect(ids({ allowedChannelPlugins: [] }, file), file).toEqual(['channels'])
    }
  })

  it.fails('is silent when channelsEnabled is true', () => {
    for (const file of MANAGED_FILES) {
      expect(ids({ allowedChannelPlugins: plugins, channelsEnabled: true }, file), file).toEqual([])
    }
  })

  it.fails('is silent when allowedChannelPlugins is unset or null', () => {
    expect(ids({ channelsEnabled: false }, MANAGED)).toEqual([])
    expect(ids({ allowedChannelPlugins: null }, MANAGED)).toEqual([])
  })

  it.fails('is silent in a project file: settings-key-scope reports the key there', () => {
    for (const file of PROJECT_FILES) {
      expect(ids({ allowedChannelPlugins: plugins }, file), file).toEqual([])
    }
  })
})

describe(`${name}: files`, () => {
  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids({ verbose: true, viewMode: 'default' }, HIDDEN)).toEqual([])
    expect(ids({ allowedChannelPlugins: [] }, HIDDEN)).toEqual([])
  })

  it.fails('reports each pair of one file, in file order', () => {
    const code = {
      verbose: true,
      viewMode: 'focus',
      tui: 'default',
      timeZone: 'UTC',
      timeFormat: '24-hour-utc',
    }
    expect(ids(code)).toEqual(['verbose', 'focus', 'timeZone'])
  })

  it.fails('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
    expect(ids('{"permissions": {"defaultMode": "auto"}, "disableAutoMode": []}')).toEqual([])
  })
})
