// The hooks reference describes the JSON that a hook prints. `hookSpecificOutput` "requires a `hookEventName`
// field set to the event name", `PreToolUse` puts its decision inside it, the only top-level `decision` is
// `"block"`, and `suppressOutput` "has no effect" (https://code.claude.com/docs/en/hooks#json-output). The hooks
// guide says that a field at the wrong level is ignored with no error
// (https://code.claude.com/docs/en/hooks-guide#hook-json-has-no-effect). The rule reads JSON that an inline
// command prints, and JSON that a repository script prints with `echo` or `printf`.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, P, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-output-schema'

/** An `echo` of the JSON value `value`. */
const echo = (value: unknown) => `echo '${JSON.stringify(value)}'`
const specific = (event: string, fields: Record<string, unknown> = {}) => ({
  hookSpecificOutput: { hookEventName: event, ...fields },
})
const ids = (
  value: unknown,
  event = 'PreToolUse',
  fields: Record<string, unknown> = {},
  matcher?: unknown,
) => lintInline(name, { event, fields, matcher }, typeof value === 'string' ? value : echo(value))

describe(`${name}: a field at the wrong level`, () => {
  it('reports permissionDecision, additionalContext and updatedInput at the top level', () => {
    expect(ids({ permissionDecision: 'deny' })).toEqual(['level'])
    expect(ids({ additionalContext: 'x' }, 'PostToolUse')).toEqual(['level'])
    expect(ids({ updatedInput: { command: 'ls' } })).toEqual(['level'])
  })

  it('reports each field once, and each field that is misplaced', () => {
    expect(ids({ permissionDecision: 'deny', additionalContext: 'x' })).toEqual(['level', 'level'])
    expect(
      ids(`${echo({ permissionDecision: 'deny' })}; ${echo({ permissionDecision: 'ask' })}`),
    ).toEqual(['level'])
  })

  it('names the field in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreToolUse', [command({ command: echo({ permissionDecision: 'deny' }) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The JSON output has "permissionDecision" at the top level. Claude Code ignores it there, and shows no error. Put it inside "hookSpecificOutput".',
    )
  })

  it('is silent for the same fields inside hookSpecificOutput', () => {
    expect(
      ids(
        specific('PreToolUse', {
          permissionDecision: 'deny',
          updatedInput: {},
          additionalContext: 'x',
        }),
      ),
    ).toEqual([])
  })
})

describe(`${name}: hookEventName`, () => {
  it('reports a name that is not the event', () => {
    expect(ids(specific('PostToolUse', { additionalContext: 'x' }))).toEqual(['eventName'])
    expect(ids(specific('pretooluse'))).toEqual(['eventName'])
    expect(ids({ hookSpecificOutput: { hookEventName: 5 } })).toEqual(['eventName'])
  })

  it('reports a missing name', () => {
    expect(ids({ hookSpecificOutput: { permissionDecision: 'deny' } })).toEqual([
      'eventNameMissing',
    ])
  })

  it('names the event in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: echo(specific('PostToolUse')) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The "hookEventName" of the JSON output is "PostToolUse", and this hook runs on Stop. Set it to "Stop".',
    )
  })

  it('is silent for the name of the event, and for a hookSpecificOutput that is no object', () => {
    expect(ids(specific('PreToolUse'))).toEqual([])
    expect(ids({ hookSpecificOutput: 'x' })).toEqual([])
    expect(ids({ hookSpecificOutput: null })).toEqual([])
    expect(ids({ hookSpecificOutput: [{ permissionDecision: 'deny' }] })).toEqual([])
  })
})

describe(`${name}: decision`, () => {
  it('reports a top-level decision that is not block', () => {
    expect(ids({ decision: 'approve' }, 'PostToolUse')).toEqual(['decision'])
    expect(ids({ decision: 'allow', reason: 'x' }, 'Stop')).toEqual(['decision'])
  })

  it('is silent for block, for a value that is no string, and for PreToolUse', () => {
    expect(ids({ decision: 'block', reason: 'x' }, 'Stop')).toEqual([])
    expect(ids({ decision: { behavior: 'allow' } }, 'Stop')).toEqual([])
    expect(ids({ decision: 'approve' }, 'PreToolUse')).toEqual([])
  })

  it('names the value in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: echo({ decision: 'approve' }) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The top-level "decision" is "approve". The only value is "block". To allow the action, leave "decision" out.',
    )
  })
})

