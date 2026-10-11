// The hooks reference says that `PreToolUse` "previously used top-level `decision` and `reason` fields, but these
// are deprecated for this event" (https://code.claude.com/docs/en/hooks#pretooluse-decision-control). For
// `updatedMCPToolOutput` it says "Prefer `updatedToolOutput`, which works for all tools"
// (https://code.claude.com/docs/en/hooks#posttooluse-decision-control). The input field `team_name` is
// "Deprecated" on the task and teammate events (https://code.claude.com/docs/en/hooks#taskcreated-input).
// The rule reads JSON that a command prints, and the text of a repository script.
import { describe, expect, it } from 'vitest'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-output-deprecated-fields'

const echo = (value: unknown) => `echo '${JSON.stringify(value)}'`
const ids = (line: string, event: string, fields: Record<string, unknown> = {}) =>
  lintInline(name, { event, fields }, line)
const script = (body: string, event: string) => lintScript(name, { 'hooks/s.sh': body }, { event })

describe(`${name}: PreToolUse decision and reason`, () => {
  it('reports a top-level decision or reason', () => {
    expect(ids(echo({ decision: 'approve', reason: 'ok' }), 'PreToolUse')).toEqual([
      'preToolUseDecision',
    ])
    expect(ids(echo({ decision: 'block' }), 'PreToolUse')).toEqual(['preToolUseDecision'])
    expect(ids(echo({ reason: 'x' }), 'PreToolUse')).toEqual(['preToolUseDecision'])
  })

  it('reports once for a handler, and reads a script', () => {
    expect(
      ids(`${echo({ decision: 'block' })}; ${echo({ decision: 'approve' })}`, 'PreToolUse'),
    ).toEqual(['preToolUseDecision'])
    expect(script(`#!/bin/bash\necho '{"decision":"block","reason":"x"}'\n`, 'PreToolUse')).toEqual(
      ['preToolUseDecision'],
    )
  })

  it('names the replacement in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreToolUse', [command({ command: echo({ decision: 'block' }) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'PreToolUse deprecated the top-level "decision" and "reason". Use "hookSpecificOutput.permissionDecision" and "permissionDecisionReason". The old "approve" and "block" map to "allow" and "deny".',
    )
  })

  it('is silent for hookSpecificOutput, and for the same fields on another event', () => {
    expect(
      ids(
        echo({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'x',
          },
        }),
        'PreToolUse',
      ),
    ).toEqual([])
    for (const event of ['PostToolUse', 'Stop', 'PreModelSwitch', 'ConfigChange']) {
      expect(ids(echo({ decision: 'block', reason: 'x' }), event), event).toEqual([])
    }
  })
})

describe(`${name}: updatedMCPToolOutput`, () => {
  it('reports the field inside hookSpecificOutput or at the top level', () => {
    expect(
      ids(
        echo({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedMCPToolOutput: {} } }),
        'PostToolUse',
      ),
    ).toEqual(['updatedMcpToolOutput'])
    expect(ids(echo({ updatedMCPToolOutput: {} }), 'PostToolUse')).toEqual(['updatedMcpToolOutput'])
  })

  it('names the replacement in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PostToolUse', [command({ command: echo({ updatedMCPToolOutput: {} }) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The hooks reference says to prefer "updatedToolOutput" over "updatedMCPToolOutput". "updatedToolOutput" works for all tools.',
    )
  })

  it('is silent for updatedToolOutput, and for another event', () => {
    expect(
      ids(
        echo({ hookSpecificOutput: { hookEventName: 'PostToolUse', updatedToolOutput: {} } }),
        'PostToolUse',
      ),
    ).toEqual([])
    expect(ids(echo({ updatedMCPToolOutput: {} }), 'PreToolUse')).toEqual([])
  })
})

describe(`${name}: team_name`, () => {
  const jq = `#!/bin/bash\nteam=$(jq -r '.team_name')\necho "$team"\n`

  it('reports a script that reads team_name, on each event that sends it', () => {
    for (const event of ['TaskCreated', 'TaskCompleted', 'TeammateIdle']) {
      expect(script(jq, event), event).toEqual(['teamName'])
    }
  })

  it('reports an inline command that reads team_name, and a script of another language', () => {
    expect(ids(`jq -r .team_name`, 'TaskCreated')).toEqual(['teamName'])
    expect(
      script(
        `#!/usr/bin/env python3\nimport json,sys\nprint(json.load(sys.stdin)["team_name"])\n`,
        'TaskCreated',
      ),
    ).toEqual(['teamName'])
  })

  it('names the field in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('TaskCreated', [command({ command: 'jq -r .team_name' })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The input field "team_name" is deprecated, and Claude Code will remove it in a future release. Do not read it.',
    )
  })

  it('is silent for another event, another name and a comment', () => {
    expect(script(jq, 'PreToolUse')).toEqual([])
    expect(script(`#!/bin/bash\njq -r '.teammate_name'\n`, 'TaskCreated')).toEqual([])
    expect(script(`#!/bin/bash\n# reads team_name\n// team_name\nexit 0\n`, 'TaskCreated')).toEqual(
      [],
    )
    expect(script(`#!/bin/bash\njq -r '.my_team_name'\n`, 'TaskCreated')).toEqual([])
  })
})

describe(`${name}: what it reads`, () => {
  it('is silent for a script that it cannot read', () => {
    const body = `#!/bin/bash\necho '{"decision":"block"}'\n`
    expect(script(body, 'PreToolUse')).toEqual(['preToolUseDecision'])
    for (const [what, found] of unreadable(name, body, { event: 'PreToolUse' })) {
      expect(found, what).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, for a handler that is no command and for powershell', () => {
    const text = settings(hooks('PreToolUse', [command({ command: echo({ decision: 'block' }) })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
    const http = settings(hooks('PreToolUse', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    expect(ids(echo({ decision: 'block' }), 'PreToolUse', { shell: 'powershell' })).toEqual([])
  })

  it('is silent for output that goes to stderr', () => {
    expect(ids(`${echo({ decision: 'block' })} >&2`, 'PreToolUse')).toEqual([])
  })
})
