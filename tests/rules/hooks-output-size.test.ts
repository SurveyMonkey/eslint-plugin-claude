// The hooks reference caps `additionalContext`, `systemMessage`, `initialUserMessage` and plain stdout at
// 10,000 characters: over it, Claude Code saves the text to a file and passes a path and a preview of up to 2,000
// characters. "This cap has no setting or environment variable to raise it"
// (https://code.claude.com/docs/en/hooks#json-output). Claude Code caps the `classifierContext` notes of one
// tool call at 2,000 characters (https://code.claude.com/docs/en/hooks#annotate-a-result-for-the-auto-mode-classifier).
// The rule measures a string that a command prints as a literal.
import { describe, expect, it } from 'vitest'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-output-size'

const echo = (value: unknown) => `echo '${JSON.stringify(value)}'`
const context = (text: string, field = 'additionalContext', event = 'SessionStart') =>
  echo({ hookSpecificOutput: { hookEventName: event, [field]: text } })
const ids = (line: string, event = 'SessionStart', options: unknown[] = [], fields = {}) =>
  lintInline(name, { event, options, fields }, line)

describe(`${name}: JSON fields`, () => {
  it('reports additionalContext over 10,000 characters', () => {
    expect(ids(context('x'.repeat(10_001)))).toEqual(['overCap'])
  })

  it('is silent at 10,000 characters and under', () => {
    expect(ids(context('x'.repeat(10_000)))).toEqual([])
    expect(ids(context('x'))).toEqual([])
  })

  it('reports each of the three fields, at the top level or in hookSpecificOutput', () => {
    const long = 'x'.repeat(10_001)
    expect(ids(echo({ systemMessage: long }))).toEqual(['overCap'])
    expect(ids(context(long, 'initialUserMessage'))).toEqual(['overCap'])
    expect(ids(echo({ additionalContext: long }))).toEqual(['overCap'])
  })

  it('reports the classifier note over 2,000 characters', () => {
    expect(
      ids(context('x'.repeat(2_001), 'classifierContext', 'PostToolUse'), 'PostToolUse'),
    ).toEqual(['classifierCap'])
    expect(
      ids(context('x'.repeat(2_000), 'classifierContext', 'PostToolUse'), 'PostToolUse'),
    ).toEqual([])
  })

  it('reports a field once, however many times the command prints it', () => {
    const long = 'x'.repeat(10_001)
    expect(ids(`${context(long)}; ${context(long)}`)).toEqual(['overCap'])
    expect(
      ids(echo({ additionalContext: long, hookSpecificOutput: { additionalContext: long } })),
    ).toEqual(['overCap'])
    expect(ids(echo({ systemMessage: long, additionalContext: long }))).toEqual([
      'overCap',
      'overCap',
    ])
  })

  it('measures each string on its own', () => {
    const half = 'x'.repeat(6_000)
    expect(
      ids(
        echo({
          systemMessage: half,
          hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: half },
        }),
      ),
    ).toEqual([])
  })

  it('names the field, the length and the cap in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [command({ command: context('x'.repeat(10_001)) })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The "additionalContext" string has 10001 characters. Claude Code caps it at 10000, saves the text to a file, and passes Claude the file path with a preview of up to the first 2,000 characters.',
    )
  })

  it('ignores a string that is no string, and other fields', () => {
    expect(ids(echo({ additionalContext: 5 }))).toEqual([])
    expect(ids(echo({ other: 'x'.repeat(20_000) }))).toEqual([])
    expect(ids(echo({ hookSpecificOutput: 'x'.repeat(20_000) }))).toEqual([])
  })
})