describe(`${name}: suppressOutput`, () => {
  it('reports the field on any event', () => {
    expect(ids({ suppressOutput: true }, 'Stop')).toEqual(['suppress'])
    expect(ids({ suppressOutput: false, continue: true }, 'SessionStart')).toEqual(['suppress'])
  })
})

describe(`${name}: PreModelSwitch`, () => {
  it('reports defer, updatedInput and additionalContext', () => {
    const switchTo = (fields: Record<string, unknown>) =>
      ids(specific('PreModelSwitch', fields), 'PreModelSwitch')
    expect(switchTo({ permissionDecision: 'defer' })).toEqual(['modelSwitch'])
    expect(switchTo({ updatedInput: {} })).toEqual(['modelSwitch'])
    expect(switchTo({ additionalContext: 'x' })).toEqual(['modelSwitch'])
  })

  it('is silent for allow, deny and ask, and for the same fields on PreToolUse', () => {
    for (const decision of ['allow', 'deny', 'ask']) {
      expect(
        ids(specific('PreModelSwitch', { permissionDecision: decision }), 'PreModelSwitch'),
      ).toEqual([])
    }
    expect(ids(specific('PreToolUse', { permissionDecision: 'defer' }))).toEqual([])
  })

  it('allows a top-level block on PreModelSwitch', () => {
    expect(ids({ decision: 'block', reason: 'x' }, 'PreModelSwitch')).toEqual([])
  })
})

describe(`${name}: classifierContext`, () => {
  const note = specific('PostToolUse', { classifierContext: 'staging' })

  it('reports a note from a handler in the background', () => {
    expect(ids(note, 'PostToolUse', { async: true })).toEqual(['classifierAsync'])
    expect(ids(note, 'PostToolUse', { asyncRewake: true })).toEqual(['classifierAsync'])
  })

  it('is silent for a handler in the foreground', () => {
    expect(ids(note, 'PostToolUse')).toEqual([])
    expect(ids(note, 'PostToolUse', { async: false })).toEqual([])
  })
})

