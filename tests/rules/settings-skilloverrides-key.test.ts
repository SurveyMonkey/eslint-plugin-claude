// The expected values come from the settings reference (https://code.claude.com/docs/en/settings-reference#skilloverrides),
// the skills page (https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings)
// and the commands reference (https://code.claude.com/docs/en/commands), which marks each bundled
// skill and names its alias: `/review` for `/code-review`, `/checkup` for `/doctor` and
// `/proactive` for `/loop`.
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-skilloverrides-key'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const MANAGED_FILES = [MANAGED, DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const overrides = (map: Record<string, unknown>) => ({ skillOverrides: map })

describe(`${name}: a plugin skill key`, () => {
  /** A settings object that enables the plugins `plugins` and sets the overrides `map`. */
  const withPlugins = (map: Record<string, unknown>, plugins = ['formatter', 'acme']) => ({
    enabledPlugins: Object.fromEntries(plugins.map((plugin) => [`${plugin}@market`, true])),
    skillOverrides: map,
  })

  it('reports a plugin:skill key of an enabled plugin, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(withPlugins({ 'formatter:lint': 'off' }), file), file).toEqual(['pluginSkill'])
    }
  })

  it('reports on the key, and names it', () => {
    const text =
      '{\n  "enabledPlugins": {"acme@market": true},\n  "skillOverrides": {\n    "deploy": "off",\n    "acme:deploy": "off"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['pluginSkill', 5, 5])
    expect(message?.message).toContain('"acme:deploy"')
    expect(message?.message).toContain('/plugin')
  })

  it('reports each plugin key once', () => {
    expect(ids(withPlugins({ 'acme:b': 'off', 'formatter:d': 'name-only', deploy: 'on' }))).toEqual(
      ['pluginSkill', 'pluginSkill'],
    )
  })

  it('is silent for a colon name of a plugin that the file does not enable', () => {
    // A command in a subfolder of .claude/commands/ is /frontend:component. A nested skill is
    // /apps/web:deploy. The skills page names both. Neither is a plugin skill.
    expect(ids(overrides({ 'frontend:component': 'off', 'apps/web:deploy': 'off' }))).toEqual([])
    expect(ids(withPlugins({ 'frontend:component': 'off' }))).toEqual([])
    expect(ids(withPlugins({ ':x': 'off', acme: 'off' }))).toEqual([])
  })

  it('is silent when the plugin is off, null or only a prefix of the plugin name', () => {
    const off = { enabledPlugins: { 'acme@market': false }, skillOverrides: { 'acme:a': 'off' } }
    const none = { enabledPlugins: { 'acme@market': null }, skillOverrides: { 'acme:a': 'off' } }
    const longer = { enabledPlugins: { 'acme-tools@m': true }, skillOverrides: { 'acme:a': 'off' } }
    expect(ids(off)).toEqual([])
    expect(ids(none)).toEqual([])
    expect(ids(longer)).toEqual([])
  })

  it('reports a plugin that the file turns on, whatever the value type', () => {
    expect(
      ids({ enabledPlugins: { 'acme@market': ['x'] }, skillOverrides: { 'acme:a': 'off' } }),
    ).toEqual(['pluginSkill'])
  })

  it('is silent when enabledPlugins is no object', () => {
    for (const enabledPlugins of [null, ['acme@m'], 'acme@m']) {
      const code = { enabledPlugins, skillOverrides: { 'acme:a': 'off' } }
      expect(ids(code), JSON.stringify(enabledPlugins)).toEqual([])
    }
    expect(ids({ enabledPlugins: { acme: true }, skillOverrides: { 'acme:a': 'off' } })).toEqual([
      'pluginSkill',
    ])
  })

  it('reads the last of two enabledPlugins keys of one name', () => {
    const text = (first: string, second: string) =>
      `{"enabledPlugins": {"acme@m": ${first}, "acme@m": ${second}}, "skillOverrides": {"acme:a": "off"}}`
    expect(ids(text('true', 'false'))).toEqual([])
    expect(ids(text('false', 'true'))).toEqual(['pluginSkill'])
  })

  it('is silent for a skill name, and for a key of the synced claude.ai namespace', () => {
    expect(ids(overrides({ deploy: 'off', 'legacy-context': 'name-only' }))).toEqual([])
    expect(ids(overrides({ 'anthropic-skills:pdf': 'off' }))).toEqual([])
  })
})