describe(`${name}: plain stdout`, () => {
  const long = 'y'.repeat(10_001)

  it('reports a long echo on an event that adds plain stdout as context', () => {
    for (const event of [
      'UserPromptSubmit',
      'UserPromptExpansion',
      'SessionStart',
      'PostModelSwitch',
    ]) {
      expect(ids(`echo "${long}"`, event), event).toEqual(['overCap'])
    }
  })

  it('is silent on another event, and under the cap', () => {
    expect(ids(`echo "${long}"`, 'PostToolUse')).toEqual([])
    expect(ids(`echo "${'y'.repeat(10_000)}"`)).toEqual([])
  })

  it('is silent for text that goes to stderr', () => {
    expect(ids(`echo "${long}" >&2`)).toEqual([])
  })

  it('is silent for text that a pipe or a command substitution takes', () => {
    expect(ids(`echo "${long}" | wc -c`)).toEqual([])
    expect(ids(`x=$(echo "${long}")`)).toEqual([])
  })

  it('names the stdout in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [command({ command: `echo "${long}"` })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'The plain stdout has 10001 characters. Claude Code caps it at 10000, saves the text to a file, and passes Claude the file path with a preview of up to the first 2,000 characters.',
    )
  })
})

describe(`${name}: PreCompact stdout`, () => {
  // https://code.claude.com/docs/en/hooks#precompact-output: Claude Code cuts longer output at the cap and appends a marker.
  const long = 'z'.repeat(10_001)

  it('reports a PreCompact command that prints more than 10,000 characters, with the cut message', () => {
    const found = lintJson(
      name,
      settings(hooks('PreCompact', [command({ command: `echo "${long}"` })])),
      '/repo/.claude/settings.json',
    )
    expect(found).toHaveLength(1)
    const [message] = found
    expect(message?.messageId).toBe('cutCap')
    expect(message?.message).toBe(
      'The plain stdout has 10001 characters. Claude Code cuts PreCompact stdout at 10000 characters per hook and appends a marker. It does not save the text to a file.',
    )
  })

  it('is silent for a PreCompact command at 10,000 characters and under', () => {
    expect(ids(`echo "${'z'.repeat(10_000)}"`, 'PreCompact')).toEqual([])
  })

  it('names the configured limit at another value', () => {
    expect(ids(`echo "${'z'.repeat(51)}"`, 'PreCompact', [{ maxOutputChars: 50 }])).toEqual([
      'overConfigured',
    ])
  })
})

describe(`${name}: JSON output that Claude Code discards`, () => {
  // https://code.claude.com/docs/en/hooks#json-output: the output cap applies "except for PreCompact stdout".
  // https://code.claude.com/docs/en/hooks#precompact: "Claude Code discards a PreCompact hook's `systemMessage` and
  // `continue` fields." The docs name no field of PreCompact JSON that Claude Code keeps.
  const long = 'x'.repeat(10_001)

  it('is silent for each JSON field of a PreCompact command past the cap', () => {
    expect(ids(echo({ systemMessage: long }), 'PreCompact')).toEqual([])
    expect(ids(context(long, 'additionalContext', 'PreCompact'), 'PreCompact')).toEqual([])
    expect(ids(context(long, 'initialUserMessage', 'PreCompact'), 'PreCompact')).toEqual([])
    expect(
      ids(context('x'.repeat(2_001), 'classifierContext', 'PreCompact'), 'PreCompact'),
    ).toEqual([])
  })

  // https://code.claude.com/docs/en/hooks#setup-decision-control: "Claude Code discards a Setup hook's JSON output
  // fields, such as `systemMessage`, `continue`, and `hookSpecificOutput.additionalContext`."
  it('is silent for the JSON fields of a Setup command past the cap', () => {
    expect(ids(echo({ systemMessage: long }), 'Setup')).toEqual([])
    expect(ids(context(long, 'additionalContext', 'Setup'), 'Setup')).toEqual([])
  })

  // https://code.claude.com/docs/en/hooks#worktreeremove: "Claude Code discards a WorktreeRemove hook's JSON output
  // fields, such as `systemMessage` and `continue`."
  it('is silent for the JSON fields of a WorktreeRemove command past the cap', () => {
    expect(ids(echo({ systemMessage: long }), 'WorktreeRemove')).toEqual([])
    expect(ids(context(long, 'additionalContext', 'WorktreeRemove'), 'WorktreeRemove')).toEqual([])
  })

  // https://code.claude.com/docs/en/hooks#postcompact: "Claude Code discards a PostCompact hook's `systemMessage` and
  // `continue` fields." The docs say nothing about `additionalContext` there, so it stays measured.
  it('is silent for the systemMessage of a PostCompact command past the cap', () => {
    expect(ids(echo({ systemMessage: long }), 'PostCompact')).toEqual([])
    expect(ids(context(long, 'additionalContext', 'PostCompact'), 'PostCompact')).toEqual([
      'overCap',
    ])
  })

  // Each sentence names `systemMessage` for the event. `additionalContext` stays measured where the sentence
  // does not name it.
  it.each([
    ['Notification', 'hooks#notification'],
    ['MessageDisplay', 'hooks#messagedisplay'],
    ['ConfigChange', 'hooks#configchange'],
    ['WorktreeCreate', 'hooks#worktreecreate'],
    ['Elicitation', 'hooks#elicitation'],
    ['ElicitationResult', 'hooks#elicitationresult'],
  ])('is silent for the systemMessage of a %s command past the cap (%s)', (event) => {
    expect(ids(echo({ systemMessage: long }), event)).toEqual([])
    expect(ids(context(long, 'additionalContext', event), event)).toEqual(['overCap'])
  })

  // "Claude Code discards their JSON output fields, such as `systemMessage` ..." (hooks#instructionsloaded,
  // hooks#sessionend), and "Claude Code ignores the hook's output and exit code" (hooks#stopfailure).
  it.each(['InstructionsLoaded', 'SessionEnd', 'StopFailure'])(
    'is silent for the JSON fields of a %s command past the cap',
    (event) => {
      expect(ids(echo({ systemMessage: long }), event)).toEqual([])
      expect(ids(context(long, 'additionalContext', event), event)).toEqual([])
    },
  )

  it('still reports a systemMessage past the cap on an event outside the set', () => {
    expect(ids(echo({ systemMessage: long }), 'SessionStart')).toEqual(['overCap'])
  })
})

