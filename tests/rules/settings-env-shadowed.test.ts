// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#bashoutputmaxchars and "How env values
// interact with your shell"), the model configuration page
// (https://code.claude.com/docs/en/model-config#set-a-default-model-for-new-sessions) and the
// subagents page (https://code.claude.com/docs/en/sub-agents#choose-a-model). The rule reads the
// linted file only. An agent `model` under `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is for
// `agent-model-forced`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-env-shadowed'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const env = (map: Record<string, unknown>) => ({ env: map })

describe(`${name}: BASH_MAX_OUTPUT_LENGTH and bashOutputMaxChars`, () => {
  it('reports the variable when bashOutputMaxChars is set, in every file', () => {
    for (const file of EVERY_FILE) {
      const code = { bashOutputMaxChars: 100000, ...env({ BASH_MAX_OUTPUT_LENGTH: '50000' }) }
      expect(ids(code, file), file).toEqual(['bashLength'])
    }
  })

  it('reports on the variable name', () => {
    const text =
      '{\n  "bashOutputMaxChars": 5000,\n  "env": {\n    "BASH_MAX_OUTPUT_LENGTH": "1"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['bashLength', 4, 5])
  })

  it('is silent when bashOutputMaxChars is no number: settings-schema reports the type', () => {
    for (const value of ['5000', false, [1]]) {
      const code = { bashOutputMaxChars: value, ...env({ BASH_MAX_OUTPUT_LENGTH: '50000' }) }
      expect(ids(code), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent when bashOutputMaxChars is unset or null, or the variable is not set', () => {
    expect(ids(env({ BASH_MAX_OUTPUT_LENGTH: '50000' }))).toEqual([])
    expect(ids({ bashOutputMaxChars: null, ...env({ BASH_MAX_OUTPUT_LENGTH: '50000' }) })).toEqual(
      [],
    )
    expect(ids({ bashOutputMaxChars: 100000 })).toEqual([])
    expect(ids({ bashOutputMaxChars: 100000, ...env({ BASH_MAX_OUTPUT_LENGTH: null }) })).toEqual(
      [],
    )
    expect(ids({ bashOutputMaxChars: 100000, ...env({ BASH_MAX_OUTPUT_LENGTH: '' }) })).toEqual([])
    expect(ids({ bashOutputMaxChars: 100000, ...env({ BASH_MAX_OUTPUT_LENGTH: 5 }) })).toEqual([])
  })
})

describe(`${name}: ANTHROPIC_DEFAULT_MODEL`, () => {
  it('reports the variable when the file sets model, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(
        ids({ model: 'opus', ...env({ ANTHROPIC_DEFAULT_MODEL: 'sonnet' }) }, file),
        file,
      ).toEqual(['defaultModelSet'])
    }
  })

  it('reports on the variable name', () => {
    const text =
      '{\n  "model": "opus",\n  "env": {\n    "ANTHROPIC_DEFAULT_MODEL": "sonnet"\n  }\n}'
    const [message] = lint(text)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['defaultModelSet', 4, 5])
  })

  it('reports a value that Claude Code ignores, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const value of ['default', 'inherit', 'opusplan', 'haiku']) {
        expect(ids(env({ ANTHROPIC_DEFAULT_MODEL: value }), file), `${file} ${value}`).toEqual([
          'defaultModelValue',
        ])
      }
    }
  })

  it('reports on the value, and names it', () => {
    const text = '{"env": {"ANTHROPIC_DEFAULT_MODEL": "haiku"}}'
    const [message] = lint(text)
    expect([message?.messageId, message?.column]).toEqual(['defaultModelValue', 37])
    expect(message?.message).toContain('"haiku"')
  })

  it('reports one fault once: an ignored value beside a model', () => {
    expect(ids({ model: 'opus', ...env({ ANTHROPIC_DEFAULT_MODEL: 'default' }) })).toEqual([
      'defaultModelValue',
    ])
  })

  it('is silent for a model value of the variable and no model in the file', () => {
    for (const value of ['sonnet', 'opus', 'claude-sonnet-4-5', 'HAIKU', 'best']) {
      expect(ids(env({ ANTHROPIC_DEFAULT_MODEL: value })), value).toEqual([])
    }
  })

  it('is silent when model is default or empty: it selects no model', () => {
    expect(ids({ model: 'default', ...env({ ANTHROPIC_DEFAULT_MODEL: 'sonnet' }) })).toEqual([])
    expect(ids({ model: '', ...env({ ANTHROPIC_DEFAULT_MODEL: 'sonnet' }) })).toEqual([])
  })

  it('is silent when model is unset or null, or the variable is empty, null or a number', () => {
    expect(ids({ model: null, ...env({ ANTHROPIC_DEFAULT_MODEL: 'sonnet' }) })).toEqual([])
    expect(ids({ model: 'opus', ...env({ ANTHROPIC_DEFAULT_MODEL: '' }) })).toEqual([])
    expect(ids({ model: 'opus', ...env({ ANTHROPIC_DEFAULT_MODEL: null }) })).toEqual([])
    expect(ids({ model: 'opus', ...env({ ANTHROPIC_DEFAULT_MODEL: 3 }) })).toEqual([])
    expect(ids({ model: 'opus' })).toEqual([])
    expect(ids({ model: 3, ...env({ ANTHROPIC_DEFAULT_MODEL: 'sonnet' }) })).toEqual([])
  })
})

