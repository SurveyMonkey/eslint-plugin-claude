// A model value is an alias or a `claude-` ID. The expected values come from the model
// configuration page (https://code.claude.com/docs/en/model-config#model-aliases), the entry for
// `advisorModel` in the settings reference, and the errors page
// (https://code.claude.com/docs/en/errors#model-is-not-a-recognized-model-id).
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'settings-model-value'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

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

const ALIASES = [
  'default',
  'best',
  'fable',
  'sonnet',
  'opus',
  'haiku',
  'sonnet[1m]',
  'opus[1m]',
  'opusplan',
  'opusplan[1m]',
]
const IDS = [
  'claude-opus-5-5',
  'claude-sonnet-4-5-20250929',
  'claude-fable-5-1',
  'claude-opus-4-6[1m]',
  'claude-sonnet-4-5',
]
const BAD = [
  'gpt-5',
  'Opus',
  'sonet',
  'claude-',
  'opus[2m]',
  'arn',
  'anthropic',
  'xclaude-opus',
  '',
]
// The forms that the model configuration page names as valid: a Bedrock ARN, a Mantle ID that
// starts with `anthropic.`, and an ID that embeds a `claude-` name.
const PROVIDER = [
  'arn:aws:bedrock:us-east-1:123456789012:inference-profile/x',
  'anthropic.claude-opus-4-8',
  'us.anthropic.claude-opus-4-8',
  'anthropic/claude-opus-4-8',
  'my-gateway/claude-opus-5-5',
  'claude-sonnet-4-5@20250929',
]

describe(`${name}: model, fallbackModel and availableModels`, () => {
  it('is silent for each alias and each claude- ID, in every key and file', () => {
    for (const file of EVERY_FILE) {
      for (const value of [...ALIASES, ...IDS]) {
        expect(ids({ model: value }, file), `${file} model ${value}`).toEqual([])
        expect(ids({ fallbackModel: [value] }, file), `${file} fallbackModel ${value}`).toEqual([])
        expect(ids({ availableModels: [value] }, file), `${file} availableModels ${value}`).toEqual(
          [],
        )
      }
    }
  })

  it('reports a value that is no alias and no claude- ID, in every key and file', () => {
    for (const file of EVERY_FILE) {
      for (const value of BAD) {
        expect(ids({ model: value }, file), `${file} model ${value}`).toEqual(['notModel'])
        expect(
          ids({ fallbackModel: ['sonnet', value] }, file),
          `${file} fallback ${value}`,
        ).toEqual(['notModel'])
        expect(
          ids({ availableModels: [value, 'opus'] }, file),
          `${file} available ${value}`,
        ).toEqual(['notModel'])
      }
    }
  })

  it('is silent for a provider form, in every key and file', () => {
    for (const file of EVERY_FILE) {
      for (const value of PROVIDER) {
        expect(ids({ model: value }, file), `${file} model ${value}`).toEqual([])
        expect(ids({ fallbackModel: [value] }, file), `${file} fallback ${value}`).toEqual([])
        expect(ids({ availableModels: [value, 'opus'] }, file), `${file} list ${value}`).toEqual([])
        expect(ids({ advisorModel: value }, file), `${file} advisor ${value}`).toEqual([])
        expect(ids({ env: { ANTHROPIC_MODEL: value } }, file), `${file} env ${value}`).toEqual([])
      }
    }
  })

  it('reports each bad entry of a list, on the entry', () => {
    const text = '{\n  "fallbackModel": [\n    "sonnet",\n    "gpt-5",\n    "x"\n  ]\n}'
    expect(lint(text).map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['notModel', 4, 5],
      ['notModel', 5, 5],
    ])
  })

  it('names the key and the value in the message', () => {
    const [message] = lint({ availableModels: ['gpt-5'] })
    expect(message?.message).toContain('"availableModels"')
    expect(message?.message).toContain('"gpt-5"')
    expect(message?.message).toContain('"claude-"')
  })

  it('is silent for a null value, an unset key, and a value of another type', () => {
    expect(ids({ model: null })).toEqual([])
    expect(ids({ fallbackModel: null })).toEqual([])
    expect(ids({ availableModels: null })).toEqual([])
    expect(ids({})).toEqual([])
    expect(ids({ model: 3 })).toEqual([])
    expect(ids({ model: ['x'] })).toEqual([])
    expect(ids({ fallbackModel: 'x' })).toEqual([])
    expect(ids({ fallbackModel: [1, null, ['x']] })).toEqual([])
    expect(ids({ availableModels: { a: 'x' } })).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(ids('{"model": "x", "model": "opus"}')).toEqual([])
    expect(ids('{"model": "opus", "model": "x"}')).toEqual(['notModel'])
    expect(ids('{"model": "x", "model": null}')).toEqual([])
  })
})