describe(`${name}: options`, () => {
  it('takes another limit, and names it as the configured limit', () => {
    const found = ids(context('x'.repeat(51)), 'SessionStart', [{ maxOutputChars: 50 }])
    expect(found).toEqual(['overConfigured'])
    expect(ids(context('x'.repeat(50)), 'SessionStart', [{ maxOutputChars: 50 }])).toEqual([])
    expect(
      ids(context('x'.repeat(11), 'classifierContext', 'PostToolUse'), 'PostToolUse', [
        { maxClassifierChars: 10 },
      ]),
    ).toEqual(['overConfigured'])
  })

  it('names the configured limit in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [command({ command: context('x'.repeat(51)) })])),
      '/repo/.claude/settings.json',
      [{ maxOutputChars: 50 }],
    )
    expect(message?.message).toBe(
      'The "additionalContext" string has 51 characters. The configured limit is 50.',
    )
  })

  it('keeps the default of one option when the other is set', () => {
    expect(
      ids(context('x'.repeat(2_001), 'classifierContext', 'PostToolUse'), 'PostToolUse', [
        { maxOutputChars: 50 },
      ]),
    ).toEqual(['classifierCap'])
  })
})

describe(`${name}: scripts`, () => {
  it('reads a long literal in a script', () => {
    const body = `#!/bin/bash\n${context('x'.repeat(10_001))}\n`
    expect(lintScript(name, { 'hooks/s.sh': body }, { event: 'SessionStart' })).toEqual(['overCap'])
    for (const [what, found] of unreadable(name, `#!/bin/bash\n${context('x'.repeat(60))}\n`, {
      event: 'SessionStart',
      options: [{ maxOutputChars: 50 }],
    })) {
      expect(found, what).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, for a handler that is no command and for powershell', () => {
    const text = settings(
      hooks('SessionStart', [command({ command: context('x'.repeat(10_001)) })]),
    )
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
    const http = settings(hooks('SessionStart', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    expect(ids(context('x'.repeat(10_001)), 'SessionStart', [], { shell: 'powershell' })).toEqual(
      [],
    )
  })
})
