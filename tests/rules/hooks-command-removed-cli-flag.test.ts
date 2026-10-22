// `--enable-auto-mode` was removed in v2.1.111. Auto mode is in the Shift+Tab cycle, and
// `--permission-mode auto` starts in it
// (https://code.claude.com/docs/en/cli-reference#cli-flags). The sandbox flags of
// `claude remote-control` are at the end of the file.
import type { RuleTester } from 'eslint'
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
import { jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const name = 'hooks-command-removed-cli-flag'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('Stop', [handler])), file)
const shell = (text: string) => ids(command({ command: text }))
const exec = (executable: string, args: unknown[]) => ids(command({ command: executable, args }))

describe(`${name}: shell form`, () => {
  it('reports a claude command that passes the flag', () => {
    for (const text of [
      'claude --enable-auto-mode',
      'claude -p "fix it" --enable-auto-mode',
      'claude --enable-auto-mode=true -p x',
      '/usr/local/bin/claude --enable-auto-mode',
      '"claude" --enable-auto-mode',
      "'claude' '--enable-auto-mode'",
      'CI=1 claude --enable-auto-mode',
      'exec claude --enable-auto-mode',
      'env claude --enable-auto-mode',
      'cd "$CLAUDE_PROJECT_DIR" && claude --enable-auto-mode -p x',
      'echo start; claude --enable-auto-mode',
      'echo a | claude --enable-auto-mode',
      '(claude --enable-auto-mode)',
      'echo $(claude --enable-auto-mode)',
      'echo `claude --enable-auto-mode`',
      'claude --enable-auto-mode \\',
      'claude -p x\nclaude --enable-auto-mode',
      'echo a || claude --enable-auto-mode &',
    ]) {
      expect(shell(text), text).toEqual(['removed'])
    }
  })

  it('is silent for the flag in a command that is not claude', () => {
    for (const text of [
      'echo --enable-auto-mode',
      'grep -- --enable-auto-mode notes.md',
      'my-claude --enable-auto-mode',
      './check.sh --enable-auto-mode',
      'claudex --enable-auto-mode',
      'echo claude --enable-auto-mode',
      'claude -p x; echo --enable-auto-mode',
      'claude --permission-mode auto',
      'claude --enable-auto-mode-x',
      'claude "--enable-auto-mode"x',
      'claude',
      '',
    ]) {
      expect(shell(text), text).toEqual([])
    }
  })

  it('joins a line that ends in a backslash with the next line', () => {
    expect(shell('claude \\\n  --enable-auto-mode')).toEqual(['removed'])
    expect(shell('claude \\\n--enable-auto-mode')).toEqual(['removed'])
    expect(shell('env \\\n claude --enable-auto-mode')).toEqual(['removed'])
    expect(shell('claude\\\n--enable-auto-mode')).toEqual([])
    expect(shell('claude \\\r\n--enable-auto-mode')).toEqual(['removed'])
  })

  it('reads a wrapper after an assignment, a tab, and the exe suffix', () => {
    expect(shell('command claude --enable-auto-mode')).toEqual(['removed'])
    expect(shell('nohup claude --enable-auto-mode')).toEqual(['removed'])
    expect(shell('env CI=1 claude --enable-auto-mode')).toEqual(['removed'])
    expect(shell('-x=1 claude --enable-auto-mode')).toEqual([])
    expect(shell('claude\t--enable-auto-mode')).toEqual(['removed'])
    expect(shell('Claude.EXE --enable-auto-mode')).toEqual([])
    expect(shell('claude.EXE --enable-auto-mode')).toEqual(['removed'])
  })

  it('reads a Windows path to claude in quotes, where the shell keeps a backslash before a letter', () => {
    expect(shell('"C:\\Tools\\claude.exe" --enable-auto-mode')).toEqual(['removed'])
    expect(shell("'C:\\Tools\\claude' --enable-auto-mode")).toEqual(['removed'])
    expect(shell('env FOO=1 "C:\\Tools\\claude.exe" --enable-auto-mode')).toEqual(['removed'])
    expect(shell('"C:\\Tools\\my-claude.exe" --enable-auto-mode')).toEqual([])
  })

  it('is silent for a Windows path out of quotes, because the shell removes each backslash', () => {
    // bash runs `C:Toolsclaude.exe` and `C:claude.exe`, not claude.
    expect(shell('C:\\Tools\\claude.exe --enable-auto-mode')).toEqual([])
    expect(shell('C:\\claude.exe --enable-auto-mode')).toEqual([])
  })

  it('reads a Windows path out of quotes when each backslash has a backslash before it', () => {
    // bash runs `C:\Tools\claude.exe` for the shell line `C:\\Tools\\claude.exe`.
    expect(shell('C:\\\\Tools\\\\claude.exe --enable-auto-mode')).toEqual(['removed'])
  })

  it('reads a backslash, a quote that is not closed, and an assignment alone', () => {
    expect(shell('claude \\--enable-auto-mode')).toEqual(['removed'])
    expect(shell('claude --enable-auto-mode "unclosed')).toEqual(['removed'])
    expect(shell("claude 'a b --enable-auto-mode'")).toEqual([])
    expect(shell('A=1')).toEqual([])
    expect(shell('A=1 B=2')).toEqual([])
  })

  it('reports at the command string, and names the replacement', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "claude --enable-auto-mode"}]}]}\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['removed', 2, 64],
    ])
    expect(found[0]?.message).toBe(
      'Claude Code removed "--enable-auto-mode" in v2.1.111. Auto mode is in the Shift+Tab cycle. Use "--permission-mode auto" to start in it.',
    )
  })
})