describe(`${name}: env.ANTHROPIC_MODEL and env.CLAUDE_CODE_SUBAGENT_MODEL`, () => {
  it('is silent for an alias or a claude- ID', () => {
    for (const key of ['ANTHROPIC_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']) {
      for (const value of [...ALIASES, ...IDS]) {
        expect(ids({ env: { [key]: value } }), `${key} ${value}`).toEqual([])
      }
    }
  })

  it('reports a value that is no alias and no claude- ID, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const key of ['ANTHROPIC_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']) {
        expect(ids({ env: { [key]: 'gpt-5' } }, file), `${file} ${key}`).toEqual(['notModel'])
      }
    }
  })

  it('names env.KEY in the message and reports on the value', () => {
    const text = '{\n  "env": {\n    "ANTHROPIC_MODEL": "gpt-5"\n  }\n}'
    const [message] = lint(text)
    expect(message?.message).toContain('"env.ANTHROPIC_MODEL"')
    expect([message?.line, message?.column]).toEqual([3, 24])
  })

  it('is silent for the empty string, which cancels a shell value', () => {
    expect(ids({ env: { ANTHROPIC_MODEL: '', CLAUDE_CODE_SUBAGENT_MODEL: '' } })).toEqual([])
  })

  it('is silent for inherit in CLAUDE_CODE_SUBAGENT_MODEL: settings-env-shadowed owns it', () => {
    expect(ids({ env: { CLAUDE_CODE_SUBAGENT_MODEL: 'inherit' } })).toEqual([])
    expect(ids({ env: { ANTHROPIC_MODEL: 'inherit' } })).toEqual(['notModel'])
  })

  it('is silent for ANTHROPIC_DEFAULT_MODEL: the row of settings-env-shadowed owns it', () => {
    expect(ids({ env: { ANTHROPIC_DEFAULT_MODEL: 'gpt-5' } })).toEqual([])
  })

  it('is silent for a null env, an env that is no object, and a value of another type', () => {
    expect(ids({ env: null })).toEqual([])
    expect(ids({ env: [] })).toEqual([])
    expect(ids({ env: { ANTHROPIC_MODEL: null, CLAUDE_CODE_SUBAGENT_MODEL: 3 } })).toEqual([])
  })

  it('reads the last of two keys of one name, in env too', () => {
    expect(ids('{"env": {"ANTHROPIC_MODEL": "x", "ANTHROPIC_MODEL": "opus"}}')).toEqual([])
    expect(ids('{"env": {"ANTHROPIC_MODEL": "opus", "ANTHROPIC_MODEL": "x"}}')).toEqual([
      'notModel',
    ])
    expect(ids('{"env": {"ANTHROPIC_MODEL": "x"}, "env": {"ANTHROPIC_MODEL": "opus"}}')).toEqual([])
  })
})

describe(`${name}: the custom model option`, () => {
  const env = { ANTHROPIC_CUSTOM_MODEL_OPTION: 'corp-llm' }

  it('lets the value of the option pass in the same file', () => {
    expect(ids({ model: 'corp-llm', env })).toEqual([])
    expect(ids({ fallbackModel: ['corp-llm'], availableModels: ['corp-llm'], env })).toEqual([])
  })

  it('reports another value, and every value when the option is empty or no string', () => {
    expect(ids({ model: 'other-llm', env })).toEqual(['notModel'])
    expect(ids({ model: '', env: { ANTHROPIC_CUSTOM_MODEL_OPTION: '' } })).toEqual(['notModel'])
    expect(ids({ model: 'corp-llm', env: { ANTHROPIC_CUSTOM_MODEL_OPTION: 5 } })).toEqual([
      'notModel',
    ])
    expect(ids({ model: 'corp-llm' })).toEqual(['notModel'])
  })
})

describe(`${name}: advisorModel`, () => {
  it('is silent for fable, opus, sonnet, or a claude- ID', () => {
    for (const value of ['fable', 'opus', 'sonnet', ...IDS]) {
      expect(ids({ advisorModel: value }), value).toEqual([])
    }
  })

  it('reports each other alias and any value that is no ID, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const value of ['haiku', 'best', 'default', 'opusplan', 'sonnet[1m]', 'gpt-5', '']) {
        expect(ids({ advisorModel: value }, file), `${file} ${value}`).toEqual(['notAdvisor'])
      }
    }
  })

  it('names the key and the value in the message', () => {
    const [message] = lint({ advisorModel: 'haiku' })
    expect(message?.message).toContain('"advisorModel"')
    expect(message?.message).toContain('"haiku"')
    expect(message?.message).toContain('"fable"')
  })

  it('is silent for null and for a value of another type', () => {
    expect(ids({ advisorModel: null })).toEqual([])
    expect(ids({ advisorModel: 3 })).toEqual([])
  })
})