describe(`${name}: a bundled alias key`, () => {
  const ALIASES: [string, string][] = [
    ['review', 'code-review'],
    ['checkup', 'doctor'],
    ['proactive', 'loop'],
  ]

  it('reports each alias in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      for (const [alias] of ALIASES) {
        expect(ids(overrides({ [alias]: 'off' }), file), `${file} ${alias}`).toEqual([
          'bundledAlias',
        ])
      }
    }
  })

  it('names the alias and the skill, and reports on the key', () => {
    const text = '{\n  "skillOverrides": {\n    "checkup": "off"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['bundledAlias', 3, 5])
    expect(message?.message).toContain('"checkup"')
    expect(message?.message).toContain('"doctor"')
  })

  it('is silent in a managed file and a drop-in, where an alias key applies', () => {
    for (const file of MANAGED_FILES) {
      for (const [alias] of ALIASES) {
        expect(ids(overrides({ [alias]: 'off' }), file), `${file} ${alias}`).toEqual([])
      }
    }
  })

  it('is silent for the name of the bundled skill, which every file honors', () => {
    for (const file of EVERY_FILE) {
      for (const [, skill] of ALIASES) {
        expect(ids(overrides({ [skill]: 'off' }), file), `${file} ${skill}`).toEqual([])
      }
    }
  })

  it('is silent for a name that is no alias, and for a wrong letter case', () => {
    expect(
      ids(overrides({ ultrareview: 'off', Review: 'off', cost: 'off', constructor: 'off' })),
    ).toEqual([])
  })
})

describe(`${name}: values and structure`, () => {
  it('is silent for a null entry: a null removes the key', () => {
    expect(
      ids({ ...overrides({ review: null, 'a:b': null }), enabledPlugins: { 'a@m': true } }),
    ).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"skillOverrides": {"review": null, "review": "off"}}')).toEqual(['bundledAlias'])
    expect(ids('{"skillOverrides": {"review": "off", "review": null}}')).toEqual([])
    const on = '"enabledPlugins": {"a@m": true}'
    expect(ids(`{${on}, "skillOverrides": {"a:b": "off"}, "skillOverrides": {}}`)).toEqual([])
    expect(ids(`{${on}, "skillOverrides": {}, "skillOverrides": {"a:b": "off"}}`)).toEqual([
      'pluginSkill',
    ])
  })

  it('is silent when skillOverrides is unset, null, or not an object', () => {
    expect(ids({})).toEqual([])
    expect(ids({ skillOverrides: null })).toEqual([])
    expect(ids({ skillOverrides: [] })).toEqual([])
    expect(ids({ skillOverrides: 'a:b' })).toEqual([])
    expect(ids({ skillOverrides: {} })).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(
      ids(
        { ...overrides({ 'a:b': 'off', review: 'off' }), enabledPlugins: { 'a@m': true } },
        HIDDEN,
      ),
    ).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })
})

// Claude Code matches an entry in a project or local file against skill names only
// (skills page). A skill or a command of the repository with the alias as its name takes the entry.
describe(`${name}: a bundled alias key beside a skill of that name, on disk`, () => {
  const CODE = JSON.stringify({ skillOverrides: { review: 'off' } })
  /** The message ids for `CODE` at `.claude/settings.json` of the repository `root`. */
  const at = (root: string, file = '.claude/settings.json') =>
    lintJson(name, CODE, path.join(root, file)).map((message) => message.messageId)

  it('reports the alias when the repository holds no skill of that name', () => {
    const root = repo({ '.claude/skills/other/SKILL.md': 'x', '.claude/commands/other.md': 'x' })
    expect(at(root)).toEqual(['bundledAlias'])
    expect(at(root, '.claude/settings.local.json')).toEqual(['bundledAlias'])
  })

  it('is silent when a skill directory has the name of the alias', () => {
    expect(at(repo({ '.claude/skills/review/SKILL.md': 'x' }))).toEqual([])
  })

  it('is silent when a command file or a command directory has the name of the alias', () => {
    expect(at(repo({ '.claude/commands/review.md': 'x' }))).toEqual([])
    expect(at(repo({ '.claude/commands/review/sub.md': 'x' }))).toEqual([])
  })

  it('is silent when the skill is a dangling link, which the rule cannot see', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    mkdirSync(path.join(root, '.claude/skills'), { recursive: true })
    symlinkSync(path.join(root, 'gone'), path.join(root, '.claude/skills/review'))
    expect(at(root)).toEqual([])
  })

  it('is silent when the skills folder is a dangling link or a link loop', {
    skip: process.platform === 'win32',
  }, () => {
    const dangling = repo({})
    mkdirSync(path.join(dangling, '.claude'), { recursive: true })
    symlinkSync(path.join(dangling, 'gone'), path.join(dangling, '.claude/skills'))
    expect(at(dangling)).toEqual([])
    const loop = repo({})
    mkdirSync(path.join(loop, '.claude'), { recursive: true })
    symlinkSync(path.join(loop, '.claude/skills'), path.join(loop, '.claude/skills'))
    expect(at(loop)).toEqual([])
  })

  it('is silent when the skills folder cannot be read', {
    skip: process.platform === 'win32' || process.getuid?.() === 0,
  }, () => {
    const root = repo({ '.claude/skills/review/SKILL.md': 'x' })
    const folder = path.join(root, '.claude/skills')
    chmodSync(folder, 0o000)
    try {
      expect(at(root)).toEqual([])
    } finally {
      chmodSync(folder, 0o755)
    }
  })

  it('looks for the skill of the alias that the file names, and for no other', () => {
    const root = repo({ '.claude/skills/checkup/SKILL.md': 'x' })
    expect(at(root)).toEqual(['bundledAlias'])
  })
})
