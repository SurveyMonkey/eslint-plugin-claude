// Which handler types an event supports. The docs are "Prompt-based hooks" (the list of events
// by type), "Setup decision control", and "Events that fire before MCP servers are available" in
// the hooks reference (https://code.claude.com/docs/en/hooks), and the changelog for 2.1.142 and
// 2.1.280.
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

const name = 'hooks-handler-type-event-support'
const http = { type: 'http', url: 'http://x.test' }
const mcp = { type: 'mcp_tool', server: 's', tool: 't' }
const prompt = { type: 'prompt', prompt: 'Is it safe?' }
const agent = { type: 'agent', prompt: 'Verify.' }
const ids = (event: string, handler: object, matcher?: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler], matcher)), file)

// The events that run a command, an HTTP and an MCP tool hook, and no prompt or agent hook.
const NO_PROMPT = [
  'ConfigChange',
  'CwdChanged',
  'DirectoryAdded',
  'Elicitation',
  'ElicitationResult',
  'FileChanged',
  'InstructionsLoaded',
  'MessageDisplay',
  'Notification',
  'PostCompact',
  'PostModelSwitch',
  'PreCompact',
  'PreModelSwitch',
  'SessionEnd',
  'StopFailure',
  'SubagentStart',
  'WorktreeCreate',
  'WorktreeRemove',
]
// The events that run all five types.
const ALL_FIVE = [
  'PostToolBatch',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
  'Stop',
  'SubagentStop',
  'TaskCompleted',
  'TaskCreated',
  'TeammateIdle',
  'UserPromptExpansion',
  'UserPromptSubmit',
]

describe(`${name}: prompt and agent hooks`, () => {
  it.fails('reports a prompt and an agent hook on each event that does not run them', () => {
    for (const event of NO_PROMPT) {
      expect(ids(event, prompt), event).toEqual(['unsupported'])
      expect(ids(event, agent), event).toEqual(['unsupported'])
    }
  })

  it.fails('is silent for command, http and mcp_tool on those events', () => {
    for (const event of NO_PROMPT) {
      expect(ids(event, command()), event).toEqual([])
      expect(ids(event, http), event).toEqual([])
      expect(ids(event, mcp), event).toEqual([])
    }
  })

  it.fails('is silent for each type on the events that run all five', () => {
    for (const event of ALL_FIVE) {
      for (const handler of [command(), http, mcp, prompt, agent]) {
        expect(ids(event, handler), `${event} ${handler.type}`).toEqual([])
      }
    }
  })

  it.fails('names the event, the type and the types that the event runs', () => {
    const [message] = lintJson(name, settings(hooks('SessionEnd', [prompt])), FILES.project)
    expect(message?.message).toBe(
      'Claude Code does not run a "prompt" hook on SessionEnd. It runs "command", "http" and "mcp_tool" hooks there.',
    )
  })
})

describe(`${name}: SessionStart and Setup`, () => {
  it.fails('reports http, prompt and agent on SessionStart and Setup', () => {
    for (const event of ['SessionStart', 'Setup']) {
      for (const handler of [http, prompt, agent]) {
        expect(ids(event, handler), `${event} ${handler.type}`).toEqual(['unsupported'])
      }
    }
  })

  it.fails('reports mcp_tool on Setup, which Claude Code always skips', () => {
    expect(ids('Setup', mcp)).toEqual(['unsupported'])
    expect(ids('Setup', command())).toEqual([])
  })

  it.fails('is silent for command, and for mcp_tool that can run, on SessionStart', () => {
    expect(ids('SessionStart', command())).toEqual([])
    expect(ids('SessionStart', mcp)).toEqual([])
    expect(ids('SessionStart', mcp, '')).toEqual([])
    expect(ids('SessionStart', mcp, '*')).toEqual([])
    expect(ids('SessionStart', mcp, 'clear')).toEqual([])
    expect(ids('SessionStart', mcp, 'compact|fork')).toEqual([])
    expect(ids('SessionStart', mcp, 'startup|clear')).toEqual([])
    expect(ids('SessionStart', mcp, '^(startup|resume)$')).toEqual([])
    expect(ids('SessionStart', mcp, ['startup'])).toEqual([])
  })

  it.fails('reports mcp_tool whose matcher selects only startup and resume', () => {
    for (const matcher of [
      'startup',
      'resume',
      'startup|resume',
      'resume, startup',
      'startup,resume',
    ]) {
      expect(ids('SessionStart', mcp, matcher), matcher).toEqual(['launch'])
    }
  })

  it.fails('says that the hook runs after clear and compaction', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [mcp], 'startup')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'Claude Code skips an "mcp_tool" hook on SessionStart at launch, and this matcher selects launch only. The hook never runs.',
    )
  })
})

describe(`${name}: PermissionRequest and PermissionDenied`, () => {
  it.fails('reports an agent hook on PermissionRequest', () => {
    expect(ids('PermissionRequest', agent)).toEqual(['unsupported'])
    const [message] = lintJson(name, settings(hooks('PermissionRequest', [agent])), FILES.project)
    expect(message?.message).toContain('"command", "http", "mcp_tool" and "prompt"')
  })

  it.fails('is silent for the four other types on PermissionRequest', () => {
    for (const handler of [command(), http, mcp, prompt]) {
      expect(ids('PermissionRequest', handler), handler.type).toEqual([])
    }
  })

  it.fails('reports a prompt and an agent hook on PermissionDenied, which discards their output', () => {
    expect(ids('PermissionDenied', prompt)).toEqual(['discarded'])
    expect(ids('PermissionDenied', agent)).toEqual(['discarded'])
    expect(ids('PermissionDenied', command())).toEqual([])
    expect(ids('PermissionDenied', http)).toEqual([])
    expect(ids('PermissionDenied', mcp)).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it.fails('reads every settings file, hooks.json, a skill and a project subagent', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('SessionEnd', prompt, undefined, file), file).toEqual(['unsupported'])
    }
    const yaml = 'SessionEnd:\n  - hooks:\n      - type: prompt\n        prompt: p\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual(['unsupported'])
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['unsupported'])
  })

  it.fails('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(ids('SessionEnd', prompt, undefined, FILES.hidden)).toEqual([])
    const yaml = 'SessionEnd:\n  - hooks:\n      - type: prompt\n        prompt: p\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it.fails('is silent for an event that Claude Code does not know, and for an unknown type', () => {
    expect(ids('Bogus', prompt)).toEqual([])
    expect(ids('SessionEnd', { type: 'script' })).toEqual([])
    expect(ids('SessionEnd', {})).toEqual([])
    expect(ids('constructor', prompt)).toEqual([])
  })

  it.fails('reports at the type value', () => {
    const text =
      '{\n  "hooks": {\n    "SessionEnd": [{"hooks": [{"type": "prompt", "prompt": "p"}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 44]])
  })
})
