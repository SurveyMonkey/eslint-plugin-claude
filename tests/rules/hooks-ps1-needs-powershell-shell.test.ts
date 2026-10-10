// A PowerShell script is not a Bash script. A `command` that runs a `.ps1` file runs it in the
// default shell of the hook, which is Bash on macOS, Linux and WSL, and on Windows with Git Bash. It is
// PowerShell on Windows without Git Bash. The `shell` field of the hooks reference sets the shell
// (https://code.claude.com/docs/en/hooks#command-hook-fields). The rule reads the option `platforms`
// and reports nothing without it, in the shape of mid-round ruling 26.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { command, FILES, frontmatter, hooks, SETTINGS, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-ps1-needs-powershell-shell'
const BASH = ['windows-git-bash']
const ids = (handler: object, platforms?: string[], file = FILES.project) =>
  lintJson(
    name,
    settings(hooks('PostToolUse', [handler], 'Write')),
    file,
    platforms === undefined ? [] : [{ platforms }],
  ).map((message) => message.messageId)
const run = (text: string, fields: Record<string, unknown> = {}, platforms: string[] = BASH) =>
  ids(command({ command: text, ...fields }), platforms)
const dir = (variable: string) => `\${${variable}}`
const P = dir('CLAUDE_PROJECT_DIR')

/** The message ids of the rule for Markdown text, with the option `platforms`. */
const lintMd = (code: string, file: string, platforms: string[]) =>
  new Linter({ cwd: '/' })
    .verify(
      code,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          languageOptions: { frontmatter: 'yaml' },
          rules: { [`claude/${name}`]: ['error', { platforms }] },
        },
      ],
      { filename: file },
    )
    .map((message) => message.messageId)

describe(`${name}: the platforms`, () => {
  it('makes no report without the option, or with an empty list', () => {
    expect(ids(command({ command: './a.ps1' }))).toEqual([])
    expect(ids(command({ command: './a.ps1' }), [])).toEqual([])
  })

  it('reports for each platform that runs the hook in Bash', () => {
    for (const platform of ['windows-git-bash', 'macos', 'linux', 'wsl']) {
      expect(run('./a.ps1', {}, [platform]), platform).toEqual(['ps1'])
    }
    expect(run('./a.ps1', {}, ['windows-no-git-bash', 'linux'])).toEqual(['ps1'])
  })

  it('is silent when every platform runs the hook in PowerShell', () => {
    expect(run('./a.ps1', {}, ['windows-no-git-bash'])).toEqual([])
  })

  it('names the platforms in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: './a.ps1' })])),
      FILES.project,
      [{ platforms: ['macos', 'windows-git-bash'] }],
    )
    expect(message?.message).toBe(
      'This command runs a .ps1 file with no "shell": "powershell". On "macos" and "windows-git-bash" Claude Code runs the command in Bash, which cannot run a PowerShell script. Set "shell": "powershell".',
    )
  })
})

describe(`${name}: the command`, () => {
  it('reports a .ps1 file as the command word', () => {
    for (const text of [
      './a.ps1',
      `"${P}/.claude/hooks/check.ps1"`,
      `${P}/check.PS1 --fix`,
      'exec ./a.ps1',
      'FOO=1 ./a.ps1 arg',
      'env ./a.ps1',
      'echo x && ./b.ps1',
      '.\\check.ps1',
    ]) {
      expect(run(text), text).toEqual(['ps1'])
    }
  })

  it('reports with an explicit bash shell', () => {
    expect(run('./a.ps1', { shell: 'bash' })).toEqual(['ps1'])
  })

  it('reports once for a handler', () => {
    expect(run('./a.ps1 && ./b.ps1')).toEqual(['ps1'])
  })

  it('is silent when PowerShell runs the file', () => {
    for (const text of [
      'pwsh -File ./a.ps1',
      'powershell.exe -NoProfile -File "x.ps1"',
      'pwsh ./a.ps1',
      'bash ./a.sh',
      'echo a.ps1',
      './a.ps1x',
      './ps1',
      'ps1',
      '',
      'exec',
      'FOO=./a.ps1',
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it('is silent with shell powershell', () => {
    expect(run('./a.ps1', { shell: 'powershell' })).toEqual([])
    expect(run('& ./a.ps1', { shell: 'powershell' })).toEqual([])
  })

  it('is silent in exec form, where the shell field has no effect', () => {
    expect(run('./a.ps1', { args: [] })).toEqual([])
    expect(run('./a.ps1', { args: ['x'] })).toEqual([])
  })

  it('is silent for a handler that is no command hook, and for a command that is no string', () => {
    expect(ids({ type: 'http', url: 'u', command: './a.ps1' }, BASH)).toEqual([])
    expect(ids({ type: 'command', command: 1 }, BASH)).toEqual([])
    expect(ids({ type: 'command' }, BASH)).toEqual([])
  })

  it('reports at the command string', () => {
    const text =
      '{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "./a.ps1"}]}]\n  }\n}'
    const found = lintJson(name, text, FILES.project, [{ platforms: BASH }])
    expect(found.map(({ line, column }) => [line, column])).toEqual([[3, 56]])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: './a.ps1' }), BASH, file), file).toEqual(['ps1'])
      expect(ids(command({ command: './a.ps1', shell: 'powershell' }), BASH, file), file).toEqual(
        [],
      )
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (extra: string) =>
      frontmatter(
        `PostToolUse:\n  - matcher: Write\n    hooks:\n      - type: command\n        command: ./a.ps1\n${extra}`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(lintMd(yaml(''), file, BASH), file).toEqual(['ps1'])
      expect(lintMd(yaml('        shell: powershell\n'), file, BASH), file).toEqual([])
      expect(lintMd(yaml(''), file, []), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids(command({ command: './a.ps1' }), BASH, FILES.hidden)).toEqual([])
    expect(ids(command({ command: './a.ps1' }), BASH, '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
