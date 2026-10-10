// A SessionEnd hook has a default timeout of 1.5 seconds. A hook that sets no `timeout` keeps the
// default, even when another hook raises the overall budget. A timeout on a plugin hook does not
// raise the budget. The hooks reference says so (https://code.claude.com/docs/en/hooks#sessionend-input).
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

const name = 'hooks-sessionend-default-timeout'
const ids = (event: string, handlers: unknown[], file = FILES.project) =>
  jsonIds(name, settings(hooks(event, handlers)), file)

describe(`${name}: the handlers`, () => {
  it('reports a SessionEnd handler with no timeout', () => {
    expect(ids('SessionEnd', [command()])).toEqual(['timeout'])
  })

  it('reports each handler that has no timeout', () => {
    expect(ids('SessionEnd', [command(), command({ timeout: 5 }), command()])).toEqual([
      'timeout',
      'timeout',
    ])
  })

  it('reports the handler types that SessionEnd runs', () => {
    for (const handler of [
      { type: 'http', url: 'https://example.com' },
      { type: 'mcp_tool', server: 's', tool: 't' },
      command({ async: true, asyncRewake: true }),
    ]) {
      expect(ids('SessionEnd', [handler]), JSON.stringify(handler)).toEqual(['timeout'])
    }
  })

  it('reports a handler with async false, and an http handler with async true', () => {
    expect(ids('SessionEnd', [command({ async: false })])).toEqual(['timeout'])
    expect(ids('SessionEnd', [command({ async: 'true' })])).toEqual(['timeout'])
    expect(ids('SessionEnd', [{ type: 'http', url: 'https://example.com', async: true }])).toEqual([
      'timeout',
    ])
  })

  it('is silent when the handler sets a timeout', () => {
    for (const timeout of [1, 5, 60, 0, '5', null]) {
      expect(ids('SessionEnd', [command({ timeout })]), String(timeout)).toEqual([])
    }
  })

  it('is silent on another event', () => {
    for (const event of ['Stop', 'SessionStart', 'PreToolUse', 'Setup']) {
      expect(ids(event, [command()]), event).toEqual([])
    }
  })

  it('is silent for a handler that SessionEnd does not run, and one with no type', () => {
    // `hooks-handler-type-event-support` reports a prompt or agent hook on SessionEnd.
    expect(ids('SessionEnd', [{ type: 'prompt', prompt: 'p' }])).toEqual([])
    expect(ids('SessionEnd', [{ type: 'agent', prompt: 'p' }])).toEqual([])
    expect(ids('SessionEnd', [{ command: 'c' }])).toEqual([])
  })

  it('is silent for a background command, where timeout has no effect', () => {
    // `hooks-handler-field-ignored` reports a timeout with async.
    expect(ids('SessionEnd', [command({ async: true })])).toEqual([])
  })

  it('reports at the handler', () => {
    const text =
      '{\n  "hooks": {\n    "SessionEnd": [{"hooks": [{"type": "command", "command": "c"}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 31]])
  })

  it('names the default in the message', () => {
    const [message] = lintJson(name, settings(hooks('SessionEnd', [command()])), FILES.project)
    expect(message?.message).toBe(
      'Claude Code cancels a SessionEnd hook after 1.5 seconds unless the hook sets "timeout". Set "timeout" on this handler.',
    )
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file', () => {
    for (const file of SETTINGS) {
      expect(ids('SessionEnd', [command()], file), file).toEqual(['timeout'])
      expect(ids('SessionEnd', [command({ timeout: 5 })], file), file).toEqual([])
    }
  })

  it('is silent in the hooks.json of a plugin, where a timeout does not raise the budget', () => {
    expect(ids('SessionEnd', [command()], FILES.plugin)).toEqual([])
    expect(ids('SessionEnd', [command({ timeout: 5 })], FILES.plugin)).toEqual([])
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (extra: string) =>
      frontmatter(`SessionEnd:\n  - hooks:\n      - type: command\n        command: c\n${extra}`)
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml(''), file), file).toEqual(['timeout'])
      expect(markdownIds(name, yaml('        timeout: 5\n'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('SessionEnd', [command()], FILES.hidden)).toEqual([])
    expect(ids('SessionEnd', [command()], '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
