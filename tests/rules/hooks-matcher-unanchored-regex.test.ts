// A matcher with a character outside the exact-match set is a JavaScript regular expression that
// Claude Code tests with `RegExp.prototype.test`, which "succeeds on a match anywhere in the value". So
// `Edit.*` matches `Edit` and `NotebookEdit`; "wrap the pattern in `^` and `$`, as in `^Edit$`, when you need a
// whole-string match" (https://code.claude.com/docs/en/hooks#matcher-patterns). The rule reports a tool-event
// regular expression that matches a built-in tool which the pattern wrapped as `^(?:pattern)` does not.
// `hooks-matcher-syntax` owns a pattern that does not compile and the `Tool(specifier)` form.
import { describe, expect, it } from 'vitest'
import { NO_MATCHER_EVENTS, TOOL_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-matcher-unanchored-regex'
const syntax = 'hooks-matcher-syntax'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the report`, () => {
  it('reports Edit.* on each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'Edit.*'), event).toEqual(['unanchored'])
    }
  })

  it('reports a pattern that also matches another built-in tool', () => {
    for (const matcher of [
      'Edit.*',
      'Edit$',
      '(Edit|Write)',
      'Edit.*|Write',
      '^Read|Edit',
      'Agent.*',
      'Edit\\w*',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual(['unanchored'])
    }
  })

  it('reports in every file that holds hooks', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PreToolUse', 'Edit.*', file), file).toEqual(['unanchored'])
    }
    const text = frontmatter(
      'PreToolUse:\n  - matcher: Edit.*\n    hooks:\n      - type: command\n        command: ./a.sh\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['unanchored'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['unanchored'])
  })

  it('reports at the matcher, and names the tool that the pattern also matches', () => {
    const text = '{\n  "hooks": {"PreToolUse": [{"matcher": "Edit.*", "hooks": []}]}\n}'
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['unanchored', 2, 40])
    expect(message?.message).toBe(
      'The matcher "Edit.*" is a regular expression that matches anywhere in the tool name, so it also matches NotebookEdit. Start it with "^". End it with "$" for a whole-string match.',
    )
  })

  it('lists each extra tool', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreToolUse', [], 'Edit.*|Agent.*')),
      FILES.project,
    )
    expect(message?.message).toContain('so it also matches ListAgents, NotebookEdit.')
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for ^Edit$ and Edit|Write', () => {
    for (const matcher of ['^Edit$', 'Edit|Write', 'Edit', 'Edit, Write', 'NotebookEdit']) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a pattern whose branches add no other tool, as ^Notebook in the docs', () => {
    for (const matcher of [
      '^Edit.*$',
      '^Edit.*',
      '^Read|Glob',
      '^Read|^Edit',
      '^Notebook',
      'mcp__memory__.*',
      '.*',
      'Read.*',
      '^(Edit|Write)$',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a match-all matcher and for an omitted matcher', () => {
    for (const matcher of ['', '*', undefined]) {
      expect(ids('PreToolUse', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for an event that does not match on a tool name', () => {
    for (const event of ['SubagentStop', 'SessionStart', 'FileChanged', 'Notification', 'Bogus']) {
      expect(ids(event, 'Edit.*'), event).toEqual([])
    }
    for (const event of NO_MATCHER_EVENTS) {
      expect(ids(event, 'Edit.*'), event).toEqual([])
    }
  })

  it('is silent for a matcher that is not a string', () => {
    for (const matcher of [['Edit.*'], 5, null]) {
      expect(ids('PreToolUse', matcher), JSON.stringify(matcher)).toEqual([])
    }
  })

  it('leaves a pattern that does not compile, and the Tool(specifier) form, to hooks-matcher-syntax', () => {
    for (const matcher of [
      'Edit(',
      'Edit[',
      'Edit(src/**)',
      'Bash(rm *)',
      'mcp__a__b(x)',
      'Edit(a|)',
      'mcp__a__b(x)|(Edit)',
    ]) {
      const text = settings(hooks('PreToolUse', [command()], matcher))
      expect(jsonIds(name, text, FILES.project), matcher).toEqual([])
      expect(jsonIds(syntax, text, FILES.project), matcher).toHaveLength(1)
    }
  })

  it('never reports a matcher that hooks-matcher-syntax also reports', () => {
    for (const matcher of ['Edit.*', 'Edit(', 'Edit(src/**)', '^Edit$', 'Edit,Write', '(']) {
      const text = settings(hooks('PreToolUse', [command()], matcher))
      const both =
        jsonIds(name, text, FILES.project).length + jsonIds(syntax, text, FILES.project).length
      expect(both, matcher).toBeLessThanOrEqual(1)
    }
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids('PreToolUse', 'Edit.*', FILES.hidden)).toEqual([])
  })
})