describe(`${name}: exec form`, () => {
  it('reports claude with the flag in args, at the argument', () => {
    expect(exec('claude', ['-p', '--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('/usr/bin/claude', ['--enable-auto-mode=true'])).toEqual(['removed'])
    expect(exec('claude.exe', ['--enable-auto-mode'])).toEqual(['removed'])
    const text = settings(
      hooks('Stop', [command({ command: 'claude', args: ['-p', '--enable-auto-mode'] })]),
    )
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ column }) => column)).toEqual([79])
  })

  it('is silent for another executable, and for args that are not the flag', () => {
    expect(exec('node', ['--enable-auto-mode'])).toEqual([])
    expect(exec('claude', ['--permission-mode', 'auto'])).toEqual([])
    expect(exec('claude', [])).toEqual([])
    expect(exec('claude', ['-p', 5, null, ['--enable-auto-mode']])).toEqual([])
  })

  it('reads past a wrapper and the assignments to the executable that the wrapper runs', () => {
    expect(exec('env', ['FOO=1', 'claude', '--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('nohup', ['claude', '--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('env', ['claude', '-p', '--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('env', ['A=1', 'B=2', '/usr/bin/claude', '--enable-auto-mode'])).toEqual([
      'removed',
    ])
    const text = settings(
      hooks('Stop', [command({ command: 'env', args: ['FOO=1', 'claude', '--enable-auto-mode'] })]),
    )
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ column }) => column)).toEqual([88])
  })

  it('is silent for env with no claude, a flag before claude, a non-string item, and env -i', () => {
    expect(exec('env', ['FOO=1', 'node', '--enable-auto-mode'])).toEqual([])
    expect(exec('env', ['--enable-auto-mode', 'claude'])).toEqual([])
    expect(exec('env', ['FOO=1'])).toEqual([])
    expect(exec('env', [])).toEqual([])
    expect(exec('env', ['FOO=1', 5, 'claude', '--enable-auto-mode'])).toEqual([])
    // The shell form does not skip an option of env, so the exec form does not.
    expect(exec('env', ['-i', 'claude', '--enable-auto-mode'])).toEqual([])
    expect(shell('env -i claude --enable-auto-mode')).toEqual([])
  })

  it('reads past a wrapper given by a path, in exec form and in shell form', () => {
    expect(exec('/usr/bin/env', ['FOO=1', 'claude', 'remote-control', '--sandbox'])).toEqual([
      'removedFromSubcommand',
    ])
    expect(shell('/usr/bin/env FOO=1 claude remote-control --sandbox')).toEqual([
      'removedFromSubcommand',
    ])
    expect(shell('/usr/bin/env FOO=1 claude --enable-auto-mode')).toEqual(['removed'])
    expect(
      exec('C:\\Program Files\\Git\\usr\\bin\\env.exe', ['claude', '--enable-auto-mode']),
    ).toEqual(['removed'])
    expect(shell('./scripts/env claude --enable-auto-mode')).toEqual([])
    expect(shell('/usr/bin/envx claude --enable-auto-mode')).toEqual([])
    expect(exec('/usr/bin/envx', ['claude', '--enable-auto-mode'])).toEqual([])
    expect(exec('/usr/bin/env', ['FOO=1'])).toEqual([])
  })

  it('reads a Windows path with backslashes to claude', () => {
    expect(exec('C:\\Tools\\claude.exe', ['--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('C:\\Tools\\claude', ['--enable-auto-mode'])).toEqual(['removed'])
    expect(exec('env', ['FOO=1', 'C:\\Tools\\claude.exe', '--enable-auto-mode'])).toEqual([
      'removed',
    ])
    expect(exec('C:\\Tools\\my-claude.exe', ['--enable-auto-mode'])).toEqual([])
    expect(exec('C:\\claude\\node.exe', ['--enable-auto-mode'])).toEqual([])
  })

  it('reads a command in exec form as the executable, not as a shell line', () => {
    expect(ids(command({ command: 'claude --enable-auto-mode', args: [] }))).toEqual([])
  })

  it('ignores args that is not an array', () => {
    expect(ids(command({ command: 'claude --enable-auto-mode', args: 'x' }))).toEqual(['removed'])
  })
})

describe(`${name}: the handlers and the files`, () => {
  it('reads a command handler only', () => {
    expect(ids({ type: 'http', url: 'claude --enable-auto-mode' })).toEqual([])
    expect(ids({ type: 'prompt', prompt: 'claude --enable-auto-mode' })).toEqual([])
    expect(ids({ command: 'claude --enable-auto-mode' })).toEqual([])
    expect(ids({ type: 'command', command: 5 })).toEqual([])
  })

  it('reads every settings file, hooks.json, a skill and a project subagent', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: 'claude --enable-auto-mode' }), file), file).toEqual([
        'removed',
      ])
    }
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: claude --enable-auto-mode\n'
    expect(markdownIds(name, frontmatter(yaml), FILES.skill)).toEqual(['removed'])
    expect(markdownIds(name, frontmatter(yaml), FILES.agent)).toEqual(['removed'])
  })

  it('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(ids(command({ command: 'claude --enable-auto-mode' }), FILES.hidden)).toEqual([])
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: claude --enable-auto-mode\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it('is silent on a config that is malformed', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
    expect(
      jsonIds(name, settings({ Stop: [{ hooks: [{ type: 'command' }] }] }), FILES.project),
    ).toEqual([])
  })
})

