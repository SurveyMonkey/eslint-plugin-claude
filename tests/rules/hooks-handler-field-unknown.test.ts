// A handler field that the docs do not list for the type of the handler. The lists are in the hooks
// reference, "Hook handler fields" (https://code.claude.com/docs/en/hooks#hook-handler-fields).
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-handler-field-unknown'
const ids = (handler: object, file = FILES.project, event = 'Stop') =>
  jsonIds(name, settings(hooks(event, [handler])), file)
const http = (fields: object = {}) => ({ type: 'http', url: 'http://x.test', ...fields })
const mcp = (fields: object = {}) => ({ type: 'mcp_tool', server: 's', tool: 't', ...fields })
const prompt = (fields: object = {}) => ({ type: 'prompt', prompt: 'Is it safe?', ...fields })
const agent = (fields: object = {}) => ({ type: 'agent', prompt: 'Is it safe?', ...fields })

describe(`${name}: an unknown field`, () => {
  it('reports a field that no type lists, on each handler type', () => {
    for (const handler of [command, http, mcp, prompt, agent]) {
      expect(ids(handler({ bogus: 1 })), String(handler)).toEqual(['unknown'])
    }
  })

  it('reports a near miss of a field name', () => {
    expect(ids(command({ timeOut: 5 }))).toEqual(['unknown'])
    expect(ids(command({ args_: [] }))).toEqual(['unknown'])
    expect(ids(http({ header: {} }))).toEqual(['unknown'])
  })

  it('reports a field that another type lists', () => {
    expect(ids(command({ url: 'u' }))).toEqual(['unknown'])
    expect(ids(http({ command: 'c' }))).toEqual(['unknown'])
    expect(ids(http({ shell: 'bash' }))).toEqual(['unknown'])
    expect(ids(mcp({ prompt: 'p' }))).toEqual(['unknown'])
    expect(ids(prompt({ command: 'c' }))).toEqual(['unknown'])
    expect(ids(agent({ input: {} }))).toEqual(['unknown'])
  })

  it('reports each unknown field of a handler, and one for a duplicate key', () => {
    expect(ids(command({ a: 1, b: 2 }))).toEqual(['unknown', 'unknown'])
    const text = '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"c","x":1,"x":2}]}]}}'
    expect(jsonIds(name, text, FILES.project)).toEqual(['unknown'])
  })

  it('names the field, the type and the fields of the type', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [http({ method: 'POST' })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      'The "method" field is not documented for the "http" hook type. The fields are "type", "if", "timeout", "statusMessage", "once", "url", "headers", "allowedEnvVars" and "onFailure".',
    )
  })

  it('reports at the key of the field', () => {
    const text =
      '{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "c", "bogus": 1}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 61]])
  })
})

describe(`${name}: a known field`, () => {
  it('is silent for each documented field of each type', () => {
    const common = { if: 'Bash(git *)', timeout: 5, statusMessage: 's', once: true }
    expect(
      ids(command({ ...common, args: [], async: true, asyncRewake: true, shell: 'bash' })),
    ).toEqual([])
    expect(ids(http({ ...common, headers: {}, allowedEnvVars: [] }))).toEqual([])
    expect(ids(mcp({ ...common, input: {} }))).toEqual([])
    expect(ids(prompt({ ...common, model: 'm', continueOnBlock: true }))).toEqual([])
    expect(ids(agent({ ...common, model: 'm' }))).toEqual([])
  })

  it('is silent for onFailure on a command and an http hook', () => {
    expect(ids(command({ onFailure: 'block' }))).toEqual([])
    expect(ids(http({ onFailure: 'continue' }))).toEqual([])
  })
})

describe(`${name}: what the other rules own`, () => {
  it('leaves a misplaced async, asyncRewake, continueOnBlock and onFailure to hooks-handler-field-ignored', () => {
    expect(ids(http({ async: true, asyncRewake: true }))).toEqual([])
    expect(ids(command({ continueOnBlock: true }))).toEqual([])
    expect(ids(mcp({ onFailure: 'block' }))).toEqual([])
    expect(ids(agent({ continueOnBlock: true, onFailure: 'block' }))).toEqual([])
    const text = settings(hooks('Stop', [http({ async: true, bogus: 1 })]))
    expect(jsonIds('hooks-handler-field-ignored', text, FILES.project)).toEqual(['asyncType'])
    expect(jsonIds(name, text, FILES.project)).toEqual(['unknown'])
  })

  it('does not report the same fault as hooks-config-schema', () => {
    const text = settings(hooks('Stop', [command({ bogus: 1 })]))
    expect(jsonIds('hooks-config-schema', text, FILES.project)).toEqual([])
    expect(jsonIds(name, text, FILES.project)).toEqual(['unknown'])
  })

  it('skips a handler with no type, an unknown type or a type that is no string', () => {
    expect(ids({ command: 'c', bogus: 1 })).toEqual([])
    expect(ids({ type: 'script', bogus: 1 })).toEqual([])
    expect(ids({ type: 7, bogus: 1 })).toEqual([])
  })

  it('skips a handler that is no object', () => {
    expect(jsonIds(name, settings({ Stop: [{ hooks: ['x', 7] }] }), FILES.project)).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ bogus: 1 }), file), file).toEqual(['unknown'])
      expect(ids(command(), file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (extra: string) =>
      frontmatter(`Stop:\n  - hooks:\n      - type: command\n        command: c\n${extra}`)
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('        bogus: 1\n'), file), file).toEqual(['unknown'])
      expect(markdownIds(name, yaml(''), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids(command({ bogus: 1 }), FILES.hidden)).toEqual([])
    expect(ids(command({ bogus: 1 }), '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
