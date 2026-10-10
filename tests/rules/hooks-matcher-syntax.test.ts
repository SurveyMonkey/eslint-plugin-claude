// How Claude Code reads a matcher: exact values when it holds exact-match characters only, and a
// JavaScript regular expression when it holds any other character. `FileChanged` and `StopFailure`
// have a narrower exact set, and `FileChanged` watches each value as a file name. The docs are
// the hooks reference, "Matcher patterns" and "FileChanged", and the tools reference, "Configure
// tools with permission rules and hooks".
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS, NO_MATCHER_EVENTS, TOOL_EVENTS } from '../../src/data/hook-events.ts'
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

const name = 'hooks-matcher-syntax'
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)
const message = (event: string, matcher: string) =>
  lintJson(name, settings(hooks(event, [command()], matcher)), FILES.project)[0]?.message

// The events that read a matcher as a regular expression when it has another character.
const REGEX_EVENTS = HOOK_EVENTS.filter(
  (event) => event !== 'FileChanged' && !NO_MATCHER_EVENTS.includes(event),
)

describe(`${name}: the Tool(specifier) form`, () => {
  it('reports it on each tool event, and names the if field', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'Bash(rm *)'), event).toEqual(['toolSpec'])
    }
    expect(message('PreToolUse', 'Edit(*.ts)')).toBe(
      'A matcher holds a bare tool name, not "Tool(specifier)". Match the arguments with the "if" field of the handler.',
    )
  })

  it('reports other shapes of the form', () => {
    for (const matcher of [
      'Read(~/secrets/**)',
      'mcp__memory__x(y)',
      'WebFetch(domain:example.com)',
      'Bash()',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual(['toolSpec'])
    }
  })

  it('is silent for a regular expression with a group and for a bare tool name', () => {
    for (const matcher of ['Bash', '(Edit|Write)', '^(Edit|Write)$', 'Edit.*(ts)$', 'Bash|Edit(']) {
      expect(ids('PreToolUse', matcher), matcher).not.toContain('toolSpec')
    }
  })

  it('is silent on an event that does not match a tool name', () => {
    expect(ids('SubagentStart', 'Bash(rm *)')).toEqual([])
    expect(ids('Elicitation', 'Foo(bar)')).toEqual([])
  })
})

describe(`${name}: a regular expression that does not compile`, () => {
  it('reports it on each event that reads a regular expression', () => {
    for (const event of REGEX_EVENTS) {
      expect(ids(event, '(unclosed'), event).toEqual(['invalid'])
    }
  })

  it('reports other faults of the pattern', () => {
    for (const matcher of ['[a-', '*abc', 'a{2,1}', '(?<n', 'Bash(rm *', 'x\\']) {
      expect(ids('PreToolUse', matcher), matcher).toEqual(['invalid'])
    }
  })

  it('names the reason', () => {
    expect(message('PreToolUse', '(unclosed')).toContain(
      'The matcher is not a valid regular expression:',
    )
  })

  it('is silent for a valid pattern, for exact values and for match-all', () => {
    for (const matcher of [
      '^Notebook',
      'mcp__memory__.*',
      'Edit.*',
      'Bash|Edit',
      '*',
      '',
      '(a|b)+',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
    expect(ids('PreToolUse', undefined)).toEqual([])
  })

  it('is silent on events without matcher support and on a name that is not an event', () => {
    for (const event of NO_MATCHER_EVENTS) {
      expect(ids(event, '(unclosed'), event).toEqual([])
    }
    expect(ids('Bogus', '(unclosed')).toEqual([])
  })

  it('is silent for a matcher that is no string', () => {
    expect(ids('PreToolUse', ['(unclosed'])).toEqual([])
  })
})

describe(`${name}: StopFailure`, () => {
  it('reports a comma, a space or a hyphen, which do not split the matcher', () => {
    expect(ids('StopFailure', 'rate_limit, overloaded')).toEqual(['separator'])
    expect(ids('StopFailure', 'rate_limit,overloaded')).toEqual(['separator'])
    expect(ids('StopFailure', 'rate_limit overloaded')).toEqual(['separator'])
    expect(ids('StopFailure', 'rate-limit')).toEqual(['separator'])
  })

  it('names the event and the character', () => {
    expect(message('StopFailure', 'a,b')).toBe(
      'On StopFailure only "|" separates values. A comma is part of the value, not a separator.',
    )
    expect(message('StopFailure', 'a b')).toContain('A space is part')
    expect(message('StopFailure', 'a-b')).toContain('A hyphen is part')
  })

  it('is silent for "|", and for a regular expression', () => {
    for (const matcher of [
      'rate_limit|overloaded',
      'rate_limit',
      '^rate_limit',
      'rate.*,x',
      '*',
      '',
    ]) {
      expect(ids('StopFailure', matcher), matcher).toEqual([])
    }
  })

  it('reports a regular expression that does not compile', () => {
    expect(ids('StopFailure', '(unclosed')).toEqual(['invalid'])
  })

  it('leaves a comma on another event, where it separates', () => {
    expect(ids('SessionStart', 'startup, resume')).toEqual([])
    expect(ids('SessionStart', 'startup-x')).toEqual([])
  })
})

describe(`${name}: FileChanged`, () => {
  it('reports a comma or a space around a value, which are part of the file name', () => {
    expect(ids('FileChanged', '.envrc,.env')).toEqual(['separator'])
    expect(ids('FileChanged', '.envrc, .env')).toEqual(['separator'])
    expect(ids('FileChanged', '.envrc| .env')).toEqual(['separator'])
    expect(ids('FileChanged', '.envrc |.env')).toEqual(['separator'])
    expect(message('FileChanged', 'a,b')).toBe(
      'On FileChanged only "|" separates values. A comma is part of the value, not a separator.',
    )
    expect(message('FileChanged', 'a |b')).toContain('A space is part')
  })

  it('reports a regular expression character, which Claude Code watches as a literal name', () => {
    for (const matcher of [
      '^\\.env',
      '*.env',
      '.env*',
      '.env$',
      'a+b',
      'a?b',
      '(a)',
      '[a]',
      '{a}',
      'a\\b',
    ]) {
      expect(ids('FileChanged', matcher), matcher).toEqual(['literal'])
    }
    expect(message('FileChanged', '*.env')).toBe(
      'FileChanged watches each segment as a literal file name. The segment "*.env" holds a regular expression character. Claude Code watches a file with that exact name.',
    )
  })

  it('reports each segment with such a character', () => {
    expect(ids('FileChanged', '.envrc|*.env|^x')).toEqual(['literal', 'literal'])
  })

  it('reports a comma and a character together as two faults', () => {
    expect(ids('FileChanged', '.envrc, *.env')).toEqual(['separator', 'literal'])
  })

  it('is silent for file names, a hyphen, a dot, and the star matcher', () => {
    for (const matcher of [
      '.envrc|.env',
      'data.csv',
      'docker-compose.yml',
      'my file',
      '*',
      '',
      '.env|*',
    ]) {
      expect(ids('FileChanged', matcher), matcher).toEqual([])
    }
    expect(ids('FileChanged', undefined)).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "PreToolUse": [{"matcher": "(x", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 32]])
  })

  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PreToolUse', '(x', file), file).toEqual(['invalid'])
      expect(ids('PreToolUse', 'Bash', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `PreToolUse:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('"(x"'), file), file).toEqual(['invalid'])
      expect(markdownIds(name, yaml('Bash'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('PreToolUse', '(x', FILES.hidden)).toEqual([])
    expect(ids('PreToolUse', '(x', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
