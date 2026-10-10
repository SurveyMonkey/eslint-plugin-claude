// `bypass_permissions_disabled` was a SessionEnd reason. Claude Code removed it in v2.1.234 and does
// not send it. The hooks reference, "SessionEnd", says so (https://code.claude.com/docs/en/hooks#sessionend).
import { describe, expect, it } from 'vitest'
import { REMOVED_MATCHER_VALUES } from '../../src/data/hook-events.ts'
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

const name = 'hooks-matcher-deprecated-value'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the removed value`, () => {
  it('holds one removed value, of SessionEnd', () => {
    expect([...REMOVED_MATCHER_VALUES]).toEqual([['SessionEnd', ['bypass_permissions_disabled']]])
  })

  it('reports bypass_permissions_disabled on SessionEnd', () => {
    expect(ids('SessionEnd', 'bypass_permissions_disabled')).toEqual(['removed'])
  })

  it('reports the value in a list, in either separator', () => {
    expect(ids('SessionEnd', 'logout|bypass_permissions_disabled')).toEqual(['removed'])
    expect(ids('SessionEnd', 'bypass_permissions_disabled, other')).toEqual(['removed'])
    expect(ids('SessionEnd', 'clear,bypass_permissions_disabled|resume')).toEqual(['removed'])
  })

  it('reports once for each removed segment', () => {
    expect(ids('SessionEnd', 'bypass_permissions_disabled|bypass_permissions_disabled')).toEqual([
      'removed',
      'removed',
    ])
  })

  it('is silent for a documented value, a match-all matcher and a value that is no match', () => {
    for (const matcher of [
      'logout',
      'other|clear',
      undefined,
      '',
      '*',
      'bypass_permissions',
      'bogus',
    ]) {
      expect(ids('SessionEnd', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for a regular expression, which the rule cannot read', () => {
    expect(ids('SessionEnd', '^bypass_permissions_disabled$')).toEqual([])
    expect(ids('SessionEnd', 'bypass_.*')).toEqual([])
  })

  it('is silent for the value on another event, and for a matcher that is no string', () => {
    expect(ids('SessionStart', 'bypass_permissions_disabled')).toEqual([])
    expect(ids('PreToolUse', 'bypass_permissions_disabled')).toEqual([])
    expect(ids('SessionEnd', ['bypass_permissions_disabled'])).toEqual([])
  })

  it('names the version and the event', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionEnd', [command()], 'bypass_permissions_disabled')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'Claude Code removed "bypass_permissions_disabled" in v2.1.234 and does not send it on SessionEnd. Drop it from the matcher.',
    )
  })

  it('reports at the matcher value', () => {
    const text =
      '{\n  "hooks": {\n    "SessionEnd": [{"matcher": "bypass_permissions_disabled", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 32]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('SessionEnd', 'bypass_permissions_disabled', file), file).toEqual(['removed'])
      expect(ids('SessionEnd', 'logout', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `SessionEnd:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('bypass_permissions_disabled'), file), file).toEqual([
        'removed',
      ])
      expect(markdownIds(name, yaml('logout'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('SessionEnd', 'bypass_permissions_disabled', FILES.hidden)).toEqual([])
    expect(
      ids('SessionEnd', 'bypass_permissions_disabled', '/repo/.github/hooks/hooks.json'),
    ).toEqual([])
  })
})
