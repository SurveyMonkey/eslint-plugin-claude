// The expected values come from the settings reference (https://code.claude.com/docs/en/settings-reference#skilloverrides),
// the skills page (https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings)
// and the commands reference (https://code.claude.com/docs/en/commands), which marks each bundled
// skill and names its alias: `/review` for `/code-review`, `/checkup` for `/doctor` and
// `/proactive` for `/loop`.
import { describe, expect, it } from 'vitest'
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
  it('reports a plugin:skill key, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(overrides({ 'formatter:lint': 'off' }), file), file).toEqual(['pluginSkill'])
    }
  })

  it('reports on the key, and names it', () => {
    const text = '{\n  "skillOverrides": {\n    "deploy": "off",\n    "acme:deploy": "off"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['pluginSkill', 4, 5])
    expect(message?.message).toContain('"acme:deploy"')
    expect(message?.message).toContain('/plugin')
  })

  it('reports each plugin key once', () => {
    expect(ids(overrides({ 'a:b': 'off', 'c:d': 'name-only', deploy: 'on' }))).toEqual([
      'pluginSkill',
      'pluginSkill',
    ])
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
    expect(ids(overrides({ review: null, 'a:b': null }))).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"skillOverrides": {"review": null, "review": "off"}}')).toEqual(['bundledAlias'])
    expect(ids('{"skillOverrides": {"review": "off", "review": null}}')).toEqual([])
    expect(ids('{"skillOverrides": {"a:b": "off"}, "skillOverrides": {}}')).toEqual([])
    expect(ids('{"skillOverrides": {}, "skillOverrides": {"a:b": "off"}}')).toEqual(['pluginSkill'])
  })

  it('is silent when skillOverrides is unset, null, or not an object', () => {
    expect(ids({})).toEqual([])
    expect(ids({ skillOverrides: null })).toEqual([])
    expect(ids({ skillOverrides: [] })).toEqual([])
    expect(ids({ skillOverrides: 'a:b' })).toEqual([])
    expect(ids({ skillOverrides: {} })).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(overrides({ 'a:b': 'off', review: 'off' }), HIDDEN)).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })
})