describe(`${name}: CLAUDE_CODE_SUBAGENT_MODEL`, () => {
  it('reports inherit, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(env({ CLAUDE_CODE_SUBAGENT_MODEL: 'inherit' }), file), file).toEqual([
        'subagentInherit',
      ])
    }
  })

  it('reports on the value', () => {
    const [message] = lint('{"env": {"CLAUDE_CODE_SUBAGENT_MODEL": "inherit"}}')
    expect([message?.messageId, message?.column]).toEqual(['subagentInherit', 40])
  })

  it('is silent for another value, an empty value and a value of another type', () => {
    for (const value of ['haiku', 'claude-haiku-4-5', 'Inherit', '', null, 3]) {
      expect(ids(env({ CLAUDE_CODE_SUBAGENT_MODEL: value })), String(value)).toEqual([])
    }
  })

  it('is silent for inherit in a variable that the docs give no such meaning', () => {
    expect(ids(env({ ANTHROPIC_MODEL: 'inherit' }))).toEqual([])
  })
})

describe(`${name}: NO_COLOR and FORCE_COLOR`, () => {
  it('reports each variable, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const key of ['NO_COLOR', 'FORCE_COLOR']) {
        expect(ids(env({ [key]: '1' }), file), `${file} ${key}`).toEqual(['shellOnly'])
      }
    }
  })

  it('reports on the variable name, and names it', () => {
    const [message] = lint('{\n  "env": {\n    "NO_COLOR": "1"\n  }\n}')
    expect([message?.messageId, message?.line, message?.column]).toEqual(['shellOnly', 3, 5])
    expect(message?.message).toContain('"NO_COLOR"')
  })

  it('reports for any value that is set', () => {
    expect(ids(env({ NO_COLOR: '0', FORCE_COLOR: '0' }))).toEqual(['shellOnly', 'shellOnly'])
  })

  it('is silent for an empty value: it cancels a value of the shell for subprocesses', () => {
    expect(ids(env({ NO_COLOR: '', FORCE_COLOR: '' }))).toEqual([])
  })

  it('is silent for a null value, and for another color variable', () => {
    expect(ids(env({ NO_COLOR: null }))).toEqual([])
    expect(ids(env({ COLORTERM: 'truecolor', CLICOLOR: '1', TERM: 'xterm' }))).toEqual([])
  })
})

describe(`${name}: structure`, () => {
  it('reads the last of two keys of one name, in env too', () => {
    expect(
      ids('{"model": "opus", "model": null, "env": {"ANTHROPIC_DEFAULT_MODEL": "sonnet"}}'),
    ).toEqual([])
    expect(ids('{"env": {"NO_COLOR": "1", "NO_COLOR": null}}')).toEqual([])
    expect(ids('{"env": {"NO_COLOR": null, "NO_COLOR": "1"}}')).toEqual(['shellOnly'])
    expect(ids('{"env": {"NO_COLOR": "1"}, "env": {}}')).toEqual([])
  })

  it('is silent for an env that is null or no object, and for a document that is no object', () => {
    expect(ids({ env: null })).toEqual([])
    expect(ids({ env: ['NO_COLOR'] })).toEqual([])
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(env({ NO_COLOR: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'inherit' }), HIDDEN)).toEqual([])
  })

  it('is silent for an agent model: agent-model-forced owns it', () => {
    const code = env({ CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' })
    expect(ids({ model: 'opus', ...code })).toEqual([])
    expect(ids({ agent: 'x', ...code })).toEqual([])
  })
})
