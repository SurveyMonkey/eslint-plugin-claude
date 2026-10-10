// Ten events match on a fixed set of values. The sets are in the hooks reference, "Matcher
// patterns" (https://code.claude.com/docs/en/hooks#matcher-patterns).
import { describe, expect, it as realIt } from 'vitest'
import { MATCHER_VALUES } from '../../src/data/hook-events.ts'
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

// Red: the rule does not exist yet. The fix commit removes this line and the alias.
const it = realIt.fails

const name = 'hooks-matcher-enum'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the value sets`, () => {
  // Green already: the data is in the base of this rule. A pinning test.
  realIt('holds ten events', () => {
    expect([...MATCHER_VALUES.keys()].sort()).toEqual([
      'ConfigChange',
      'DirectoryAdded',
      'InstructionsLoaded',
      'Notification',
      'PostCompact',
      'PreCompact',
      'SessionEnd',
      'SessionStart',
      'Setup',
      'StopFailure',
    ])
  })

  it('is silent for each documented value of each event', () => {
    for (const [event, values] of MATCHER_VALUES) {
      for (const value of values) {
        expect(ids(event, value), `${event} ${value}`).toEqual([])
      }
      expect(ids(event, values.join('|')), event).toEqual([])
    }
  })

  it('reports a value that the event does not send', () => {
    for (const event of MATCHER_VALUES.keys()) {
      expect(ids(event, 'bogus'), event).toEqual(['unknown'])
    }
  })

  it('reports the near miss of a value, and a value of another event', () => {
    expect(ids('SessionStart', 'startUp')).toEqual(['unknown'])
    expect(ids('SessionStart', 'manual')).toEqual(['unknown'])
    expect(ids('PreCompact', 'startup')).toEqual(['unknown'])
  })

  it('reports each unknown segment of a list', () => {
    expect(ids('SessionStart', 'startup|bogus|resume|nope')).toEqual(['unknown', 'unknown'])
    expect(ids('SessionStart', 'startup, bogus')).toEqual(['unknown'])
    expect(ids('SessionStart', 'bogus,startup')).toEqual(['unknown'])
  })

  it('names the segment, the event and the values', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreCompact', [command()], 'now')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'Claude Code never sends "now" on PreCompact. The values are "manual" and "auto".',
    )
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "Setup": [{"matcher": "x", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 25]])
  })
})

describe(`${name}: what the rule does not read`, () => {
  it('is silent for a match-all matcher', () => {
    for (const matcher of [undefined, '', '*']) {
      expect(ids('SessionStart', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for a regular expression, which can select a value in a way the rule cannot read', () => {
    for (const matcher of ['^start', 'start.*', '(startup|resume)', 'bogus$']) {
      expect(ids('SessionStart', matcher), matcher).toEqual([])
    }
  })

  it('is silent for an empty segment', () => {
    expect(ids('SessionStart', 'startup||resume')).toEqual([])
    expect(ids('SessionStart', 'startup, ,resume')).toEqual([])
  })

  it('is silent for an event without a fixed set, and for an event that is not known', () => {
    for (const event of [
      'PreToolUse',
      'FileChanged',
      'SubagentStart',
      'Elicitation',
      'Bogus',
      'Stop',
    ]) {
      expect(ids(event, 'whatever'), event).toEqual([])
    }
  })

  it('is silent for a matcher that is no string', () => {
    expect(ids('SessionStart', ['bogus'])).toEqual([])
    expect(ids('SessionStart', 7)).toEqual([])
  })

  it('leaves the removed SessionEnd value to hooks-matcher-deprecated-value', () => {
    expect(ids('SessionEnd', 'bypass_permissions_disabled')).toEqual([])
    expect(ids('SessionEnd', 'logout|bypass_permissions_disabled')).toEqual([])
    expect(ids('SessionStart', 'bypass_permissions_disabled')).toEqual(['unknown'])
  })
})

describe(`${name}: StopFailure`, () => {
  it('accepts only "|" as a separator in the exact set', () => {
    expect(ids('StopFailure', 'rate_limit|overloaded')).toEqual([])
    expect(ids('StopFailure', 'rate_limit|bogus')).toEqual(['unknown'])
  })

  it('reads a comma, a space or a hyphen as a regular expression and is silent', () => {
    for (const matcher of [
      'rate_limit, overloaded',
      'rate_limit,overloaded',
      'rate-limit',
      'bogus x',
    ]) {
      expect(ids('StopFailure', matcher), matcher).toEqual([])
    }
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('SessionStart', 'bogus', file), file).toEqual(['unknown'])
      expect(ids('SessionStart', 'startup', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `SessionStart:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('bogus'), file), file).toEqual(['unknown'])
      expect(markdownIds(name, yaml('startup'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('SessionStart', 'bogus', FILES.hidden)).toEqual([])
    expect(ids('SessionStart', 'bogus', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
