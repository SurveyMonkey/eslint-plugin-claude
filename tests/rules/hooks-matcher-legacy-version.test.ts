// A matcher form that an older Claude Code reads in another way, or does not know. The rule reads the
// option `minVersion`, the oldest version that the team supports, and reports nothing without it. The
// facts are in the hooks reference, "Matcher patterns" and "Notification"
// (https://code.claude.com/docs/en/hooks#matcher-patterns), and in the Claude Code changelog.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-matcher-legacy-version'
const ids = (event: string, matcher: unknown, minVersion?: string, file = FILES.project) =>
  lintJson(
    name,
    settings(hooks(event, [command()], matcher)),
    file,
    minVersion === undefined ? [] : [{ minVersion }],
  ).map((message) => message.messageId)

/** The message ids of the rule for Markdown text, with the option `minVersion`. */
const lintMd = (code: string, file: string, minVersion: string) =>
  new Linter({ cwd: '/' })
    .verify(
      code,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          languageOptions: { frontmatter: 'yaml' },
          rules: { [`claude/${name}`]: ['error', { minVersion }] },
        },
      ],
      { filename: file },
    )
    .map((message) => message.messageId)

describe(`${name}: the option`, () => {
  it.fails('reports nothing when minVersion is unset', () => {
    expect(ids('SubagentStart', 'code-reviewer')).toEqual([])
    expect(ids('PreToolUse', 'Edit,Write')).toEqual([])
    expect(ids('StopFailure', 'cloud_credential_error')).toEqual([])
    expect(ids('Notification', 'quota_auto_resume_fired')).toEqual([])
    expect(
      lintJson(name, settings(hooks('SubagentStart', [command()], 'a-b')), FILES.project, [{}]),
    ).toEqual([])
  })

  it.fails('refuses a value that is no version, and an option that is not known', () => {
    const lint = (options: object) =>
      lintJson(name, settings(hooks('Stop', [command()])), FILES.project, [options])
    for (const minVersion of ['abc', '2.1', '2.1.x', 'v2.1.100', '2.1.100-beta', 7, '']) {
      expect(() => lint({ minVersion }), String(minVersion)).toThrow(/is invalid/)
    }
    expect(() => lint({ typo: '2.1.1' })).toThrow(/is invalid/)
  })

  it.fails('compares each part of the version as a number', () => {
    expect(ids('SubagentStart', 'a-b', '2.1.9')).toEqual(['hyphen'])
    expect(ids('SubagentStart', 'a-b', '2.0.999')).toEqual(['hyphen'])
    expect(ids('SubagentStart', 'a-b', '1.9.9')).toEqual(['hyphen'])
    expect(ids('SubagentStart', 'a-b', '2.1.1000')).toEqual([])
    expect(ids('SubagentStart', 'a-b', '2.10.0')).toEqual([])
    expect(ids('SubagentStart', 'a-b', '3.0.0')).toEqual([])
  })
})

describe(`${name}: a hyphenated name, before v2.1.195`, () => {
  it.fails('reports a hyphenated name below the version, and not at it or above', () => {
    expect(ids('SubagentStart', 'code-reviewer', '2.1.194')).toEqual(['hyphen'])
    expect(ids('SubagentStart', 'code-reviewer', '2.1.195')).toEqual([])
    expect(ids('SubagentStop', 'code-reviewer', '2.1.196')).toEqual([])
  })

  it.fails('reads the tool events, and any other event with a free matcher', () => {
    expect(ids('PreToolUse', 'mcp__brave-search__search', '2.1.194')).toEqual(['hyphen'])
    expect(ids('PermissionDenied', 'my-tool', '2.1.194')).toEqual(['hyphen'])
    expect(ids('UserPromptExpansion', 'my-command', '2.1.194')).toEqual(['hyphen'])
  })

  it.fails('reports each hyphenated segment of a list', () => {
    expect(ids('SubagentStart', 'a-b|plain|c-d', '2.1.194')).toEqual(['hyphen', 'hyphen'])
  })

  it.fails('is silent for an anchored name, which is a regular expression', () => {
    expect(ids('SubagentStart', '^code-reviewer$', '2.1.194')).toEqual([])
    expect(ids('PreToolUse', 'mcp__brave-search__.*', '2.1.194')).toEqual([])
  })

  it.fails('is silent for a name with no hyphen, and for a match-all matcher', () => {
    for (const matcher of ['reviewer', undefined, '', '*']) {
      expect(ids('SubagentStart', matcher, '2.1.194'), String(matcher)).toEqual([])
    }
  })

  it.fails('is silent where another rule owns the hyphen', () => {
    // The events with a fixed set: hooks-matcher-enum. FileChanged and StopFailure: hooks-matcher-syntax.
    // The events without matcher support: hooks-matcher-unsupported-event.
    for (const event of ['SessionStart', 'Notification', 'FileChanged', 'StopFailure', 'Stop']) {
      expect(ids(event, 'a-b', '2.1.194'), event).toEqual([])
    }
  })

  it.fails('names the segment, the version and the option', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SubagentStart', [command()], 'code-reviewer')),
      FILES.project,
      [{ minVersion: '2.1.150' }],
    )
    expect(message?.message).toBe(
      'Before v2.1.195, Claude Code matched the hyphenated name "code-reviewer" as a substring. The option minVersion is 2.1.150. Write "^code-reviewer$".',
    )
  })
})

