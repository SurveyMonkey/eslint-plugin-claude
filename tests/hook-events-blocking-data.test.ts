// `BLOCKING_EVENTS` of `src/data/hook-events.ts` against a literal copy of the hooks reference, "Exit
// code 2 behavior per event" (https://code.claude.com/docs/en/hooks#exit-code-2-behavior-per-event).
// The rule tests loop over the constant, so a wrong entry would pass them.
import { describe, expect, it } from 'vitest'
import { BLOCKING_EVENTS, HOOK_EVENTS } from '../src/data/hook-events.ts'

/** The first two columns of the table, checked on 2026-10-10. */
const TABLE: ReadonlyMap<string, 'Yes' | 'No'> = new Map([
  ['PreToolUse', 'Yes'],
  ['PermissionRequest', 'No'],
  ['UserPromptSubmit', 'Yes'],
  ['UserPromptExpansion', 'Yes'],
  ['Stop', 'Yes'],
  ['SubagentStop', 'Yes'],
  ['TeammateIdle', 'Yes'],
  ['TaskCreated', 'Yes'],
  ['TaskCompleted', 'Yes'],
  ['ConfigChange', 'Yes'],
  ['StopFailure', 'No'],
  ['PostToolUse', 'No'],
  ['PostToolUseFailure', 'No'],
  ['PostToolBatch', 'Yes'],
  ['PermissionDenied', 'No'],
  ['Notification', 'No'],
  ['SubagentStart', 'No'],
  ['SessionStart', 'No'],
  ['Setup', 'No'],
  ['SessionEnd', 'No'],
  ['CwdChanged', 'No'],
  ['DirectoryAdded', 'No'],
  ['FileChanged', 'No'],
  ['PreCompact', 'Yes'],
  ['PostCompact', 'No'],
  ['PreModelSwitch', 'Yes'],
  ['PostModelSwitch', 'No'],
  ['Elicitation', 'Yes'],
  ['ElicitationResult', 'Yes'],
  ['WorktreeCreate', 'Yes'],
  ['WorktreeRemove', 'Yes'],
  ['InstructionsLoaded', 'No'],
  ['MessageDisplay', 'No'],
])

/** The events that decide through JSON output and not through exit code 2. The "Decision control"
 *  table of the hooks reference lists `PermissionRequest` with `decision.behavior`. */
const DECIDES_IN_JSON = ['PermissionRequest']

describe('the blocking events', () => {
  it('lists each event that the exit code table marks as able to block, and PermissionRequest', () => {
    const expected = [...TABLE]
      .filter(([, blocks]) => blocks === 'Yes')
      .map(([event]) => event)
      .concat(DECIDES_IN_JSON)
    expect([...BLOCKING_EVENTS].sort()).toEqual(expected.sort())
  })

  it('has a row in the table for every event, and no other row', () => {
    expect([...TABLE.keys()].sort()).toEqual([...HOOK_EVENTS].sort())
  })

  it('leaves out PostToolUse, which the docs show with an async hook', () => {
    expect(BLOCKING_EVENTS).not.toContain('PostToolUse')
  })
})
