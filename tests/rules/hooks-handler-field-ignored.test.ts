// A handler field that Claude Code reads and does not act on. The docs are the hooks reference:
// "Common fields", "Command hook fields", "Configure an async hook", "Response schema" and the
// SessionEnd section (https://code.claude.com/docs/en/hooks).
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
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-handler-field-ignored'
const ids = (event: string, handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler])), file)
const http = (fields: object = {}) => ({ type: 'http', url: 'http://x.test', ...fields })
const prompt = (fields: object = {}) => ({ type: 'prompt', prompt: 'Is it safe?', ...fields })

describe(`${name}: async and asyncRewake`, () => {
  it('reports async and asyncRewake on a handler that is not a command', () => {
    expect(ids('Stop', http({ async: true }))).toEqual(['asyncType'])
    expect(ids('Stop', prompt({ asyncRewake: true }))).toEqual(['asyncType'])
    expect(ids('Stop', { type: 'mcp_tool', server: 's', tool: 't', async: false })).toEqual([
      'asyncType',
    ])
    expect(ids('Stop', { type: 'agent', prompt: 'p', async: true })).toEqual(['asyncType'])
  })

  it('is silent on a command handler', () => {
    expect(ids('PostToolUse', command({ async: true }))).toEqual([])
    expect(ids('PostToolUse', command({ asyncRewake: true }))).toEqual([])
  })

  it('says which field and which type in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [http({ async: true })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      '"async" works on a command hook only. Claude Code ignores it on a "http" hook.',
    )
  })
})

describe(`${name}: continueOnBlock`, () => {
  it('reports continueOnBlock on a handler that is not a prompt', () => {
    expect(ids('Stop', command({ continueOnBlock: true }))).toEqual(['continueOnBlockType'])
    expect(ids('Stop', { type: 'agent', prompt: 'p', continueOnBlock: true })).toEqual([
      'continueOnBlockType',
    ])
  })

  it('reports continueOnBlock on PostToolUseFailure and TaskCreated', () => {
    for (const event of ['PostToolUseFailure', 'TaskCreated']) {
      expect(ids(event, prompt({ continueOnBlock: true })), event).toEqual(['continueOnBlockEvent'])
    }
  })

  it('is silent on a prompt handler of another event', () => {
    for (const event of ['PreToolUse', 'PostToolUse', 'TeammateIdle', 'Stop']) {
      expect(ids(event, prompt({ continueOnBlock: true })), event).toEqual([])
    }
  })
})

describe(`${name}: shell, once and timeout`, () => {
  it('reports shell on a handler that sets args', () => {
    expect(ids('Stop', command({ shell: 'powershell', args: [] }))).toEqual(['shellWithArgs'])
    expect(ids('Stop', command({ shell: 'bash', args: ['a'] }))).toEqual(['shellWithArgs'])
  })

  it('is silent on shell with no args, and on args with no shell', () => {
    expect(ids('Stop', command({ shell: 'powershell' }))).toEqual([])
    expect(ids('Stop', command({ args: ['a'] }))).toEqual([])
    expect(ids('Stop', command({ shell: 'bash', args: 'a' }))).toEqual([])
  })

  it('reports once: true in a settings file and in a subagent', () => {
    for (const file of SETTINGS) {
      expect(ids('Stop', command({ once: true }), file), file).toEqual(['onceIgnored'])
    }
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        once: true\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['onceIgnored'])
  })

  it('says where Claude Code ignores once', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ once: true })])),
      FILES.project,
    )
    expect(message?.message).toBe(
      '"once" works in skill frontmatter only. Claude Code ignores it in a settings file.',
    )
  })

  it('is silent on once in a skill, in a plugin hooks.json, and when it is false', () => {
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        once: true\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual([])
    expect(ids('Stop', command({ once: true }), FILES.plugin)).toEqual([])
    expect(ids('Stop', command({ once: false }))).toEqual([])
  })

  it('reports timeout on a command hook that runs with async: true', () => {
    expect(ids('PostToolUse', command({ async: true, timeout: 30 }))).toEqual(['timeoutAsync'])
  })

  it('is silent on timeout with asyncRewake, which Claude Code still enforces', () => {
    expect(ids('PostToolUse', command({ asyncRewake: true, timeout: 30 }))).toEqual([])
    expect(ids('PostToolUse', command({ async: true, asyncRewake: true, timeout: 30 }))).toEqual([])
    expect(ids('PostToolUse', command({ async: false, timeout: 30 }))).toEqual([])
    expect(ids('PostToolUse', command({ async: true }))).toEqual([])
  })
})