describe(`${name}: the ANTHROPIC_DEFAULT_*_MODEL variables`, () => {
  const VARIABLES = [
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_DEFAULT_FABLE_MODEL',
  ]

  it('reports an alias, in each variable and file', () => {
    for (const file of EVERY_FILE) {
      for (const key of VARIABLES) {
        for (const value of ['opus', 'default', 'sonnet[1m]', 'best']) {
          expect(ids({ env: { [key]: value } }, file), `${file} ${key} ${value}`).toEqual(['alias'])
        }
      }
    }
  })

  it('names the variable and the value, and reports on the value', () => {
    const text = '{"env": {"ANTHROPIC_DEFAULT_OPUS_MODEL": "opus"}}'
    const [message] = lint(text)
    expect(message?.message).toContain('"env.ANTHROPIC_DEFAULT_OPUS_MODEL"')
    expect(message?.message).toContain('"opus"')
    expect(message?.column).toBe(42)
  })

  it('is silent for a full ID, a provider ID, an ARN and the [1m] suffix', () => {
    for (const key of VARIABLES) {
      for (const value of [
        'claude-opus-4-8',
        'claude-opus-4-6[1m]',
        'us.anthropic.claude-opus-4-8',
        'arn:aws:bedrock:us-east-1:123456789012:custom-model/abc',
        'my-deployment',
        'gpt-5',
        '',
      ]) {
        expect(ids({ env: { [key]: value } }), `${key} ${value}`).toEqual([])
      }
    }
  })

  it('is silent for another ANTHROPIC_DEFAULT variable, a null value and a number', () => {
    expect(ids({ env: { ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'opus' } })).toEqual([])
    expect(ids({ env: { ANTHROPIC_SMALL_FAST_MODEL: 'haiku' } })).toEqual([])
    expect(ids({ env: { ANTHROPIC_DEFAULT_OPUS_MODEL: null } })).toEqual([])
    expect(ids({ env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 3 } })).toEqual([])
  })
})

describe(`${name}: the providerIdPatterns option`, () => {
  const options = [{ providerIdPatterns: ['^us\\.anthropic\\.', '^arn:aws:bedrock:'] }]

  it('lets a value that matches a pattern pass, in every key', () => {
    const bedrock = 'us.anthropic.claude-opus-4-8'
    const arn = 'arn:aws:bedrock:us-east-1:123456789012:inference-profile/x'
    expect(
      ids({ model: bedrock, fallbackModel: [arn], availableModels: [bedrock] }, PROJECT, options),
    ).toEqual([])
    expect(
      ids({ env: { ANTHROPIC_MODEL: arn, CLAUDE_CODE_SUBAGENT_MODEL: bedrock } }, PROJECT, options),
    ).toEqual([])
    expect(ids({ advisorModel: bedrock }, MANAGED, options)).toEqual([])
  })

  it('reports a value that no pattern matches', () => {
    expect(ids({ model: 'gpt-5', advisorModel: 'gpt-5' }, PROJECT, options)).toEqual([
      'notModel',
      'notAdvisor',
    ])
  })

  it('does not change what an alias is', () => {
    const all = [{ providerIdPatterns: ['.*'] }]
    expect(ids({ env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus' } }, PROJECT, all)).toEqual(['alias'])
    expect(ids({ advisorModel: 'haiku' }, PROJECT, all)).toEqual([])
  })

  it('takes an empty list as no pattern', () => {
    expect(ids({ model: 'gpt-5' }, PROJECT, [{ providerIdPatterns: [] }])).toEqual(['notModel'])
  })

  it('refuses a pattern that is no regular expression', () => {
    expect(() => lint({ model: 'x' }, PROJECT, [{ providerIdPatterns: ['('] }])).toThrow(
      /providerIdPatterns/,
    )
  })

  it('refuses an empty pattern, which matches every value', () => {
    expect(() => lint({ model: 'x' }, PROJECT, [{ providerIdPatterns: [''] }])).toThrow(
      /should NOT be shorter than 1 characters/,
    )
  })

  it('refuses an option of another shape', () => {
    const rule = 'Key "claude/settings-model-value"'
    expect(() => lint({ model: 'x' }, PROJECT, [{ providerIdPatterns: 'x' }])).toThrow(
      new RegExp(`${rule}[\\s\\S]*should be array`),
    )
    expect(() => lint({ model: 'x' }, PROJECT, [{ other: [] }])).toThrow(
      new RegExp(`${rule}[\\s\\S]*Unexpected property "other"`),
    )
  })
})

describe(`${name}: files`, () => {
  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids({ model: 'gpt-5', advisorModel: 'x' }, HIDDEN)).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })
})
