// Each check is a sentence of the model configuration page or the settings reference:
// https://code.claude.com/docs/en/model-config#fallback-model-chains
// https://code.claude.com/docs/en/model-config#default-model-behavior
// https://code.claude.com/docs/en/model-config#merge-behavior
// https://code.claude.com/docs/en/model-config#override-model-ids-per-version
// https://code.claude.com/docs/en/model-config#add-a-custom-model-option
// https://code.claude.com/docs/en/settings-reference#deniedmodels
// The rule reads the linted file. For a managed file, it also reads the sibling files of the
// managed source, in the tests of the last block.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'

const name = 'settings-model-list'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]

/** The messages of the rule for `code` at `file`, with the rule options `options`. */
function lint(code: unknown, file = PROJECT, options: unknown[] = []) {
  const text = typeof code === 'string' ? code : JSON.stringify(code)
  const absolute = path.resolve(file)
  return new Linter({ cwd: path.parse(absolute).root }).verify(
    text,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename: absolute },
  )
}
const ids = (code: unknown, file = PROJECT, options: unknown[] = []) =>
  lint(code, file, options).map((message) => message.messageId)

describe(`${name}: fallbackModel`, () => {
  it('reports the fourth distinct entry, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = { fallbackModel: ['opus', 'sonnet', 'haiku', 'fable', 'best'] }
      expect(ids(code, file), file).toEqual(['tooMany'])
    }
  })

  it('reports on the first entry that the chain ignores', () => {
    const text = '{\n  "fallbackModel": [\n    "a",\n    "b",\n    "c",\n    "d",\n    "e"\n  ]\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['tooMany', 6, 5])
    expect(message?.message).toContain('"d"')
    expect(message?.message).toContain('3')
  })

  it('counts distinct entries: a duplicate is not a fourth model', () => {
    expect(ids({ fallbackModel: ['a', 'b', 'a', 'c', 'b', 'c'] })).toEqual([])
    expect(ids({ fallbackModel: ['a', 'b', 'a', 'c', 'd'] })).toEqual(['tooMany'])
  })

  it('is silent for three entries or fewer, and for a value that is no list', () => {
    expect(ids({ fallbackModel: ['a', 'b', 'c'] })).toEqual([])
    expect(ids({ fallbackModel: [] })).toEqual([])
    expect(ids({ fallbackModel: null })).toEqual([])
    expect(ids({ fallbackModel: 'a,b,c,d' })).toEqual([])
  })

  it('skips an entry that is no string when it counts', () => {
    expect(ids({ fallbackModel: ['a', 1, null, 'b', ['c'], 'c'] })).toEqual([])
    expect(ids({ fallbackModel: ['a', 1, 'b', null, 'c', 'd'] })).toEqual(['tooMany'])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"fallbackModel": ["a","b","c","d"], "fallbackModel": ["a"]}')).toEqual([])
    expect(ids('{"fallbackModel": ["a"], "fallbackModel": ["a","b","c","d"]}')).toEqual(['tooMany'])
  })

  it('takes the limit from the option max, and names it as configured', () => {
    expect(ids({ fallbackModel: ['a', 'b', 'c'] }, PROJECT, [{ max: 2 }])).toEqual([
      'overConfiguredLimit',
    ])
    expect(ids({ fallbackModel: ['a', 'b'] }, PROJECT, [{ max: 2 }])).toEqual([])
    const [message] = lint({ fallbackModel: ['a', 'b', 'c'] }, PROJECT, [{ max: 2 }])
    expect(message?.message).toContain('configured limit')
    expect(message?.message).toContain('2')
    expect(message?.message).not.toContain('Claude Code')
  })

  it('keeps the docs message at the default value of max', () => {
    expect(ids({ fallbackModel: ['a', 'b', 'c', 'd'] }, PROJECT, [{ max: 3 }])).toEqual(['tooMany'])
  })

  it('refuses a max above 3 or below 1, or of another type', () => {
    for (const max of [4, 0, 1.5, '3']) {
      expect(() => lint({}, PROJECT, [{ max }]), String(max)).toThrow(
        /Key "claude\/settings-model-list"/,
      )
    }
    expect(() => lint({}, PROJECT, [{ other: 1 }])).toThrow(/Unexpected property "other"/)
  })
})

