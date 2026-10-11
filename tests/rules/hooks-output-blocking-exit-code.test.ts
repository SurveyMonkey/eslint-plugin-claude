// The hooks reference says: "Without valid JSON on stdout, Claude Code treats exit code 1 as a non-blocking error,
// even though 1 is the conventional Unix failure code. If your hook is meant to enforce a policy, use `exit 2`"
// (https://code.claude.com/docs/en/hooks#other-exit-codes). The rule is a heuristic. A script means to block when
// it writes a message to stderr and then exits with 1. It reports that on an event where exit 2 blocks.
import path from 'node:path'
import { describe, expect, it as realIt } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, P, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const it = realIt.fails
const name = 'hooks-output-blocking-exit-code'
const BLOCK =
  '#!/bin/bash\ninput=$(cat)\nif [[ "$input" == *rm* ]]; then\n  echo "Blocked: rm" >&2\n  exit 1\nfi\nexit 0\n'

const inline = (line: string, event = 'PreToolUse', fields: Record<string, unknown> = {}) =>
  lintInline(name, { event, fields }, line)
const script = (body: string, event = 'PreToolUse', fields: Record<string, unknown> = {}) =>
  lintScript(name, { 'hooks/s.sh': body }, { event, fields })

describe(`${name}: the report`, () => {
  it('reports a script that writes to stderr and exits 1', () => {
    expect(script(BLOCK)).toEqual(['exit1'])
  })

  it('reports an inline command that does the same', () => {
    expect(inline('echo "Blocked" >&2; exit 1')).toEqual(['exit1'])
  })

  it('reads each way to write to stderr', () => {
    for (const text of [
      'echo "no" >&2; exit 1',
      'echo "no" 1>&2; exit 1',
      'echo no >/dev/stderr; exit 1',
      'printf "no" >&2\nexit 1',
      'cmd || { echo "no" >&2; exit 1; }',
      'if true; then echo "no" >&2; exit 1; fi',
      'echo "no" >&2 && exit 1',
    ]) {
      expect(inline(text), text).toEqual(['exit1'])
    }
  })

  it('reports on each event where exit 2 blocks', () => {
    for (const event of [
      'PreToolUse',
      'UserPromptSubmit',
      'UserPromptExpansion',
      'Stop',
      'SubagentStop',
      'TeammateIdle',
      'TaskCreated',
      'TaskCompleted',
      'ConfigChange',
      'PostToolBatch',
      'PreCompact',
      'PreModelSwitch',
      'Elicitation',
      'ElicitationResult',
    ]) {
      expect(inline('echo "no" >&2; exit 1', event), event).toEqual(['exit1'])
    }
  })

  it('reports exec form with a script', () => {
    expect(script(BLOCK, 'PreToolUse', { args: [] })).toEqual(['exit1'])
  })

  it('reports a quoted code, and a script in a shell', () => {
    expect(inline('echo "no" >&2; exit "1"')).toEqual(['exit1'])
    expect(
      lintScript(
        name,
        { 'hooks/s.sh': BLOCK },
        {
          event: 'PreToolUse',
          fields: { command: `bash ${P}/hooks/s.sh` },
        },
      ),
    ).toEqual(['exit1'])
  })

  it('names the event and the source in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: 'echo no >&2; exit 1' })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'This Stop hook command writes a message to stderr and exits with 1. Claude Code treats exit 1 as a non-blocking error, so the action goes ahead. Exit with 2 to block.',
    )
  })

  it('names the script in the message', () => {
    const text = settings(hooks('PreToolUse', [command({ command: `${P}/hooks/s.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/s.sh': BLOCK })
    const [message] = lintJson(name, text, path.join(root, '.claude/settings.json'))
    expect(message?.message).toBe(
      'This PreToolUse hook script "s.sh" writes a message to stderr and exits with 1. Claude Code treats exit 1 as a non-blocking error, so the action goes ahead. Exit with 2 to block.',
    )
  })

  it('reports a handler once', () => {
    expect(inline('echo a >&2; exit 1; echo b >&2; exit 1')).toEqual(['exit1'])
  })
})

describe(`${name}: silent`, () => {
  it('is silent for exit 2, and for another code', () => {
    for (const text of [
      'echo no >&2; exit 2',
      'echo no >&2; exit 3',
      'echo no >&2; exit 10',
      'echo no >&2; exit',
    ]) {
      expect(inline(text), text).toEqual([])
    }
  })

  it('is silent for exit 1 with no message to stderr before it', () => {
    for (const text of [
      'exit 1',
      'echo no; exit 1',
      'exit 1; echo no >&2',
      'echo no >err.txt; exit 1',
      'echo no 2>&1; exit 1',
    ]) {
      expect(inline(text), text).toEqual([])
    }
  })

  it('is silent for an event where exit 2 does not block', () => {
    for (const event of [
      'PostToolUse',
      'SessionStart',
      'Notification',
      'StopFailure',
      'SessionEnd',
    ]) {
      expect(inline('echo no >&2; exit 1', event), event).toEqual([])
    }
  })

  it('is silent for the events where any non-zero code acts, or exit 2 is not honored', () => {
    for (const event of ['WorktreeCreate', 'WorktreeRemove', 'PermissionRequest']) {
      expect(inline('echo no >&2; exit 1', event), event).toEqual([])
    }
  })

  it('is silent when onFailure is block, except on the events that ignore it', () => {
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { onFailure: 'block' })).toEqual([])
    expect(inline('echo no >&2; exit 1', 'Stop', { onFailure: 'block' })).toEqual(['exit1'])
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { onFailure: 'continue' })).toEqual([
      'exit1',
    ])
  })

  it('is silent for a handler in the background', () => {
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { async: true })).toEqual([])
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { asyncRewake: true })).toEqual([])
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { async: false })).toEqual(['exit1'])
  })

  it('is silent when the script prints JSON, which makes exit 1 a success', () => {
    expect(
      inline(
        `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}'; echo no >&2; exit 1`,
      ),
    ).toEqual([])
  })

  it('is silent for a handler that is no command, and for powershell in shell form', () => {
    const http = settings(hooks('PreToolUse', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    expect(inline('echo no >&2; exit 1', 'PreToolUse', { shell: 'powershell' })).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    const text = settings(hooks('PreToolUse', [command({ command: 'echo no >&2; exit 1' })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
  })

  it('is silent for a script of another language', () => {
    expect(script('#!/usr/bin/env python3\nimport sys\nsys.stderr.write("no")\nexit 1\n')).toEqual(
      [],
    )
    expect(script('#!/usr/bin/env node\nprocess.stderr.write("no")\nprocess.exit(1)\n')).toEqual([])
  })

  it('is silent for a script that it cannot read', () => {
    expect(script(BLOCK)).toEqual(['exit1'])
    for (const [what, found] of unreadable(name, BLOCK, { event: 'PreToolUse' })) {
      expect(found, what).toEqual([])
    }
  })
})