describe(`${name}: SessionEnd timeout`, () => {
  it('reports a timeout above 60 in a settings file, a skill and a subagent', () => {
    expect(ids('SessionEnd', command({ timeout: 61 }))).toEqual(['timeoutSessionEnd'])
    expect(ids('SessionEnd', command({ timeout: 120 }), FILES.managed)).toEqual([
      'timeoutSessionEnd',
    ])
    const yaml =
      'SessionEnd:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        timeout: 90\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual(['timeoutSessionEnd'])
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['timeoutSessionEnd'])
  })

  it('is silent at 60 and below in a settings file', () => {
    expect(ids('SessionEnd', command({ timeout: 60 }))).toEqual([])
    expect(ids('SessionEnd', command({ timeout: 5 }))).toEqual([])
    expect(ids('SessionEnd', command())).toEqual([])
    expect(ids('SessionEnd', command({ timeout: '90' }))).toEqual([])
  })

  it('reports a plugin timeout above 1.5, and only that one', () => {
    expect(ids('SessionEnd', command({ timeout: 1.6 }), FILES.plugin)).toEqual([
      'timeoutSessionEndPlugin',
    ])
    expect(ids('SessionEnd', command({ timeout: 100 }), FILES.plugin)).toEqual([
      'timeoutSessionEndPlugin',
    ])
    expect(ids('SessionEnd', command({ timeout: 1.5 }), FILES.plugin)).toEqual([])
    expect(ids('SessionEnd', command({ timeout: 1 }), FILES.plugin)).toEqual([])
  })

  it('names the limit in the message', () => {
    const [plain] = lintJson(
      name,
      settings(hooks('SessionEnd', [command({ timeout: 61 })])),
      FILES.project,
    )
    expect(plain?.message).toBe(
      'Claude Code raises the SessionEnd budget to 60 seconds at most. This "timeout" has no effect above 60.',
    )
    const [plugin] = lintJson(
      name,
      settings(hooks('SessionEnd', [command({ timeout: 5 })])),
      FILES.plugin,
    )
    expect(plugin?.message).toBe(
      'A "timeout" on a plugin hook does not raise the SessionEnd budget of 1.5 seconds.',
    )
  })

  it('is silent on timeout above 60 for another event', () => {
    expect(ids('Stop', command({ timeout: 120 }))).toEqual([])
    expect(ids('Stop', command({ timeout: 120 }), FILES.plugin)).toEqual([])
  })

  it('reports the async fault and not the SessionEnd fault on the same field', () => {
    expect(ids('SessionEnd', command({ async: true, timeout: 90 }))).toEqual(['timeoutAsync'])
  })
})

describe(`${name}: onFailure`, () => {
  it('reports onFailure on a handler that is not a command or http', () => {
    expect(ids('PreToolUse', prompt({ onFailure: 'block' }))).toEqual(['onFailureType'])
    expect(
      ids('PreToolUse', { type: 'mcp_tool', server: 's', tool: 't', onFailure: 'block' }),
    ).toEqual(['onFailureType'])
  })

  it('reports onFailure on the events where exit code 2 keeps Claude working', () => {
    for (const event of ['Stop', 'SubagentStop', 'TaskCompleted', 'TeammateIdle']) {
      expect(ids(event, command({ onFailure: 'block' })), event).toEqual(['onFailureEvent'])
    }
  })

  it('reports onFailure on a background command hook', () => {
    expect(ids('PreToolUse', command({ onFailure: 'block', async: true }))).toEqual([
      'onFailureAsync',
    ])
    expect(ids('PreToolUse', command({ onFailure: 'block', asyncRewake: true }))).toEqual([
      'onFailureAsync',
    ])
  })

  it('is silent on a command or http hook of a blocking event', () => {
    expect(ids('PreToolUse', command({ onFailure: 'block' }))).toEqual([])
    expect(ids('UserPromptSubmit', http({ onFailure: 'continue' }))).toEqual([])
    expect(ids('PreToolUse', command({ onFailure: 'block', async: false }))).toEqual([])
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it('is silent for a handler with no type, an unknown type, or a type of another kind', () => {
    expect(ids('Stop', { async: true })).toEqual([])
    expect(ids('Stop', { type: 'script', async: true })).toEqual([])
    expect(ids('Stop', { type: 5, async: true })).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids('Stop', http({ async: true }), FILES.hidden)).toEqual([])
  })

  it('is silent in a plugin agent, where Claude Code ignores hooks', () => {
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        once: true\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it('is silent on a malformed config, which hooks-config-schema reports', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
    expect(jsonIds(name, settings({ Stop: [{ hooks: [1] }] }), FILES.project)).toEqual([])
  })

  it('skips a malformed event, group and handler, and reads the handler next to them', () => {
    const value = {
      Stop: 1,
      PreToolUse: ['x', { matcher: 'a' }, { hooks: 'x' }, { hooks: ['x', http({ async: true })] }],
    }
    expect(jsonIds(name, settings(value), FILES.project)).toEqual(['asyncType'])
  })

  it('reports each field once, at its key', () => {
    const text =
      '{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "http", "url": "u", "async": true}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['asyncType', 3, 54],
    ])
  })
})
