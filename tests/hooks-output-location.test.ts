// Each hooks output rule reports at the `command` string of the handler. The text of the settings file is one
// line, so the column of a report is the offset of the quoted command in that text, plus one.
import { describe, expect, it } from 'vitest'
import { command, hooks, settings } from './hooks.test-support.ts'
import { lintJson } from './rule-tester.test-support.ts'

const FILE = '/repo/.claude/settings.json'
const BIG = 'x'.repeat(10_001)

const at = (name: string, handlers: string[], event: string, matcher?: string) => {
  const text = settings(
    hooks(
      event,
      handlers.map((line) => command({ command: line })),
      matcher,
    ),
  )
  return { text, messages: lintJson(name, text, FILE).map((m) => [m.line, m.column]) }
}
const column = (text: string, line: string) => text.indexOf(JSON.stringify(line)) + 1

const CASES: [string, string, string, string?][] = [
  ['hooks-output-blocking-exit-code', 'PreToolUse', 'echo no >&2; exit 1'],
  ['hooks-output-schema', 'PreToolUse', `echo '{"permissionDecision":"deny"}'`],
  ['hooks-output-deprecated-fields', 'TaskCreated', 'jq .team_name'],
  [
    'hooks-output-size',
    'SessionStart',
    `echo '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"${BIG}"}}'`,
  ],
  ['hooks-stop-loop-guard', 'Stop', 'exit 2'],
  ['hooks-sessionstart-static-context', 'SessionStart', 'echo hello'],
]

describe('the location of a hooks output report', () => {
  for (const [name, event, line] of CASES) {
    it(`${name} reports at the command string`, () => {
      // A first handler that the rule ignores, so the report must name the second.
      const { text, messages } = at(name, ['true', line], event)
      expect(messages).toEqual([[1, column(text, line)]])
    })
  }

  it('hooks-multiple-updatedinput reports at the second handler', () => {
    const update = (note: string) =>
      `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"command":"${note}"}}}'`
    const lines = [update('a'), update('b')]
    const { text, messages } = at('hooks-multiple-updatedinput', lines, 'PreToolUse', 'Bash')
    expect(messages).toEqual([[1, column(text, lines[1] as string)]])
  })
})
