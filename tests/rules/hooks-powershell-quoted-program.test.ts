// PowerShell prints a `command` that is only quoted strings, and does not run it. The hook then
// starts no program (https://code.claude.com/docs/en/hooks#powershell-started-no-program). The
// program path forms come from that block and from "Reference scripts by path in PowerShell
// hooks" (https://code.claude.com/docs/en/hooks#reference-scripts-by-path-in-powershell-hooks).
import { describe, expect, it } from 'vitest'
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

const name = 'hooks-powershell-quoted-program'
const ids = (handler: object, platforms?: string[], file = FILES.project) =>
  lintJson(
    name,
    settings(hooks('PreToolUse', [handler], 'Bash')),
    file,
    platforms === undefined ? [] : [{ platforms }],
  ).map((message) => message.messageId)
const power = (text: string, fields: Record<string, unknown> = {}) =>
  ids(command({ command: text, shell: 'powershell', ...fields }))
const dir = (variable: string) => `\${${variable}}`
/** The path that the message names, for a `command` with `"shell": "powershell"`. */
const pathOf = (text: string) =>
  lintJson(
    name,
    settings(hooks('Stop', [command({ shell: 'powershell', command: text })])),
    FILES.project,
  ).map((message) => /to run "(.*)"\.$/s.exec(message.message)?.[1])

describe(`${name}: the docs example and the validate probe`, () => {
  it('reports a quoted .exe path with shell powershell', () => {
    expect(power('"C:\\Tools\\guard.exe"')).toEqual(['quoted'])
  })

  it('reports a quoted path under the plugin root placeholder that ends in .exe', () => {
    expect(power(`"${dir('CLAUDE_PLUGIN_ROOT')}\\bin\\guard.exe"`)).toEqual(['quoted'])
  })

  it('names the path in the message, at the command string', () => {
    const code = settings(
      hooks('Stop', [command({ shell: 'powershell', command: '"C:\\Tools\\guard.exe"' })]),
    )
    const [message] = lintJson(name, code, FILES.project)
    expect(message?.message).toBe(
      'PowerShell prints a command that is only quoted strings, and starts no program. Put "&" before the quoted path to run "C:\\Tools\\guard.exe".',
    )
    const start = code.indexOf('"\\"C:')
    expect(message?.column).toBe(start + 1)
    expect(message?.endColumn).toBe(code.indexOf(',"shell"') + 1)
  })
})

describe(`${name}: the program path forms of the docs`, () => {
  it('reports each ending that the docs name, in any case', () => {
    for (const text of ['"guard.exe"', '"check.ps1"', '"run.cmd"', '"run.bat"', '"GUARD.EXE"']) {
      expect(power(text), text).toEqual(['quoted'])
    }
  })

  it('reports a drive letter path with no file type, in any case', () => {
    expect(power('"D:/tools/guard"')).toEqual(['quoted'])
    expect(power('"d:\\tools\\guard"')).toEqual(['quoted'])
  })

  it('reports a path under $HOME, an $env: variable or a path placeholder', () => {
    for (const text of [
      '"$HOME\\bin\\guard"',
      '"$env:CLAUDE_PROJECT_DIR\\.claude\\hooks\\guard"',
      `"${dir('CLAUDE_PROJECT_DIR')}\\.claude\\hooks\\guard"`,
      `"${dir('CLAUDE_PLUGIN_ROOT')}/bin/guard"`,
      `"${dir('CLAUDE_PLUGIN_DATA')}/bin/guard"`,
    ]) {
      expect(power(text), text).toEqual(['quoted'])
    }
  })

  it('is silent for the forms that no docs block shows', () => {
    for (const text of ['"guard.com"', '"~\\bin\\guard"', '"./guard"', '"../bin/guard"']) {
      expect(power(text), text).toEqual([])
    }
  })

  it('reads $HOME, $env: and a path placeholder in double quotes only', () => {
    // The docs say that a placeholder works in double quotes only. PowerShell expands no
    // variable in single quotes.
    for (const text of [
      "'$HOME\\bin\\guard'",
      "'$env:CLAUDE_PROJECT_DIR\\.claude\\hooks\\guard'",
      `'${dir('CLAUDE_PLUGIN_ROOT')}/bin/guard'`,
    ]) {
      expect(power(text), text).toEqual([])
    }
    expect(power(`'${dir('CLAUDE_PLUGIN_ROOT')}\\bin\\guard.exe'`)).toEqual(['quoted'])
  })

  it('is silent for a text with a path form after its start, or a file type before its end', () => {
    for (const text of [
      '"Saved to $HOME/out.txt"',
      '"see notes.bat.txt"',
      '"A: ok"',
      '"note x:\\y"',
    ]) {
      expect(power(text), text).toEqual([])
    }
  })

  it('is silent for a root with no path after it', () => {
    for (const text of ['"$HOME"', '"$env:CLAUDE_PROJECT_DIR"', `"${dir('CLAUDE_PLUGIN_ROOT')}"`]) {
      expect(power(text), text).toEqual([])
    }
  })
})