describe(`${name}: availableModels: []`, () => {
  it('reports the empty list when the file names a model, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ availableModels: [], model: 'opus' }, file), file).toEqual(['emptyList'])
      expect(ids({ availableModels: [], fallbackModel: ['sonnet'] }, file), file).toEqual([
        'emptyList',
      ])
      expect(ids({ availableModels: [], advisorModel: 'opus' }, file), file).toEqual(['emptyList'])
    }
  })

  it('names each key that the empty list blocks, and reports on the list', () => {
    const text = '{\n  "model": "opus",\n  "advisorModel": "sonnet",\n  "availableModels": []\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['emptyList', 4, 22])
    expect(message?.message).toContain('"model", "advisorModel"')
  })

  it('is silent for an empty list alone: a lock-down can be the intent', () => {
    expect(ids({ availableModels: [] })).toEqual([])
    expect(ids({ availableModels: [], model: 'default' })).toEqual([])
    expect(ids({ availableModels: [], model: null })).toEqual([])
    expect(ids({ availableModels: [], fallbackModel: ['default'] })).toEqual([])
    expect(ids({ availableModels: [], fallbackModel: [] })).toEqual([])
    expect(ids({ availableModels: [], fallbackModel: [1] })).toEqual([])
    expect(ids({ availableModels: [], model: 3 })).toEqual([])
  })

  it('is silent for a list with entries, or an unset or null list', () => {
    expect(ids({ availableModels: ['opus'], model: 'opus' })).toEqual([])
    expect(ids({ model: 'opus' })).toEqual([])
    expect(ids({ availableModels: null, model: 'opus' })).toEqual([])
    expect(ids({ availableModels: 'x', model: 'opus' })).toEqual([])
  })
})

describe(`${name}: enforceAvailableModels`, () => {
  it('reports enforceAvailableModels true with no list, in a managed file', () => {
    for (const file of MANAGED_FILES) {
      expect(ids({ enforceAvailableModels: true }, file), file).toEqual(['enforceNeedsList'])
      expect(ids({ enforceAvailableModels: true, availableModels: [] }, file), file).toEqual([
        'enforceNeedsList',
      ])
      expect(ids({ enforceAvailableModels: true, availableModels: null }, file), file).toEqual([
        'enforceNeedsList',
      ])
    }
  })

  it('reports on the key enforceAvailableModels', () => {
    const text = '{\n  "enforceAvailableModels": true\n}'
    expect(lint(text, MANAGED).map(({ line, column }) => [line, column])).toEqual([[2, 3]])
  })

  it('is silent with a non-empty list, with false or null, and in a project file', () => {
    expect(ids({ enforceAvailableModels: true, availableModels: ['sonnet'] }, MANAGED)).toEqual([])
    expect(ids({ enforceAvailableModels: false }, MANAGED)).toEqual([])
    expect(ids({ enforceAvailableModels: null }, MANAGED)).toEqual([])
    expect(ids({ availableModels: [] }, MANAGED)).toEqual([])
    for (const file of PROJECT_FILES) {
      expect(ids({ enforceAvailableModels: true }, file), file).toEqual([])
    }
  })
})

describe(`${name}: a family alias with a same-family ID`, () => {
  it('reports the alias that a specific entry narrows, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids({ availableModels: ['sonnet', 'claude-sonnet-4-5'] }, file), file).toEqual([
        'narrowed',
      ])
      expect(ids({ availableModels: ['claude-opus-5-5', 'opus'] }, file), file).toEqual([
        'narrowed',
      ])
    }
  })

  it('reports on the alias entry, and names both entries', () => {
    const text = '{\n  "availableModels": [\n    "claude-sonnet-4-5",\n    "sonnet"\n  ]\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['narrowed', 4, 5])
    expect(message?.message).toContain('"sonnet"')
    expect(message?.message).toContain('"claude-sonnet-4-5"')
  })

  it('narrows with a dated ID, a [1m] ID and a provider ID', () => {
    expect(ids({ availableModels: ['sonnet', 'claude-sonnet-4-5-20250929'] })).toEqual(['narrowed'])
    expect(ids({ availableModels: ['opus', 'claude-opus-4-6[1m]'] })).toEqual(['narrowed'])
    expect(ids({ availableModels: ['opus', 'us.anthropic.claude-opus-4-8'] })).toEqual(['narrowed'])
    expect(ids({ availableModels: ['sonnet[1m]', 'claude-sonnet-4-5'] })).toEqual(['narrowed'])
  })

  it('reports one alias entry once, and each narrowed family', () => {
    expect(
      ids({
        availableModels: [
          'sonnet',
          'claude-sonnet-4-5',
          'claude-sonnet-5',
          'opus',
          'claude-opus-5',
        ],
      }),
    ).toEqual(['narrowed', 'narrowed'])
  })

  it('is silent for IDs of another family, and for entries that are not both present', () => {
    expect(ids({ availableModels: ['sonnet', 'claude-opus-5-5'] })).toEqual([])
    expect(ids({ availableModels: ['sonnet', 'haiku', 'opus'] })).toEqual([])
    expect(ids({ availableModels: ['claude-sonnet-4-5', 'claude-sonnet-5'] })).toEqual([])
    expect(ids({ availableModels: ['sonnet', 'best', 'opusplan', 'default'] })).toEqual([])
    expect(ids({ availableModels: ['sonnet', 'gpt-5', 1, null] })).toEqual([])
    expect(ids({ availableModels: ['sonnet'] })).toEqual([])
    expect(ids({ availableModels: null })).toEqual([])
    expect(ids({ availableModels: 'sonnet' })).toEqual([])
  })
})

