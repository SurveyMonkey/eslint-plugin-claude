// The discarded JSON output of `src/data/hook-events.ts` against a literal copy of the hooks reference
// (https://code.claude.com/docs/en/hooks). The rule tests loop over this map, so a wrong key would pass them.
import { describe, expect, it } from 'vitest'
import { DISCARDED_JSON_OUTPUT, HOOK_EVENTS } from '../src/data/hook-events.ts'

describe('the discarded JSON output data', () => {
  it('names the events whose section of the hooks reference states a discard', () => {
    expect([...DISCARDED_JSON_OUTPUT.keys()].sort()).toEqual(
      [
        'ConfigChange',
        'Elicitation',
        'ElicitationResult',
        'InstructionsLoaded',
        'MessageDisplay',
        'Notification',
        'PostCompact',
        'PreCompact',
        'SessionEnd',
        'Setup',
        'StopFailure',
        'WorktreeCreate',
        'WorktreeRemove',
      ].sort(),
    )
  })

  it('names only events of the hooks reference', () => {
    for (const event of DISCARDED_JSON_OUTPUT.keys()) {
      expect(HOOK_EVENTS, event).toContain(event)
    }
  })

  it('discards every field for the events that the reference says so', () => {
    const all = [...DISCARDED_JSON_OUTPUT].filter(([, fields]) => fields === 'all').map(([e]) => e)
    expect(all.sort()).toEqual(
      [
        'InstructionsLoaded',
        'PreCompact',
        'SessionEnd',
        'Setup',
        'StopFailure',
        'WorktreeRemove',
      ].sort(),
    )
  })
})
