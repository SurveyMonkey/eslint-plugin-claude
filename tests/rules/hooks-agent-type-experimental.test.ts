// Agent hooks (`type: "agent"`) are experimental and may change. The hooks reference says to prefer
// command hooks for production workflows (https://code.claude.com/docs/en/hooks#agent-based-hooks).
// `hooks-handler-type-event-support` owns the events that do not run an agent hook.
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS } from '../../src/data/hook-events.ts'
import {
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-agent-type-experimental'
const owner = 'hooks-handler-type-event-support'
const agent = { type: 'agent', prompt: 'Check $ARGUMENTS' }
const ids = (event: string, handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler])), file)

describe(`${name}: the report`, () => {
  it('reports an agent handler, in every file that holds hooks', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('Stop', agent, file), file).toEqual(['experimental'])
    }
    const text = frontmatter(
      'PreToolUse:\n  - hooks:\n      - type: agent\n        prompt: Check\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['experimental'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['experimental'])
  })

  it('reports at the type value, and names the command hook', () => {
    const text = '{\n  "hooks": {"Stop": [{"hooks": [{"type": "agent", "prompt": "p"}]}]}\n}'
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['experimental', 2, 42])
    expect(message?.message).toBe(
      'Agent hooks are experimental and may change. Use a command hook for production work.',
    )
  })

  it('reports each agent handler on each event that runs one', () => {
    for (const event of [
      'UserPromptSubmit',
      'UserPromptExpansion',
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'PostToolBatch',
      'Stop',
      'SubagentStop',
      'TaskCreated',
      'TaskCompleted',
      'TeammateIdle',
    ]) {
      expect(ids(event, agent), event).toEqual(['experimental'])
    }
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for the other handler types', () => {
    for (const type of ['command', 'http', 'mcp_tool', 'prompt', 'other']) {
      expect(ids('Stop', { type, prompt: 'p' }), type).toEqual([])
    }
    expect(ids('Stop', { prompt: 'p' })).toEqual([])
    expect(ids('Stop', { type: 1 })).toEqual([])
  })

  it('leaves an event that does not run an agent hook to hooks-handler-type-event-support', () => {
    for (const event of [
      'PermissionRequest',
      'PermissionDenied',
      'SessionStart',
      'Setup',
      'SessionEnd',
      'Bogus',
    ]) {
      expect(ids(event, agent), event).toEqual([])
    }
  })

  it('reports each known event once, in this rule or in its owner', () => {
    for (const event of HOOK_EVENTS) {
      const text = settings(hooks(event, [agent]))
      const mine = jsonIds(name, text, FILES.project).length
      const theirs = jsonIds(owner, text, FILES.project).length
      expect(mine + theirs, event).toBe(1)
    }
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids('Stop', agent, FILES.hidden)).toEqual([])
  })
})