describe(`${name}: deniedModels`, () => {
  it('reports best, opusplan and default, in a managed file', () => {
    for (const file of MANAGED_FILES) {
      expect(ids({ deniedModels: ['best', 'opus', 'opusplan', 'default'] }, file), file).toEqual([
        'deniedIgnored',
        'deniedIgnored',
        'deniedIgnored',
      ])
    }
  })

  it('reports on each entry and names it', () => {
    const text = '{\n  "deniedModels": [\n    "opus",\n    "best"\n  ]\n}'
    const [message] = lint(text, MANAGED)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['deniedIgnored', 4, 5])
    expect(message?.message).toContain('"best"')
  })

  it('is silent for an alias, an ID and a value of another type', () => {
    expect(ids({ deniedModels: ['opus', 'claude-opus-5-5', 'Best', 1, null] }, MANAGED)).toEqual([])
    expect(ids({ deniedModels: 'best' }, MANAGED)).toEqual([])
    expect(ids({ deniedModels: null }, MANAGED)).toEqual([])
  })

  it('is silent in a project file: settings-key-scope reports the key there', () => {
    for (const file of PROJECT_FILES) {
      expect(ids({ deniedModels: ['best'] }, file), file).toEqual([])
    }
  })
})

describe(`${name}: modelOverrides`, () => {
  it('reports a key that is no Anthropic model ID, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = {
        modelOverrides: {
          'claude-opus-4-7':
            'arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/a',
          opus: 'x',
          'claude-opus-4-6[1m]': 'y',
          'us.anthropic.claude-opus-4-8': 'z',
          'arn:aws:bedrock:us-east-1:123456789012:inference-profile/x': 'w',
        },
      }
      expect(ids(code, file), file).toEqual([
        'overrideKey',
        'overrideKey',
        'overrideKey',
        'overrideKey',
      ])
    }
  })

  it('reports on the key and names it', () => {
    const text = '{\n  "modelOverrides": {\n    "opus": "x"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['overrideKey', 3, 5])
    expect(message?.message).toContain('"opus"')
  })

  it('is silent for an exact ID, a dated ID and a fable ID', () => {
    const code = {
      modelOverrides: {
        'claude-opus-4-7': 'a',
        'claude-sonnet-4-5-20250929': 'b',
        'claude-fable-5-1': 'c',
      },
    }
    expect(ids(code)).toEqual([])
  })

  it('is silent for an unset or null map, and for a value that is no object', () => {
    expect(ids({ modelOverrides: null })).toEqual([])
    expect(ids({ modelOverrides: [] })).toEqual([])
    expect(ids({ modelOverrides: 'opus' })).toEqual([])
    expect(ids({ modelOverrides: {} })).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"modelOverrides": {"opus": "x"}, "modelOverrides": {}}')).toEqual([])
    expect(ids('{"modelOverrides": {"opus": "x", "opus": "y"}}')).toEqual(['overrideKey'])
  })
})

describe(`${name}: ANTHROPIC_CUSTOM_MODEL_OPTION`, () => {
  const custom = 'my-gateway/claude-opus-5-5'

  it('reports a custom option that availableModels does not list, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = { env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: ['sonnet'] }
      expect(ids(code, file), file).toEqual(['customOption'])
    }
  })

  it('reports on the value, and names it', () => {
    const text =
      '{\n  "env": {\n    "ANTHROPIC_CUSTOM_MODEL_OPTION": "x"\n  },\n  "availableModels": ["sonnet"]\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['customOption', 3, 38])
    expect(message?.message).toContain('"x"')
  })

  it('reports for an empty list, which blocks every named model', () => {
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: [] })).toEqual([
      'customOption',
    ])
  })

  it('is silent when an entry is the option, with or without [1m]', () => {
    for (const list of [[custom], [`${custom}[1m]`], ['sonnet', custom]]) {
      const code = { env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: list }
      expect(ids(code), list.join()).toEqual([])
    }
    const suffixed = {
      env: { ANTHROPIC_CUSTOM_MODEL_OPTION: `${custom}[1m]` },
      availableModels: [custom],
    }
    expect(ids(suffixed)).toEqual([])
  })

  it('is silent when an entry covers the option as a version prefix or a family alias', () => {
    const option = 'claude-opus-5-5'
    expect(
      ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: option }, availableModels: ['claude-opus-5'] }),
    ).toEqual([])
    expect(
      ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: ['opus'] }),
    ).toEqual([])
  })

  it('is silent when availableModels is unset: the list can be in another file', () => {
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom } })).toEqual([])
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: null })).toEqual(
      [],
    )
    expect(
      ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: 'sonnet' }),
    ).toEqual([])
  })

  it('is silent for an unset, empty, null or non-string option, and a bad env', () => {
    const list = { availableModels: ['sonnet'] }
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: '' }, ...list })).toEqual([])
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: null }, ...list })).toEqual([])
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION: 3 }, ...list })).toEqual([])
    expect(ids({ env: { ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: 'x' }, ...list })).toEqual([])
    expect(ids({ env: {}, ...list })).toEqual([])
    expect(ids({ env: [], ...list })).toEqual([])
    expect(ids({ env: null, ...list })).toEqual([])
  })

  it('ignores an entry of availableModels that is no string', () => {
    const code = {
      env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom },
      availableModels: [1, null, custom],
    }
    expect(ids(code)).toEqual([])
    const other = { env: { ANTHROPIC_CUSTOM_MODEL_OPTION: custom }, availableModels: [1, null] }
    expect(ids(other)).toEqual(['customOption'])
  })
})