// v2.1.300 removed `--sandbox` and `--no-sandbox` from `claude remote-control`. With one of them,
// the server exits with code 1 and does not start
// (https://code.claude.com/docs/en/errors#sandbox-is-not-supported-by-claude-remote-control).
// The sandboxing page tells how to turn on the sandbox: set `sandbox.enabled` to true in a settings
// file (https://code.claude.com/docs/en/sandboxing#what-the-sandbox-restricts).
const shellCode = (text: string) => settings(hooks('Stop', [command({ command: text })]))
const sandbox = (flag: string): RuleTester.TestCaseError => ({
  messageId: 'removedFromSubcommand',
  data: { flag, subcommand: 'remote-control', version: 'v2.1.300' },
})

jsonTester.run(`${name}: remote-control sandbox flags`, ruleOf(name), {
  valid: [
    'claude --sandbox',
    'claude --no-sandbox -p x',
    'claude mcp --sandbox',
    'claude --sandbox remote-control',
    'claude -p "remote-control --sandbox"',
    'echo remote-control --sandbox',
    'claude remote-control --name x; echo --sandbox',
    'claude remote-control --sandboxed',
    'my-claude remote-control --sandbox',
  ]
    .map((text) => ({ code: shellCode(text), filename: FILES.project }))
    .concat(
      [
        command({ command: 'claude', args: ['--no-sandbox', 'remote-control'] }),
        command({ command: 'claude', args: ['mcp', '--sandbox'] }),
        command({ command: 'node', args: ['remote-control', '--sandbox'] }),
        command({ command: 'claude', args: [['remote-control'], '--sandbox'] }),
      ].map((handler) => ({ code: settings(hooks('Stop', [handler])), filename: FILES.project })),
    ),
  invalid: [
    { text: 'claude remote-control --sandbox', flag: '--sandbox' },
    { text: 'claude remote-control --no-sandbox', flag: '--no-sandbox' },
    { text: 'claude remote-control --sandbox=1', flag: '--sandbox' },
    { text: 'claude remote-control --name x --no-sandbox=true', flag: '--no-sandbox' },
    { text: 'claude --verbose remote-control --sandbox', flag: '--sandbox' },
    { text: 'claude --model opus remote-control --no-sandbox', flag: '--no-sandbox' },
    { text: '/usr/local/bin/claude remote-control --sandbox', flag: '--sandbox' },
    { text: 'cd x && claude remote-control --sandbox', flag: '--sandbox' },
    { text: 'nohup claude remote-control --no-sandbox &', flag: '--no-sandbox' },
  ]
    .map(({ text, flag }) => ({
      code: shellCode(text),
      filename: FILES.project,
      errors: [sandbox(flag)],
    }))
    .concat([
      {
        code: settings(
          hooks('Stop', [
            command({ command: 'claude', args: ['remote-control', '--no-sandbox=1'] }),
          ]),
        ),
        filename: FILES.project,
        errors: [{ ...sandbox('--no-sandbox'), line: 1, column: 91 }],
      },
      {
        code: settings(
          hooks('Stop', [
            command({ command: '/opt/claude', args: ['--verbose', 'remote-control', '--sandbox'] }),
          ]),
        ),
        filename: FILES.project,
        errors: [sandbox('--sandbox')],
      },
      // Exec form gives one report at each item, also for a flag that occurs two times.
      {
        code: settings(
          hooks('Stop', [
            command({ command: 'claude', args: ['remote-control', '--sandbox', '--sandbox'] }),
          ]),
        ),
        filename: FILES.project,
        errors: [sandbox('--sandbox'), sandbox('--sandbox')],
      },
      {
        code: shellCode('claude remote-control --sandbox --no-sandbox'),
        filename: FILES.project,
        errors: [sandbox('--sandbox'), sandbox('--no-sandbox')],
      },
    ]),
})

