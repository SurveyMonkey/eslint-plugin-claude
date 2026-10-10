// `--enable-auto-mode` was removed in v2.1.111. Auto mode is in the Shift+Tab cycle, and
// `--permission-mode auto` starts in it
// (https://code.claude.com/docs/en/cli-reference#cli-flags).
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