describe(`${name}: files`, () => {
  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    const code = {
      fallbackModel: ['a', 'b', 'c', 'd'],
      deniedModels: ['best'],
      availableModels: [],
      model: 'x',
    }
    expect(ids(code, HIDDEN)).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })
})

// The managed settings page merges `managed-settings.json` and its drop-ins into one source
// (round 10 mid-round ruling 22). Lists of the files combine.
describe(`${name}: the sibling files of a managed source, on disk`, () => {
  /** The message ids for `code` at `file` of the repository `root`. */
  const at = (root: string, file: string, code: unknown) =>
    lint(code, path.join(root, file)).map((message) => message.messageId)
  const LIST = JSON.stringify({ availableModels: ['opus'] })

  it('is silent for enforceAvailableModels when a sibling holds the list', () => {
    const root = repo({ 'managed-settings.d/10-a.json': LIST })
    expect(at(root, 'managed-settings.d/20-b.json', { enforceAvailableModels: true })).toEqual([])
    const main = repo({ 'managed-settings.json': LIST })
    expect(at(main, 'managed-settings.d/20-b.json', { enforceAvailableModels: true })).toEqual([])
  })

  it('reports enforceAvailableModels when no sibling holds a list', () => {
    const root = repo({
      'managed-settings.d/10-a.json': '{"availableModels": []}',
      'managed-settings.d/11-a.json': '{"availableModels": null}',
      'managed-settings.d/12-a.json': '{"availableModels": "opus"}',
      'managed-settings.d/.13-a.json': LIST,
    })
    expect(at(root, 'managed-settings.d/20-b.json', { enforceAvailableModels: true })).toEqual([
      'enforceNeedsList',
    ])
  })

  it('is silent for an empty availableModels when a sibling adds entries', () => {
    const root = repo({ 'managed-settings.d/10-a.json': LIST })
    const code = { availableModels: [], model: 'opus' }
    expect(at(root, 'managed-settings.d/20-b.json', code)).toEqual([])
    expect(at(repo({}), 'managed-settings.d/20-b.json', code)).toEqual(['emptyList'])
  })

  it('counts the entries of a sibling for the custom model option', () => {
    const code = {
      availableModels: ['sonnet'],
      env: { ANTHROPIC_CUSTOM_MODEL_OPTION: 'claude-opus-5' },
    }
    const root = repo({ 'managed-settings.d/10-a.json': '{"availableModels": ["haiku"]}' })
    expect(at(root, 'managed-settings.d/20-b.json', code)).toEqual(['customOption'])
    const listed = repo({
      'managed-settings.d/10-a.json': '{"availableModels": ["claude-opus-5"]}',
    })
    expect(at(listed, 'managed-settings.d/20-b.json', code)).toEqual([])
  })

  it('is silent for all three when a sibling does not parse to an object', () => {
    const root = repo({ 'managed-settings.d/10-a.json': '[1]' })
    const codes = [
      { enforceAvailableModels: true },
      { availableModels: [], model: 'opus' },
      { availableModels: ['sonnet'], env: { ANTHROPIC_CUSTOM_MODEL_OPTION: 'claude-opus-5' } },
    ]
    for (const code of codes) {
      expect(at(root, 'managed-settings.d/20-b.json', code)).toEqual([])
    }
  })

  it('reads no sibling for a project file', () => {
    const root = repo({ 'managed-settings.d/10-a.json': LIST })
    expect(at(root, '.claude/settings.json', { availableModels: [], model: 'opus' })).toEqual([
      'emptyList',
    ])
  })
})