describe(`${name}: the two kinds of removed flag`, () => {
  it('gives the text of each message', () => {
    const found = lintJson(
      name,
      shellCode('claude --enable-auto-mode; claude remote-control --sandbox'),
      FILES.project,
    )
    expect(found.map(({ messageId, message }) => [messageId, message])).toEqual([
      [
        'removed',
        'Claude Code removed "--enable-auto-mode" in v2.1.111. Auto mode is in the Shift+Tab cycle. Use "--permission-mode auto" to start in it.',
      ],
      [
        'removedFromSubcommand',
        'Claude Code removed "--sandbox" from "claude remote-control" in v2.1.300. With it, the server exits with code 1 and does not start. Remove the flag. To sandbox the sessions of the server, set "sandbox.enabled" to true in a settings file.',
      ],
    ])
  })

  it('gives the sandbox advice after env, in a Windows path and in shell form, and not when env takes the flag', () => {
    const message = (flag: string) =>
      `Claude Code removed "${flag}" from "claude remote-control" in v2.1.300. With it, the server exits with code 1 and does not start. Remove the flag. To sandbox the sessions of the server, set "sandbox.enabled" to true in a settings file.`
    const messages = (handler: object) =>
      lintJson(name, settings(hooks('Stop', [handler])), FILES.project).map(
        ({ message }) => message,
      )
    expect(
      messages(
        command({ command: 'env', args: ['FOO=1', 'claude', 'remote-control', '--sandbox'] }),
      ),
    ).toEqual([message('--sandbox')])
    expect(
      messages(
        command({ command: 'C:\\Tools\\claude.exe', args: ['remote-control', '--no-sandbox'] }),
      ),
    ).toEqual([message('--no-sandbox')])
    expect(
      messages(command({ command: '"C:\\Tools\\claude.exe" remote-control --sandbox' })),
    ).toEqual([message('--sandbox')])
    expect(
      messages(command({ command: 'env', args: ['--sandbox', 'claude', 'remote-control'] })),
    ).toEqual([])
  })

  it('reports a removed flag once for each command string', () => {
    expect(shell('claude --enable-auto-mode; claude --enable-auto-mode')).toEqual(['removed'])
    expect(shell('claude remote-control --sandbox; claude remote-control --sandbox')).toEqual([
      'removedFromSubcommand',
    ])
  })
})