describe(`${name}: ConfigChange and policy_settings`, () => {
  const block = { decision: 'block', reason: 'no' }

  it('reports a block under the matcher policy_settings', () => {
    expect(ids(block, 'ConfigChange', {}, 'policy_settings')).toEqual(['policyBlock'])
  })

  it('reports only the decision when the value is not block', () => {
    expect(ids({ decision: 'approve' }, 'ConfigChange', {}, 'policy_settings')).toEqual([
      'decision',
    ])
  })

  it('is silent for another matcher, a list, no matcher and a non-string matcher', () => {
    for (const matcher of [
      'user_settings',
      'policy_settings|user_settings',
      '',
      '*',
      undefined,
      5,
    ]) {
      expect(ids(block, 'ConfigChange', {}, matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for the same output on another event', () => {
    expect(ids(block, 'Stop', {}, 'policy_settings')).toEqual([])
  })
})

describe(`${name}: what it reads`, () => {
  it('is silent for output that is valid', () => {
    for (const value of [
      specific('PreToolUse', { permissionDecision: 'allow', permissionDecisionReason: 'ok' }),
      { continue: false, stopReason: 'done' },
      { systemMessage: 'x' },
    ]) {
      expect(ids(value), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent for text that is not a JSON object', () => {
    for (const text of [
      "echo 'hello'",
      "echo '[1,2]'",
      'echo \'{"decision": \'',
      'echo \'"x"\'',
      "echo '{x}'",
      'echo "$(jq -n \'{decision: 1}\')"',
      'ls',
    ]) {
      expect(ids(text, 'Stop'), text).toEqual([])
    }
  })

  it('reads printf, flags, double quotes with escapes, and exec form', () => {
    expect(ids(`printf '%s' '{"suppressOutput":true}'`, 'Stop')).toEqual(['suppress'])
    expect(ids(`echo -n '{"suppressOutput":true}'`, 'Stop')).toEqual(['suppress'])
    expect(ids(`echo "{\\"suppressOutput\\": true}"`, 'Stop')).toEqual(['suppress'])
    expect(
      lintJson(
        name,
        settings(
          hooks('Stop', [
            { type: 'command', command: 'printf', args: ['{"suppressOutput":true}'] },
          ]),
        ),
        '/repo/.claude/settings.json',
      ).map((message) => message.messageId),
    ).toEqual(['suppress'])
  })

  it('is silent for output that goes to stderr or a file', () => {
    for (const text of [
      `echo '{"suppressOutput":true}' >&2`,
      `echo '{"suppressOutput":true}' 1>&2`,
      `echo '{"suppressOutput":true}' > /dev/stderr`,
      `echo '{"suppressOutput":true}' > out.json`,
      `echo '{"suppressOutput":true}' >> out.json`,
    ]) {
      expect(ids(text, 'Stop'), text).toEqual([])
    }
    expect(ids(`echo '{"suppressOutput":true}' 2>/dev/null`, 'Stop')).toEqual(['suppress'])
  })

  it('is silent for a command that is not echo or printf', () => {
    expect(ids(`jq -n '{"suppressOutput":true}'`, 'Stop')).toEqual([])
    expect(ids(`cat '{"suppressOutput":true}'`, 'Stop')).toEqual([])
  })

  it('reads JSON in a script, and ignores a comment', () => {
    const run = (body: string) => lintScript(name, { 'hooks/s.sh': body }, { event: 'Stop' })
    expect(run(`#!/bin/bash\necho '{"suppressOutput": true}'\n`)).toEqual(['suppress'])
    expect(run(`#!/bin/bash\n# echo '{"suppressOutput": true}'\nexit 0\n`)).toEqual([])
  })

  it('is silent for a script of another language and a script that it cannot read', () => {
    const body = `#!/bin/bash\necho '{"suppressOutput": true}'\n`
    expect(
      lintScript(
        name,
        { 'hooks/s.sh': `#!/usr/bin/env python3\nprint('{"suppressOutput": true}')\n` },
        { event: 'Stop' },
      ),
    ).toEqual([])
    expect(lintScript(name, { 'hooks/s.sh': body }, { event: 'Stop' })).toEqual(['suppress'])
    for (const [what, found] of unreadable(name, body, { event: 'Stop' })) {
      expect(found, what).toEqual([])
    }
  })

  it('reads a script by its extension and its shebang', () => {
    const line = `echo '{"suppressOutput": true}'\n`
    const run = (text: string, file = 'hooks/s.sh') =>
      lintScript(name, { [file]: text }, { event: 'Stop', fields: { command: `${P}/${file}` } })
    for (const shebang of ['#!/bin/bash', '#!/bin/sh', '#!/usr/bin/env zsh', '#!/bin/dash']) {
      expect(run(`${shebang}\n${line}`), shebang).toEqual(['suppress'])
    }
    for (const shebang of ['#!/usr/bin/env python3', '#!/usr/bin/env node', '#!/usr/bin/perl']) {
      expect(run(`${shebang}\n${line}`), shebang).toEqual([])
    }
    for (const file of ['hooks/s.py', 'hooks/s.JS', 'hooks/s.ps1', 'hooks/s.rb']) {
      expect(run(line, file), file).toEqual([])
    }
    expect(run(line, 'hooks/s')).toEqual(['suppress'])
  })

  it('reads a script that a shell runs', () => {
    const files = { 'hooks/s.sh': `echo '{"suppressOutput": true}'\n` }
    expect(
      lintScript(name, files, { event: 'Stop', fields: { command: `bash ${P}/hooks/s.sh` } }),
    ).toEqual(['suppress'])
  })

  it('reports in a plugin hooks.json', () => {
    const text = settings(hooks('Stop', [command({ command: echo({ suppressOutput: true }) })]))
    expect(
      lintJson(name, text, '/repo/plugins/p/hooks/hooks.json').map((message) => message.messageId),
    ).toEqual(['suppress'])
  })

  it('is silent for a handler that is no command, and in a hidden drop-in', () => {
    const http = settings(hooks('Stop', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    const text = settings(hooks('Stop', [command({ command: echo({ suppressOutput: true }) })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
    expect(ids(echo({ suppressOutput: true }), 'Stop', { shell: 'powershell' })).toEqual([])
  })

  it('reads a script from a repository on disk', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/s.sh` })]))
    const root = repo({
      '.claude/settings.json': text,
      'hooks/s.sh': `echo '{"decision":"approve"}'\n`,
    })
    expect(
      lintJson(name, text, path.join(root, '.claude/settings.json')).map(
        (message) => message.messageId,
      ),
    ).toEqual(['decision'])
  })
})