describe(`${name}: the quoted strings`, () => {
  it('reports a single-quoted path, and white space around the string', () => {
    expect(power("'C:\\Tools\\guard.exe'")).toEqual(['quoted'])
    expect(power('  "C:\\Tools\\guard.exe"\n')).toEqual(['quoted'])
  })

  it('reads the first of more than one string', () => {
    expect(power('"C:\\Tools\\guard.exe" "--fix"')).toEqual(['quoted'])
    expect(power('"hello" "C:\\Tools\\guard.exe"')).toEqual([])
  })

  it('reads the quote rules of PowerShell', () => {
    // A doubled quote and a backtick stay inside a double-quoted string.
    expect(pathOf('"C:\\a""b.exe"')).toEqual(['C:\\a"b.exe'])
    expect(pathOf('"C:\\a`"b.exe"')).toEqual(['C:\\a"b.exe'])
    // A doubled single quote stays inside a single-quoted string, and a backtick is plain there.
    expect(pathOf("'C:\\it''s.exe'")).toEqual(["C:\\it's.exe"])
    expect(power("'C:\\a`' 'b.exe'")).toEqual(['quoted'])
  })

  it('is silent for a string that is not closed', () => {
    expect(power('"C:\\Tools\\guard.exe')).toEqual([])
    expect(power('"C:\\Tools\\guard.exe`"')).toEqual([])
    expect(power('"C:\\Tools\\guard.exe`')).toEqual([])
  })

  it('is silent for text next to a closing quote, or between strings', () => {
    for (const text of [
      '"C:\\Tools\\guard.exe"x',
      '"C:\\Tools\\guard.exe"\'a\'',
      '"C:\\Tools\\guard.exe" --fix',
      '"C:\\Tools\\guard.exe"; exit 0',
    ]) {
      expect(power(text), text).toEqual([])
    }
  })

  it('is silent for an empty command', () => {
    for (const text of ['', '   ', '""']) {
      expect(power(text), JSON.stringify(text)).toEqual([])
    }
  })
})

describe(`${name}: the commands that run a program or print text`, () => {
  it('is silent with & or . before the quoted path', () => {
    for (const text of [
      '& "C:\\Tools\\guard.exe"',
      '. "C:\\Tools\\check.ps1"',
      '& "$env:CLAUDE_PROJECT_DIR\\.claude\\hooks\\check.ps1"',
    ]) {
      expect(power(text), text).toEqual([])
    }
  })

  it('is silent for a path with no quotes', () => {
    expect(power('C:\\Tools\\guard.exe')).toEqual([])
  })

  it('is silent for a quoted JSON text', () => {
    expect(power(`'{"decision":"block","reason":"x"}'`)).toEqual([])
    expect(power('"{""continue"":true}"')).toEqual([])
  })
})

describe(`${name}: the handler`, () => {
  it('is silent in exec form', () => {
    expect(power('"C:\\Tools\\guard.exe"', { args: [] })).toEqual([])
  })

  it('reads args that is no array as shell form', () => {
    expect(power('"C:\\Tools\\guard.exe"', { args: 'x' })).toEqual(['quoted'])
  })

  it('is silent with shell bash, for a handler that is not a command hook, and for a command that is not a string', () => {
    expect(power('"C:\\Tools\\guard.exe"', { shell: 'bash' })).toEqual([])
    expect(power('"C:\\Tools\\guard.exe"', { type: 'http' })).toEqual([])
    expect(ids({ type: 'command', shell: 'powershell', command: 1 })).toEqual([])
  })

  it('reports in each settings file, a plugin hooks.json, a skill and an agent', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(
        ids(command({ shell: 'powershell', command: '"C:\\x.exe"' }), undefined, file),
        file,
      ).toEqual(['quoted'])
    }
    const yaml = `Stop:\n  - hooks:\n      - type: command\n        shell: powershell\n        command: '"C:\\Tools\\guard.exe"'\n`
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, frontmatter(yaml), file), file).toEqual(['quoted'])
    }
  })
})

describe(`${name}: no shell key and the option platforms`, () => {
  const unset = (platforms?: string[], fields: Record<string, unknown> = {}) =>
    ids(command({ command: '"C:\\Tools\\guard.exe"', ...fields }), platforms)

  it('is silent when platforms is unset or names no PowerShell default', () => {
    expect(unset()).toEqual([])
    expect(unset([])).toEqual([])
    expect(unset(['linux', 'windows-git-bash'])).toEqual([])
  })

  it('reports when platforms holds windows-no-git-bash', () => {
    expect(unset(['windows-no-git-bash'])).toEqual(['unset'])
    expect(unset(['macos', 'windows-no-git-bash'])).toEqual(['unset'])
  })

  it('is silent with any shell key', () => {
    expect(unset(['windows-no-git-bash'], { shell: 'bash' })).toEqual([])
    expect(unset(['windows-no-git-bash'], { shell: 1 })).toEqual([])
  })

  it('names the platform and the fix in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: '"C:\\Tools\\guard.exe"' })])),
      FILES.project,
      [{ platforms: ['windows-no-git-bash'] }],
    )
    expect(message?.message).toBe(
      'On "windows-no-git-bash" this command runs in PowerShell, which prints a command that is only quoted strings and starts no program. Set "shell": "powershell", and put "&" before the quoted path to run "C:\\Tools\\guard.exe".',
    )
  })
})
