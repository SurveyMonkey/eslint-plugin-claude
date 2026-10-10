// A PowerShell shell-form hook reads `${CLAUDE_PROJECT_DIR}` and `$env:CLAUDE_PROJECT_DIR`. The bare
// `$CLAUDE_PROJECT_DIR` is an undefined local variable and gives `$null`. A path placeholder inside
// single quotes is not expanded, because PowerShell expands no variable there
// (https://code.claude.com/docs/en/hooks#windows-powershell-tool).
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
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-powershell-placeholder'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('Stop', [handler])), file)
const power = (text: string, fields: Record<string, unknown> = {}) =>
  ids(command({ command: text, shell: 'powershell', ...fields }))
const dir = (form: string) => `\${${form}}`

describe(`${name}: the bare variable`, () => {
  it.fails('reports $CLAUDE_PROJECT_DIR in a PowerShell command', () => {
    for (const text of [
      '& $CLAUDE_PROJECT_DIR\\.claude\\check.ps1',
      '& "$CLAUDE_PROJECT_DIR\\.claude\\check.ps1"',
      'Write-Host $CLAUDE_PROJECT_DIR',
      '$CLAUDE_PROJECT_DIR',
    ]) {
      expect(power(text), text).toEqual(['bare'])
    }
  })

  it.fails('is silent for the forms that Claude Code and PowerShell expand', () => {
    for (const text of [
      `& "${dir('CLAUDE_PROJECT_DIR')}\\check.ps1"`,
      '& "$env:CLAUDE_PROJECT_DIR\\check.ps1"',
      '& "$($env:CLAUDE_PROJECT_DIR)\\check.ps1"',
      'Write-Host $CLAUDE_PROJECT_DIR_OTHER',
      'Write-Host $CLAUDE_PLUGIN_ROOT',
      'Write-Host CLAUDE_PROJECT_DIR',
      'Write-Host `$CLAUDE_PROJECT_DIR',
      "Write-Host '$CLAUDE_PROJECT_DIR'",
      '',
    ]) {
      expect(power(text), text).toEqual([])
    }
  })
})

describe(`${name}: a placeholder in single quotes`, () => {
  it.fails('reports each of the three placeholders inside single quotes', () => {
    for (const variable of ['CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_PLUGIN_DATA']) {
      expect(power(`& '${dir(variable)}\\check.ps1'`), variable).toEqual(['quoted'])
    }
  })

  it.fails('reads the quoting of PowerShell', () => {
    const p = dir('CLAUDE_PROJECT_DIR')
    // A doubled single quote stays inside the string.
    expect(power(`Write-Host 'it''s ${p}'`)).toEqual(['quoted'])
    // A string that is not closed runs to the end.
    expect(power(`Write-Host '${p}`)).toEqual(['quoted'])
    // A backslash is no escape in PowerShell.
    expect(power(`Write-Host '\\' '${p}'`)).toEqual(['quoted'])
    // A single quote in double quotes opens no string.
    expect(power(`Write-Host "it's ${p}"`)).toEqual([])
    // A doubled double quote and a backtick stay inside the double-quoted string.
    expect(power(`Write-Host "a""'${p}"`)).toEqual([])
    expect(power(`Write-Host "a\`"'${p}"`)).toEqual([])
    // A backtick outside a string escapes the quote.
    expect(power(`Write-Host \`'${p}`)).toEqual([])
    // Text between two strings is outside both.
    expect(power(`Write-Host 'a' ${p} 'b'`)).toEqual([])
    expect(power(`Write-Host '${p}' "${p}"`)).toEqual(['quoted'])
    // A backtick is literal in single quotes.
    expect(power(`Write-Host 'a\`' ${p} 'b'`)).toEqual([])
  })

  it.fails('reports a bare variable and a quoted placeholder once each', () => {
    expect(
      power(
        `Write-Host $CLAUDE_PROJECT_DIR '${dir('CLAUDE_PLUGIN_ROOT')}' '${dir('CLAUDE_PLUGIN_DATA')}'`,
      ),
    ).toEqual(['bare', 'quoted'])
  })
})

describe(`${name}: the messages`, () => {
  it.fails('names the fault and reports at the command string', () => {
    const text = (value: string) =>
      `{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "shell": "powershell", "command": ${JSON.stringify(value)}}]}]}\n}`
    const bare = lintJson(name, text('& $CLAUDE_PROJECT_DIR\\a.ps1'), FILES.project)
    expect(bare.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['bare', 2, 87],
    ])
    expect(bare[0]?.message).toBe(
      `PowerShell reads "$CLAUDE_PROJECT_DIR" as an undefined variable, and it gives $null. Write "\${CLAUDE_PROJECT_DIR}" or "$env:CLAUDE_PROJECT_DIR".`,
    )
    const quoted = lintJson(name, text(`& '${dir('CLAUDE_PLUGIN_ROOT')}\\a.ps1'`), FILES.project)
    expect(quoted[0]?.message).toBe(
      `PowerShell does not expand "\${CLAUDE_PLUGIN_ROOT}" inside single quotes. Use double quotes.`,
    )
  })
})

describe(`${name}: the handlers and the files`, () => {
  it.fails('is silent with no shell key, with another shell, and in exec form', () => {
    const text = '& $CLAUDE_PROJECT_DIR\\a.ps1'
    expect(ids(command({ command: text }))).toEqual([])
    expect(ids(command({ command: text, shell: 'bash' }))).toEqual([])
    expect(ids(command({ command: text, shell: 5 }))).toEqual([])
    // `shell` is ignored when `args` is set.
    expect(power(text, { args: ['x'] })).toEqual([])
  })

  it.fails('reads a command handler with a string command only', () => {
    expect(ids({ type: 'http', shell: 'powershell', command: '$CLAUDE_PROJECT_DIR' })).toEqual([])
    expect(ids({ shell: 'powershell', command: '$CLAUDE_PROJECT_DIR' })).toEqual([])
    expect(ids({ type: 'command', shell: 'powershell', command: 5 })).toEqual([])
  })

  it.fails('reads every settings file, hooks.json, a skill and a project subagent', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(
        ids(command({ command: '$CLAUDE_PROJECT_DIR', shell: 'powershell' }), file),
        file,
      ).toEqual(['bare'])
    }
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        shell: powershell\n        command: "& $CLAUDE_PROJECT_DIR"\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual(['bare'])
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['bare'])
  })

  it.fails('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(
      ids(command({ command: '$CLAUDE_PROJECT_DIR', shell: 'powershell' }), FILES.hidden),
    ).toEqual([])
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        shell: powershell\n        command: "& $CLAUDE_PROJECT_DIR"\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it.fails('is silent on a config that is malformed', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
  })
})
