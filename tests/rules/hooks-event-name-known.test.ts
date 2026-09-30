// The same `hooks` object is in `hooks/hooks.json`, in settings, and in
// `plugin.json`, where it can also be an array of paths and objects.
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS } from '../../src/data/hook-events.ts'
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('hooks-event-name-known')
const hooks = (...events: string[]) =>
  JSON.stringify({ hooks: Object.fromEntries(events.map((e) => [e, []])) })

describe('HOOK_EVENTS', () => {
  // The hooks reference, "Hook lifecycle", lists 33 events.
  it('holds the 33 documented events, each once', () => {
    expect(HOOK_EVENTS).toHaveLength(33)
    expect(new Set(HOOK_EVENTS).size).toBe(33)
  })
})

/** One `nearMiss` report on `key`, with a rename to `event` as a
 *  suggestion. `output: null` checks that it is not an autofix. */
const renamed = (key: string, event: string, filename = 'hooks/hooks.json') => ({
  code: hooks('SessionStart', key),
  filename,
  output: null,
  errors: [
    {
      messageId: 'nearMiss',
      data: { key, event },
      suggestions: [{ messageId: 'rename', data: { event }, output: hooks('SessionStart', event) }],
    },
  ],
})

jsonTester.run('hooks-event-name-known', rule, {
  valid: [
    { code: hooks(...HOOK_EVENTS), filename: 'hooks/hooks.json' },
    { code: hooks('PreToolUse', 'Stop'), filename: '.claude/settings.json' },
    { code: JSON.stringify({ description: 'no hooks' }), filename: '.claude/settings.json' },
    {
      code: JSON.stringify({ hooks: './hooks/other.json' }),
      filename: '.claude-plugin/plugin.json',
    },
    {
      code: JSON.stringify({ hooks: ['./hooks/other.json', { PostToolUse: [] }] }),
      filename: '.claude-plugin/plugin.json',
    },
    { code: '[]', filename: 'hooks/hooks.json' },
    {
      code: hooks('FutureEvent'),
      filename: 'hooks/hooks.json',
      options: [{ additionalEvents: ['FutureEvent'] }],
    },
  ],
  invalid: [
    // Case and separator misses.
    renamed('preToolUse', 'PreToolUse'),
    renamed('pre_tool_use', 'PreToolUse', '.claude/settings.json'),
    renamed('session-end', 'SessionEnd', '.claude/settings.local.json'),
    // Spelling misses of two edits or fewer.
    renamed('PreToolUs', 'PreToolUse'),
    renamed('SesionEd', 'SessionEnd'),
    // A near miss of a name from `additionalEvents`.
    {
      ...renamed('futureEvent', 'FutureEvent'),
      options: [{ additionalEvents: ['FutureEvent'] }],
    },
    {
      code: hooks('Bogus'),
      filename: 'hooks/hooks.json',
      errors: [
        { messageId: 'unknown', data: { key: 'Bogus' }, line: 1, column: 11, suggestions: [] },
      ],
    },
    // `additionalEvents` adds names. It does not replace the list.
    {
      code: hooks('Stop', 'Bogus'),
      filename: 'hooks/hooks.json',
      options: [{ additionalEvents: ['FutureEvent'] }],
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
    // Inline in `plugin.json`, as an object and in an array.
    {
      code: JSON.stringify({ name: 'p', hooks: { Bogus: [] } }),
      filename: '.claude-plugin/plugin.json',
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
    {
      code: JSON.stringify({ name: 'p', hooks: ['./hooks/extra.json', { Bogus: [] }] }),
      filename: '.claude-plugin/plugin.json',
      errors: [{ messageId: 'unknown', data: { key: 'Bogus' } }],
    },
  ],
})

// JSON5 allows a bare key. The rule reads it the same way.
json5Tester.run('hooks-event-name-known (JSON5)', rule, {
  valid: [{ code: '{ hooks: { Stop: [] } }' }],
  invalid: [{ code: '{ hooks: { Bogus: [] } }', errors: [{ messageId: 'unknown' }] }],
})
