// A matcher on a tool event is case-sensitive, and some names never reach a hook. The docs are
// "Debug your config: Check common causes" and the hooks and tools references:
// https://code.claude.com/docs/en/debug-your-config#check-common-causes
// https://code.claude.com/docs/en/hooks#pretooluse
// https://code.claude.com/docs/en/tools-reference#check-which-tools-are-available
import { describe, expect, it } from 'vitest'
import { TOOL_EVENTS } from '../../src/data/hook-events.ts'
import { TOOL_NAMES } from '../../src/data/tool-names.ts'
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

const name = 'hooks-matcher-never-matches'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)
const message = (event: string, matcher: string) =>
  lintJson(name, settings(hooks(event, [command()], matcher)), FILES.project)[0]?.message

describe(`${name}: the case of a tool name`, () => {
  it('reports a lowercase and an uppercase name on each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'bash'), event).toEqual(['caseVariant'])
      expect(ids(event, 'WRITE'), event).toEqual(['caseVariant'])
    }
  })

  it('reports a case variant of each built-in tool', () => {
    for (const tool of TOOL_NAMES) {
      expect(
        ids('PreToolUse', tool.toLowerCase() === tool ? tool.toUpperCase() : tool.toLowerCase()),
        tool,
      ).toEqual([tool === 'EndConversation' ? 'endConversation' : 'caseVariant'])
      expect(ids('PreToolUse', tool), tool).toEqual(
        tool === 'EndConversation' ? ['endConversation'] : [],
      )
    }
  })

  it('reports each case variant of a list', () => {
    expect(ids('PreToolUse', 'bash|Edit|write')).toEqual(['caseVariant', 'caseVariant'])
    expect(ids('PreToolUse', 'bash, Edit ,webfetch')).toEqual(['caseVariant', 'caseVariant'])
  })

  it('names the segment and the tool', () => {
    expect(message('PreToolUse', 'bash')).toBe(
      'Tool names are case-sensitive. The matcher "bash" matches no tool. Write "Bash".',
    )
  })

  it('is silent for a correct name, a regular expression and a name that is no tool', () => {
    for (const matcher of [
      'Bash',
      'Edit|Write',
      '^bash$',
      'bash.*',
      'Foo',
      'foo|bar',
      'mcp__memory__x',
      '*',
      '',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
    expect(ids('PreToolUse', undefined)).toEqual([])
  })
})

describe(`${name}: EndConversation`, () => {
  it('reports it on PreToolUse and PostToolUse, which skip that tool', () => {
    for (const event of ['PreToolUse', 'PostToolUse']) {
      expect(ids(event, 'EndConversation'), event).toEqual(['endConversation'])
      expect(ids(event, 'Bash|EndConversation'), event).toEqual(['endConversation'])
    }
  })

  it('names the event and the segment', () => {
    expect(message('PostToolUse', 'EndConversation')).toBe(
      'Claude Code runs no PostToolUse hook for EndConversation, so "EndConversation" never matches.',
    )
  })

  it('is silent on the other tool events, where the docs do not say', () => {
    for (const event of ['PostToolUseFailure', 'PermissionRequest', 'PermissionDenied']) {
      expect(ids(event, 'EndConversation'), event).toEqual([])
    }
  })

  it('reports a case variant as EndConversation where the event skips it', () => {
    // A fix of the case alone still never matches on these two events.
    expect(ids('PreToolUse', 'endconversation')).toEqual(['endConversation'])
    expect(ids('PostToolUse', 'ENDCONVERSATION')).toEqual(['endConversation'])
    expect(message('PreToolUse', 'endconversation')).toBe(
      'Claude Code runs no PreToolUse hook for EndConversation, so "endconversation" never matches.',
    )
  })

  it('reports a case variant on the other tool events as a case variant', () => {
    expect(ids('PermissionRequest', 'endconversation')).toEqual(['caseVariant'])
  })

  it('reads a group that has no hooks array', () => {
    expect(jsonIds(name, settings({ PreToolUse: [{ matcher: 'bash' }] }), FILES.project)).toEqual([
      'caseVariant',
    ])
  })

  it('takes no option', () => {
    expect(() => lintJson(name, settings({}), FILES.project, [{}])).toThrow()
  })
})

describe(`${name}: Advisor`, () => {
  it('reports the advisor tool in either case on each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'Advisor'), event).toEqual(['advisor'])
      expect(ids(event, 'advisor'), event).toEqual(['advisor'])
      expect(ids(event, 'ADVISOR|Edit'), event).toEqual(['advisor'])
    }
  })

  it('names the segment', () => {
    expect(message('PreToolUse', 'advisor')).toBe(
      'The advisor tool has no name that a hook matcher can use, so "advisor" never matches.',
    )
  })
})

describe(`${name}: the events and the files`, () => {
  it('is silent on an event that does not match a tool name', () => {
    for (const event of ['SessionStart', 'SubagentStart', 'Elicitation', 'Stop', 'Bogus']) {
      expect(ids(event, 'bash'), event).toEqual([])
      expect(ids(event, 'advisor'), event).toEqual([])
    }
  })

  it('is silent for a matcher that is no string', () => {
    expect(ids('PreToolUse', ['bash'])).toEqual([])
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "PreToolUse": [{"matcher": "bash", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 32]])
  })

  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PreToolUse', 'bash', file), file).toEqual(['caseVariant'])
      expect(ids('PreToolUse', 'Bash', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `PreToolUse:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('bash'), file), file).toEqual(['caseVariant'])
      expect(markdownIds(name, yaml('Bash'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('PreToolUse', 'bash', FILES.hidden)).toEqual([])
    expect(ids('PreToolUse', 'bash', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
