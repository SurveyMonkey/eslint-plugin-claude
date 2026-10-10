// On Windows, Claude Code can run shell commands through the PowerShell tool and not register Bash
// at all. A hook that matches `Bash` only never fires there. The hooks reference says to match
// `Bash|PowerShell` (https://code.claude.com/docs/en/hooks#powershell).
import { describe, expect, it } from 'vitest'
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

const name = 'hooks-matcher-bash-without-powershell'
const TOOL_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
]
const ids = (event: string, matcher: unknown, file = FILES.project) =>
  jsonIds(name, settings(hooks(event, [command()], matcher)), file)

describe(`${name}: a matcher that names Bash`, () => {
  it('reports Bash alone on each tool event', () => {
    for (const event of TOOL_EVENTS) {
      expect(ids(event, 'Bash'), event).toEqual(['bashOnly'])
    }
  })

  it('reports Bash in a list without PowerShell', () => {
    expect(ids('PreToolUse', 'Bash|Edit')).toEqual(['bashOnly'])
    expect(ids('PreToolUse', 'Edit, Bash')).toEqual(['bashOnly'])
    expect(ids('PreToolUse', 'Edit,Bash,Write')).toEqual(['bashOnly'])
    // A list holds whole names: `Power` is not `PowerShell`.
    expect(ids('PreToolUse', 'Bash|Power')).toEqual(['bashOnly'])
    expect(ids('PreToolUse', 'Edit|B')).toEqual([])
  })

  it('reports a regular expression that selects Bash and not PowerShell', () => {
    for (const matcher of ['^Bash$', 'Bash.*', '(Bash)', '^(Bash|Edit)$', 'Ba.h']) {
      expect(ids('PreToolUse', matcher), matcher).toEqual(['bashOnly'])
    }
  })

  it('is silent when PowerShell is named too', () => {
    for (const matcher of [
      'Bash|PowerShell',
      'PowerShell|Bash',
      'Bash,PowerShell',
      'Bash, PowerShell',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a regular expression that selects both tools', () => {
    for (const matcher of [
      '.*',
      'Bash|PowerShell.*',
      '^(Bash|PowerShell)$',
      '.+Shell|Bash',
      'Bash|Power.*',
    ]) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('tests a regular expression on the name without anchors, and with case', () => {
    // Claude Code does not anchor the expression: `ash.*` selects Bash, and `Shell.*` selects PowerShell.
    expect(ids('PreToolUse', 'ash.*')).toEqual(['bashOnly'])
    expect(ids('PreToolUse', 'Bash|Shell.*')).toEqual([])
    expect(ids('PreToolUse', 'Bash|^powershell$')).toEqual(['bashOnly'])
    expect(ids('PreToolUse', '^bash$')).toEqual([])
  })

  it('is silent for a matcher that does not select Bash', () => {
    for (const matcher of ['Edit|Write', 'PowerShell', 'bash', 'Bashful', '^Edit$', 'Notebook.*']) {
      expect(ids('PreToolUse', matcher), matcher).toEqual([])
    }
  })

  it('is silent for a match-all matcher, or none', () => {
    for (const matcher of [undefined, '', '*']) {
      expect(ids('PreToolUse', matcher), String(matcher)).toEqual([])
    }
  })

  it('is silent for a matcher that is no string, and for one that is no regular expression', () => {
    expect(ids('PreToolUse', ['Bash'])).toEqual([])
    expect(ids('PreToolUse', 7)).toEqual([])
    expect(ids('PreToolUse', 'Bash(')).toEqual([])
    expect(ids('PreToolUse', '[Bash')).toEqual([])
  })

  it('is silent for an event that is no tool event', () => {
    for (const event of ['SessionStart', 'SubagentStart', 'Stop', 'FileChanged', 'Notification']) {
      expect(ids(event, 'Bash'), event).toEqual([])
    }
  })

  it('says what to write', () => {
    const [message] = lintJson(
      name,
      settings(hooks('PreToolUse', [command()], 'Bash')),
      FILES.project,
    )
    expect(message?.message).toBe(
      'This matcher selects Bash and not PowerShell. On Windows, Claude Code can run shell commands through PowerShell, and this hook can fire on no Bash call there. Write "Bash|PowerShell".',
    )
  })

  it('reports at the matcher value', () => {
    const text = '{\n  "hooks": {\n    "PreToolUse": [{"matcher": "Bash", "hooks": []}]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 32]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids('PreToolUse', 'Bash', file), file).toEqual(['bashOnly'])
      expect(ids('PreToolUse', 'Bash|PowerShell', file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (matcher: string) =>
      frontmatter(
        `PreToolUse:\n  - matcher: ${matcher}\n    hooks:\n      - type: command\n        command: c\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('Bash'), file), file).toEqual(['bashOnly'])
      expect(markdownIds(name, yaml('Bash|PowerShell'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids('PreToolUse', 'Bash', FILES.hidden)).toEqual([])
    expect(ids('PreToolUse', 'Bash', '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
