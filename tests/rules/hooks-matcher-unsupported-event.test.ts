// An event without matcher support ignores a `matcher`. The list is in the hooks reference,
// "Matcher patterns" (https://code.claude.com/docs/en/hooks#matcher-patterns).
import { describe, expect, it as realIt } from 'vitest'
import { NO_MATCHER_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-matcher-unsupported-event'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the events`, () => {
  it('reports a matcher on each event without matcher support', () => {
    expect(NO_MATCHER_EVENTS).toHaveLength(10)
    for (const event of NO_MATCHER_EVENTS) {
      expect(ids(event, 'Bash'), event).toEqual(['unsupported'])
    }
  })

  it('is silent for the same matcher on events with matcher support', () => {
    for (const event of [
      'PreToolUse',
      'SessionStart',
      'FileChanged',
      'Notification',
      'Elicitation',
    ]) {
      expect(ids(event, 'Bash'), event).toEqual([])
    }
  })

  it('is silent for a match-all matcher, which is what an ignored matcher does', () => {
    expect(ids('Stop', '*')).toEqual([])
    expect(ids('Stop', '')).toEqual([])
    expect(ids('Stop', undefined)).toEqual([])
  })

  it('is silent for an event that Claude Code does not know, and for a matcher that is no string', () => {
    expect(ids('Bogus', 'Bash')).toEqual([])
    expect(ids('Stop', ['Bash'])).toEqual([])
    expect(ids('Stop', 7)).toEqual([])
  })

  it('reports each group of the event, and names the event', () => {
    const text = JSON.stringify({
      hooks: {
        Stop: [{ matcher: 'a', hooks: [] }, { hooks: [] }, { matcher: 'b' }],
      },
    })
    const found = lintJson(name, text, FILES.project)
    expect(found.map((message) => message.messageId)).toEqual(['unsupported', 'unsupported'])
    expect(found[0]?.message).toBe(
      'Claude Code ignores the matcher on Stop, which has no matcher support.',
    )
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "Stop": [{"matcher": "x", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 25]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('Stop', 'Bash', file), file).toEqual(['unsupported'])
      expect(ids('PreToolUse', 'Bash', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (event: string) =>
      frontmatter(
        `${event}:\n  - matcher: Bash\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('Stop'), file), file).toEqual(['unsupported'])
      expect(markdownIds(name, yaml('PreToolUse'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('Stop', 'Bash', FILES.hidden)).toEqual([])
    expect(ids('Stop', 'Bash', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
