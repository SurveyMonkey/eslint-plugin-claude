// `--remote` is a deprecated alias for `--cloud`
// (https://code.claude.com/docs/en/cli-reference#cli-flags). The rule reads a hook command that runs
// `claude`. It does not check the system prompt flags: the docs list none of them as deprecated.
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

const name = 'hooks-command-deprecated-cli-flag'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('Stop', [handler])), file)
const shell = (text: string) => ids(command({ command: text }))
const exec = (executable: string, args: unknown[]) => ids(command({ command: executable, args }))

describe(`${name}: shell form`, () => {
  it.fails('reports a claude command that passes --remote', () => {
    for (const text of [
      'claude --remote "Fix the login bug"',
      'claude -p x --remote',
      'claude --remote=Fix',
      '/usr/local/bin/claude --remote x',
      '"claude" "--remote" x',
      'CI=1 claude --remote x',
      'exec claude --remote x',
      'env claude --remote x',
      'cd "$CLAUDE_PROJECT_DIR" && claude --remote x',
      'echo a | claude --remote x',
      'echo $(claude --remote x)',
      'claude --remote \\',
      'claude.exe --remote x',
    ]) {
      expect(shell(text), text).toEqual(['remote'])
    }
  })

  it.fails('reports at the command string, and names --cloud', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "claude --remote x"}]}]}\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['remote', 2, 64],
    ])
    expect(found[0]?.message).toBe(
      'The CLI reference calls "--remote" a deprecated alias for "--cloud". Use "--cloud".',
    )
  })
})

describe(`${name}: the silent cases`, () => {
  it.fails('is silent for --cloud, and for flags that only start with --remote', () => {
    for (const text of [
      'claude --cloud "Fix the login bug"',
      'claude --remote-control',
      'claude --rc "My Project"',
      'claude --remote-control-session-name-prefix dev',
      'claude remote-control',
      'claude --remote-x',
      'claude "--remote"x',
      'claude',
      '',
    ]) {
      expect(shell(text), text).toEqual([])
    }
  })

  it.fails('is silent for the flag in a command that is not claude', () => {
    for (const text of [
      'echo --remote',
      'grep -- --remote notes.md',
      'my-claude --remote x',
      'claudex --remote x',
      'echo claude --remote',
      'claude -p x; echo --remote',
      'Claude.EXE --remote x',
    ]) {
      expect(shell(text), text).toEqual([])
    }
  })

  it.fails('is silent for the system prompt flags, which the docs do not deprecate', () => {
    expect(shell('claude --system-prompt "x" --append-system-prompt "y"')).toEqual([])
  })
})

describe(`${name}: exec form`, () => {
  it.fails('reports claude with the flag in args, at the argument', () => {
    expect(exec('claude', ['-p', '--remote'])).toEqual(['remote'])
    expect(exec('/usr/bin/claude', ['--remote=x'])).toEqual(['remote'])
    expect(exec('claude.exe', ['--remote'])).toEqual(['remote'])
    const text = settings(hooks('Stop', [command({ command: 'claude', args: ['-p', '--remote'] })]))
    expect(lintJson(name, text, FILES.project).map(({ column }) => column)).toEqual([75])
  })

  it.fails('is silent for another executable, and for args that are not the flag', () => {
    expect(exec('echo', ['--remote'])).toEqual([])
    expect(exec('claude', ['--cloud', '--remote-control'])).toEqual([])
    expect(exec('claude', [1, null, '--remote-x'])).toEqual([])
    expect(exec('claude', [])).toEqual([])
  })

  it.fails('reads the line, not the arguments, when args is no array', () => {
    expect(ids(command({ command: 'claude --remote x', args: 'a' }))).toEqual(['remote'])
  })
})

describe(`${name}: the handlers and files`, () => {
  it.fails('is silent for a handler that is no command hook, and for a command that is no string', () => {
    expect(ids({ type: 'http', url: 'u', command: 'claude --remote x' })).toEqual([])
    expect(ids({ type: 'command', command: 1 })).toEqual([])
    expect(ids({ type: 'command' })).toEqual([])
  })

  it.fails('reads every settings file, the hooks.json of a plugin, and the frontmatter', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: 'claude --remote x' }), file), file).toEqual(['remote'])
    }
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: command\n        command: claude --remote x\n',
    )
    expect(markdownIds(name, text, FILES.skill)).toEqual(['remote'])
    expect(markdownIds(name, text, FILES.agent)).toEqual(['remote'])
  })

  it.fails('is silent for a hidden drop-in', () => {
    expect(ids(command({ command: 'claude --remote x' }), FILES.hidden)).toEqual([])
  })
})
