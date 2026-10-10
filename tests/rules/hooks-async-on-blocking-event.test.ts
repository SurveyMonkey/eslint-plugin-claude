// A hook with `"async": true` runs in the background, and its output cannot block or decide: "response
// fields like `decision`, `permissionDecision`, and `continue` have no effect, because the action they
// would have controlled has already completed"
// (https://code.claude.com/docs/en/hooks#run-hooks-in-the-background). The rule reports the flag on an event
// whose hooks can block or decide (https://code.claude.com/docs/en/hooks#exit-code-2-behavior-per-event).
import { describe, expect, it } from 'vitest'
import { BLOCKING_EVENTS, HOOK_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-async-on-blocking-event'
const ids = (event: string, handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [handler])), file)

describe(`${name}: the report`, () => {
  it.fails('reports async on PreToolUse', () => {
    expect(ids('PreToolUse', command({ async: true }))).toEqual(['async'])
  })

  it.fails('reports each event that can block or decide', () => {
    for (const event of BLOCKING_EVENTS) {
      expect(ids(event, command({ async: true })), event).toEqual(['async'])
    }
  })

  it.fails('reports in every file that holds hooks', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('Stop', command({ async: true }), file), file).toEqual(['async'])
    }
    const text = frontmatter(
      'PreToolUse:\n  - hooks:\n      - type: command\n        command: ./a.sh\n        async: true\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['async'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['async'])
  })

  it.fails('reports at the value of async, and names the event', () => {
    const text =
      '{\n  "hooks": {"PreToolUse": [{"hooks": [{"type": "command", "command": "a", "async": true}]}]}\n}'
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['async', 2, 83])
    expect(message?.message).toBe(
      'A background hook cannot block or decide, so its output has no effect on PreToolUse. Remove "async" if the hook must block.',
    )
  })

  it.fails('reports each async handler of a group', () => {
    const text = settings(
      hooks('Stop', [command({ async: true }), command(), command({ async: true })]),
    )
    expect(jsonIds(name, text, FILES.project)).toEqual(['async', 'async'])
  })
})

describe(`${name}: the silent cases`, () => {
  it.fails('is silent for async on PostToolUse, the event of the docs example', () => {
    expect(ids('PostToolUse', command({ async: true }))).toEqual([])
  })

  it.fails('is silent for async on each event that cannot block', () => {
    for (const event of HOOK_EVENTS.filter((e) => !BLOCKING_EVENTS.includes(e))) {
      expect(ids(event, command({ async: true })), event).toEqual([])
    }
  })

  it.fails('is silent when async is false, missing or not a Boolean', () => {
    for (const value of [false, 'true', 1, null]) {
      expect(ids('PreToolUse', command({ async: value })), String(value)).toEqual([])
    }
    expect(ids('PreToolUse', command())).toEqual([])
  })

  it.fails('is silent for a handler that is not a command hook', () => {
    for (const type of ['http', 'prompt', 'agent', 'mcp_tool', 'other']) {
      expect(ids('PreToolUse', { type, async: true }), type).toEqual([])
    }
    expect(ids('PreToolUse', { async: true })).toEqual([])
  })

  it.fails('is silent for an event name that Claude Code does not know', () => {
    expect(ids('Bogus', command({ async: true }))).toEqual([])
  })

  it.fails('is silent for a hidden drop-in', () => {
    expect(ids('PreToolUse', command({ async: true }), FILES.hidden)).toEqual([])
  })
})
