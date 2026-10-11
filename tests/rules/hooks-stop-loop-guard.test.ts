// The hooks guide says that a `Stop` hook which blocks "needs to check whether it already triggered a
// continuation": parse `stop_hook_active` from the input and exit early when it is `true`
// (https://code.claude.com/docs/en/hooks-guide#stop-hook-hits-the-block-cap). The hooks reference says to "check
// this value or process the transcript" (https://code.claude.com/docs/en/hooks#stop-input). The rule is a
// heuristic. A script blocks when it exits 2, or prints a block decision or `additionalContext`. It is guarded when
// its text names `stop_hook_active` or `transcript_path`.
import { describe, expect, it as realIt } from 'vitest'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, P, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const it = realIt.fails
const name = 'hooks-stop-loop-guard'

const UNGUARDED = `#!/bin/bash\ninput=$(cat)\necho "Run the tests first" >&2\nexit 2\n`
const GUARDED = `#!/bin/bash\ninput=$(cat)\nif [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then\n  exit 0\nfi\necho "Run the tests first" >&2\nexit 2\n`
const script = (body: string, event = 'Stop', fields: Record<string, unknown> = {}) =>
  lintScript(name, { 'hooks/s.sh': body }, { event, fields })
const inline = (line: string, event = 'Stop', fields: Record<string, unknown> = {}) =>
  lintInline(name, { event, fields }, line)

describe(`${name}: the report`, () => {
  it('reports a Stop or SubagentStop script that blocks with exit 2', () => {
    expect(script(UNGUARDED)).toEqual(['noGuard'])
    expect(script(UNGUARDED, 'SubagentStop')).toEqual(['noGuard'])
  })

  it('reports a block decision and additionalContext, inline or in a script', () => {
    expect(inline(`echo '{"decision":"block","reason":"tests"}'`)).toEqual(['noGuard'])
    expect(
      inline(
        `echo '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"run tests"}}'`,
      ),
    ).toEqual(['noGuard'])
    expect(script(`#!/bin/bash\necho '{"decision":"block","reason":"tests"}'\n`)).toEqual([
      'noGuard',
    ])
  })

  it('reports an inline exit 2, and exec form', () => {
    expect(inline('echo no >&2; exit 2')).toEqual(['noGuard'])
    expect(script(UNGUARDED, 'Stop', { args: [] })).toEqual(['noGuard'])
  })

  it('reports once for a handler', () => {
    expect(inline(`echo '{"decision":"block","reason":"x"}'; exit 2`)).toEqual(['noGuard'])
  })

  it('names the event in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SubagentStop', [command({ command: 'exit 2' })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'This SubagentStop hook blocks, and nothing in it reads "stop_hook_active". Claude Code overrides a Stop hook after 8 blocks in a row. Read "stop_hook_active" from the input and exit 0 when it is true.',
    )
  })
})

describe(`${name}: silent`, () => {
  it('is silent for a script that reads stop_hook_active or the transcript', () => {
    expect(script(GUARDED)).toEqual([])
    expect(script(`#!/bin/bash\nt=$(jq -r .transcript_path)\ngrep done "$t" || exit 2\n`)).toEqual(
      [],
    )
  })

  it('is silent when the inline command names the guard', () => {
    expect(inline(`jq -e '.stop_hook_active' || exit 2`)).toEqual([])
  })

  it('is silent for a script that does not block', () => {
    expect(script('#!/bin/bash\necho done\nexit 0\n')).toEqual([])
    expect(script('#!/bin/bash\necho no >&2\nexit 1\n')).toEqual([])
    expect(inline(`echo '{"decision":"approve"}'`)).toEqual([])
    expect(inline(`echo '{"systemMessage":"x"}'`)).toEqual([])
  })

  it('is silent for another event', () => {
    for (const event of ['PreToolUse', 'TeammateIdle', 'TaskCompleted', 'UserPromptSubmit']) {
      expect(script(UNGUARDED, event), event).toEqual([])
    }
  })

  it('is silent for a handler in the background', () => {
    expect(script(UNGUARDED, 'Stop', { async: true })).toEqual([])
    expect(script(UNGUARDED, 'Stop', { asyncRewake: true })).toEqual([])
  })

  it('is silent for a script of another language, and a script that it cannot read', () => {
    expect(script('#!/usr/bin/env python3\nimport sys\nsys.exit(2)\n')).toEqual([])
    expect(script(UNGUARDED)).toEqual(['noGuard'])
    for (const [what, found] of unreadable(name, UNGUARDED, { event: 'Stop' })) {
      expect(found, what).toEqual([])
    }
  })

  it('is silent for a command that runs no script, a handler that is no command and a drop-in', () => {
    expect(inline('./check.sh')).toEqual([])
    expect(script(UNGUARDED, 'Stop', { command: `${P}/hooks/none.sh` })).toEqual([])
    const http = settings(hooks('Stop', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    const text = settings(hooks('Stop', [command({ command: 'exit 2' })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
    expect(inline('exit 2', 'Stop', { shell: 'powershell' })).toEqual([])
  })
})