describe(`${name}: a comma, before v2.1.191`, () => {
  it.fails('reports a comma list below the version, and not at it or above', () => {
    expect(ids('PreToolUse', 'Bash,PowerShell', '2.1.190')).toEqual(['comma'])
    expect(ids('PreToolUse', 'Bash, PowerShell', '2.1.190')).toEqual(['comma'])
    expect(ids('PreToolUse', 'Bash,PowerShell', '2.1.191')).toEqual([])
    expect(ids('PreToolUse', 'Bash,PowerShell', '2.1.192')).toEqual([])
  })

  it.fails('reports one comma list once, and also on an event with a fixed set', () => {
    expect(ids('PreToolUse', 'A,B,C', '2.1.190')).toEqual(['comma'])
    expect(ids('SessionStart', 'startup,resume', '2.1.190')).toEqual(['comma'])
    expect(ids('SubagentStart', 'a,b', '2.1.190')).toEqual(['comma'])
  })

  it.fails('is silent for a "|" list, a regular expression and a match-all matcher', () => {
    for (const matcher of ['Bash|PowerShell', 'Bash.*,x', undefined, '', '*']) {
      expect(ids('PreToolUse', matcher, '2.1.190'), String(matcher)).toEqual([])
    }
  })

  it.fails('is silent where another rule owns the comma', () => {
    for (const event of ['FileChanged', 'StopFailure', 'Stop', 'CwdChanged']) {
      expect(ids(event, 'a,b', '2.1.190'), event).toEqual([])
    }
  })

  it.fails('names the version and the option', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreToolUse', [command()], 'Bash,PowerShell')),
      FILES.project,
      [{ minVersion: '2.1.100' }],
    )
    expect(message?.message).toBe(
      'Before v2.1.191, a hook matcher with a comma never fired. The option minVersion is 2.1.100. Separate the values with "|".',
    )
  })
})

describe(`${name}: a value that a later version sends`, () => {
  it.fails('reports cloud_credential_error on StopFailure before v2.1.267', () => {
    expect(ids('StopFailure', 'cloud_credential_error', '2.1.266')).toEqual(['value'])
    expect(ids('StopFailure', 'rate_limit|cloud_credential_error', '2.1.266')).toEqual(['value'])
    expect(ids('StopFailure', 'cloud_credential_error', '2.1.267')).toEqual([])
    expect(ids('StopFailure', 'cloud_credential_error', '2.1.268')).toEqual([])
  })

  it.fails('is silent for another StopFailure value, and for the value on another event', () => {
    expect(ids('StopFailure', 'rate_limit', '2.1.100')).toEqual([])
    expect(ids('SessionStart', 'cloud_credential_error', '2.1.100')).toEqual([])
  })

  it.fails('reports each quota_auto_resume value on Notification before v2.1.234', () => {
    for (const value of [
      'quota_auto_resume_fired',
      'quota_auto_resume_stale',
      'quota_auto_resume_disabled',
    ]) {
      expect(ids('Notification', value, '2.1.233'), value).toEqual(['value'])
      expect(ids('Notification', value, '2.1.234'), value).toEqual([])
      expect(ids('Notification', value, '2.1.235'), value).toEqual([])
    }
  })

  it.fails('reports each such value of a list', () => {
    expect(
      ids('Notification', 'idle_prompt|quota_auto_resume_fired|quota_auto_resume_stale', '2.1.233'),
    ).toEqual(['value', 'value'])
  })

  it.fails('is silent for another Notification value', () => {
    expect(ids('Notification', 'idle_prompt', '2.1.100')).toEqual([])
    expect(ids('PreToolUse', 'quota_auto_resume_fired', '2.1.100')).toEqual([])
  })

  it.fails('is silent for a regular expression and for a match-all matcher', () => {
    expect(ids('Notification', 'quota_auto_resume_.*', '2.1.100')).toEqual([])
    expect(ids('StopFailure', undefined, '2.1.100')).toEqual([])
    expect(ids('StopFailure', '*', '2.1.100')).toEqual([])
  })

  it.fails('names the value, the event, the version and the option', () => {
    const [message] = lintJson(
      name,
      settings(hooks('StopFailure', [command()], 'cloud_credential_error')),
      FILES.project,
      [{ minVersion: '2.1.200' }],
    )
    expect(message?.message).toBe(
      'Claude Code sends "cloud_credential_error" on StopFailure from v2.1.267. The option minVersion is 2.1.200.',
    )
  })
})

describe(`${name}: the files`, () => {
  it.fails('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('SubagentStart', 'a-b', '2.1.1', file), file).toEqual(['hyphen'])
      expect(ids('SubagentStart', 'a-b', '2.1.195', file), file).toEqual([])
    }
  })

  it.fails('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = frontmatter(
      'SubagentStart:\n  - matcher: a-b\n    hooks:\n      - type: command\n        command: c\n',
    )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(lintMd(yaml, file, '2.1.1'), file).toEqual(['hyphen'])
      expect(lintMd(yaml, file, '2.1.195'), file).toEqual([])
      expect(markdownIds(name, yaml, file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('SubagentStart', 'a-b', '2.1.1', FILES.hidden)).toEqual([])
    expect(ids('SubagentStart', 'a-b', '2.1.1', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
