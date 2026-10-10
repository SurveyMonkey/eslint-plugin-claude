// An MCP tool is named `mcp__<server>__<tool>`. A matcher with exact-match characters only is an
// exact string, so a bare server name matches no tool. The docs are the hooks reference, "Match MCP
// tools" (https://code.claude.com/docs/en/hooks#match-mcp-tools).
import { describe, expect, it } from 'vitest'
import { TOOL_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-matcher-mcp-name'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: the matcher`, () => {
  it('reports a bare server name on each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'mcp__memory'), event).toEqual(['bare'])
    }
  })

  it('reports a server name with a hyphen, a plugin-scoped server and a prefix alone', () => {
    for (const matcher of ['mcp__brave-search', 'mcp__plugin_my-plugin_db', 'mcp__']) {
      expect(ids('PreToolUse', matcher), matcher).toEqual(['bare'])
    }
  })

  it('reports a server name with a trailing separator and no tool', () => {
    expect(ids('PreToolUse', 'mcp__memory__')).toEqual(['bare'])
  })

  it('reports each bare server of a list, and keeps the other segments apart', () => {
    expect(ids('PreToolUse', 'Edit|mcp__memory')).toEqual(['bare'])
    expect(ids('PreToolUse', 'mcp__a, mcp__b__x ,mcp__c')).toEqual(['bare', 'bare'])
  })

  it('is silent for a full tool name, even one with more separators', () => {
    for (const matcher of [
      'mcp__memory__create_entities',
      'mcp__plugin_my-plugin_db__query',
      'mcp__a__b__c',
      'Edit|mcp__memory__create_entities',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a regular expression, which can select all the tools of a server', () => {
    for (const matcher of [
      'mcp__memory__.*',
      'mcp__.*__write.*',
      '^mcp__memory',
      'mcp__memory.*',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a name that is no MCP name, and for match-all', () => {
    for (const matcher of ['Bash', 'mcp_memory', 'xmcp__memory', '*', '', undefined]) {
      expect(ids('PreToolUse', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent on an event that does not match a tool name', () => {
    for (const event of ['Elicitation', 'SubagentStart', 'Notification', 'Stop', 'Bogus']) {
      expect(ids(event, 'mcp__memory'), event).toEqual([])
    }
  })

  it('is silent for a matcher that is no string', () => {
    expect(ids('PreToolUse', ['mcp__memory'])).toEqual([])
  })

  it('names the segment and the fix', () => {
    const run = (matcher: string) =>
      lintJson(name, settings(hooks('PreToolUse', [command()], matcher)), FILES.project)[0]?.message
    expect(run('mcp__memory')).toBe(
      'The matcher "mcp__memory" names an MCP server and no tool, so it matches no tool. Write "mcp__memory__.*".',
    )
    expect(run('mcp__memory__')).toBe(
      'The matcher "mcp__memory__" names an MCP server and no tool, so it matches no tool. Write "mcp__memory__.*".',
    )
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "PreToolUse": [{"matcher": "mcp__x", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 32]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PreToolUse', 'mcp__memory', file), file).toEqual(['bare'])
      expect(ids('PreToolUse', 'mcp__memory__.*', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `PreToolUse:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('mcp__memory'), file), file).toEqual(['bare'])
      expect(markdownIds(name, yaml('"mcp__memory__.*"'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('PreToolUse', 'mcp__memory', FILES.hidden)).toEqual([])
    expect(ids('PreToolUse', 'mcp__memory', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
