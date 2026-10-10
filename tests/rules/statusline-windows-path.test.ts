// The expected values come from the status line page
// (https://code.claude.com/docs/en/statusline#windows-configuration): "Git Bash treats unquoted
// backslashes as escape characters, so a Windows-style path such as `C:\Users\username\script.mjs`
// reaches the script runner with its separators removed and the command fails without a visible
// error. Write file paths in the `command` string with forward slashes". The files glob is in
// `tests/configs.test.ts`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'statusline-windows-path'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const settings = (command: unknown, key = 'statusLine') =>
  JSON.stringify({ [key]: { type: 'command', command } })
const lint = (code: string, file = PROJECT) => lintJson(name, code, file)
const ids = (command: unknown, file = PROJECT) =>
  lint(settings(command), file).map((m) => m.messageId)

describe(`${name}: a backslash path`, () => {
  it('reports a Windows path, in every settings file', () => {
    for (const file of EVERY_FILE) {
      expect(ids('node C:\\Users\\username\\script.mjs', file), file).toEqual(['backslash'])
    }
  })

  it('reports the forms of a path', () => {
    for (const command of [
      'C:\\Users\\me\\status.mjs',
      'bash .claude\\statusline.sh',
      'bash ..\\scripts\\status.sh',
      'bash ~\\.claude\\statusline.sh',
      'node scripts\\status.mjs --flag',
      'powershell -NoProfile -File C:\\Users\\me\\.claude\\statusline.ps1',
      'a\\b',
      'ok.sh && node C:\\x\\y.mjs',
      '"quoted" C:\\x\\y.mjs',
      '"C:\\x\\y.mjs"C:\\x\\y.mjs',
      "'q'C:\\x\\y.mjs",
    ]) {
      expect(ids(command), command).toEqual(['backslash'])
    }
  })

  it('reports once for a command, on the command', () => {
    const [message] = lint('{\n  "statusLine": { "command": "C:\\\\a\\\\b" }\n}')
    expect([message?.line, message?.column]).toEqual([2, 30])
    expect(lint(settings('C:\\a\\b D:\\c\\d'))).toHaveLength(1)
    expect(message?.message).toBe(
      'The statusLine command has a path with backslashes. Git Bash on Windows treats an unquoted backslash as an escape character, and the command fails. Write the path with forward slashes.',
    )
  })
})

describe(`${name}: silent cases`, () => {
  it('is silent for a path with forward slashes', () => {
    for (const command of [
      'node C:/Users/username/script.mjs',
      '~/.claude/statusline.sh',
      'powershell -NoProfile -File C:/Users/username/.claude/statusline.ps1',
      `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`,
      '',
      'echo hi',
    ]) {
      expect(ids(command), command).toEqual([])
    }
  })

  it('is silent for a backslash in quotes, because the shell keeps it', () => {
    for (const command of [
      "node 'C:\\Users\\me\\status.mjs'",
      'node "C:\\Users\\me\\status.mjs"',
      'printf "a\\nb"',
      "echo 'a\\'",
      'echo "a\\"b" C:/x',
      'echo "it\'s" C:/x',
      'echo \'say "x"\' C:/x',
    ]) {
      expect(ids(command), command).toEqual([])
    }
  })

  it('is silent for a backslash that escapes a character, not a path separator', () => {
    for (const command of [
      'echo \\$HOME',
      'echo my\\ file',
      'echo a\\"b',
      'C:\\\\Users\\\\me\\\\status.mjs',
      'echo \\\\server',
      'echo a\\',
      'echo \\',
      'echo ok \\n',
      'echo \\.',
    ]) {
      expect(ids(command), command).toEqual([])
    }
  })

  it('reports a path after a quote that closed', () => {
    expect(ids('echo "a" C:\\x')).toEqual(['backslash'])
    expect(ids("echo 'a' C:\\x")).toEqual(['backslash'])
    expect(ids('echo "a\\"" C:\\x')).toEqual(['backslash'])
  })

  it('reports a path that starts with a dot or a tilde, and a UNC path with a share', () => {
    expect(ids('node .\\status.sh')).toEqual(['backslash'])
    expect(ids('node ~\\bin')).toEqual(['backslash'])
    expect(ids('node \\\\server\\share\\s.mjs')).toEqual(['backslash'])
  })

  it('reads the key statusLine only', () => {
    for (const key of ['subagentStatusLine', 'fileSuggestion', 'apiKeyHelper']) {
      expect(lint(settings('C:\\a\\b', key)), key).toEqual([])
    }
  })

  it('is silent when statusLine or its command has another shape', () => {
    for (const code of [
      '{}',
      '[]',
      '{"statusLine": null}',
      '{"statusLine": "C:\\\\a\\\\b"}',
      '{"statusLine": ["C:\\\\a\\\\b"]}',
      '{"statusLine": {"type": "command"}}',
      '{"statusLine": {"command": null}}',
      '{"statusLine": {"command": 5}}',
      '{"statusLine": {"command": ["C:\\\\a\\\\b"]}}',
    ]) {
      expect(lint(code), code).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    expect(
      lint('{"statusLine":{"command":"C:\\\\a\\\\b","command":"C:/a/b"}}').map((m) => m.messageId),
    ).toEqual([])
    expect(
      lint('{"statusLine":{"command":"C:/a/b","command":"C:\\\\a\\\\b"}}').map((m) => m.messageId),
    ).toEqual(['backslash'])
    expect(lint('{"statusLine":{"command":"C:\\\\a\\\\b"},"statusLine":{"command":"x"}}')).toEqual(
      [],
    )
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids('C:\\a\\b', HIDDEN)).toEqual([])
  })
})
