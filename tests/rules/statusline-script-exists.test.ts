// The rule reads the `command` of `statusLine`, `subagentStatusLine` and `fileSuggestion` in
// the settings files. It checks that the script exists, and that it has git mode 100755. The
// repositories are real, made with `git init`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { chmodSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, plain, repo } from '../git-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'statusline-script-exists'
const lint = (root: string, file: string, code: string) =>
  lintJson(RULE, code, path.join(root, file))
const ids = (messages: ReturnType<typeof lint>) => messages.map((m) => m.messageId)

/** A settings file with one command key. */
const settings = (command: unknown, key = 'statusLine') =>
  JSON.stringify({ [key]: { type: 'command', command } })

// The variable, escaped so that the template literal keeps it as text.
const PROJECT = `\${CLAUDE_PROJECT_DIR}`
const SETTINGS = '.claude/settings.json'
const KEYS = ['statusLine', 'subagentStatusLine', 'fileSuggestion']

describe(RULE, () => {
  it('reports a script that is not there, on the command', () => {
    const root = repo({ 'a.txt': 'x' })
    const code = `{
  "statusLine": {
    "type": "command",
    "command": "${PROJECT}/.claude/statusline.sh"
  }
}`
    const messages = lint(root, SETTINGS, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      line: 4,
      column: 16,
    })
    expect(messages[0]?.message).toContain(`"${PROJECT}/.claude/statusline.sh"`)
    expect(messages[0]?.message).toContain('statusLine')
  })

  it('reports a script with mode 100644, on the command', () => {
    const root = repo({ '.claude/statusline.sh': '#!/bin/sh\n' })
    const messages = lint(root, SETTINGS, settings(`${PROJECT}/.claude/statusline.sh`))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'notExecutable', line: 1 })
    expect(messages[0]?.message).toContain('statusLine')
  })

  it('stays silent for a script with mode 100755', () => {
    const root = repo({ '.claude/statusline.sh': '#!/bin/sh\n' }, ['.claude/statusline.sh'])
    expect(lint(root, SETTINGS, settings(`${PROJECT}/.claude/statusline.sh`))).toEqual([])
  })

  it('reads each of the three keys, and names the key', () => {
    const root = repo({ 'a.sh': 'x' })
    for (const key of KEYS) {
      const messages = lint(root, SETTINGS, settings(`${PROJECT}/gone.sh`, key))
      expect(ids(messages), key).toEqual(['missing'])
      expect(messages[0]?.message, key).toContain(`${key} script`)
      expect(ids(lint(root, SETTINGS, settings(`${PROJECT}/a.sh`, key))), key).toEqual([
        'notExecutable',
      ])
    }
  })

  it('reports each key of a file on its own', () => {
    const root = repo({ 'a.sh': 'x' })
    const code = JSON.stringify({
      statusLine: { type: 'command', command: `${PROJECT}/gone.sh` },
      subagentStatusLine: { type: 'command', command: `${PROJECT}/a.sh` },
      fileSuggestion: { type: 'command', command: `${PROJECT}/b.sh` },
    })
    expect(ids(lint(root, SETTINGS, code))).toEqual(['missing', 'notExecutable', 'missing'])
  })

  it('reads the forms of the path', () => {
    const root = repo({ 'tools/line.sh': 'x' }, ['tools/line.sh'])
    for (const command of [
      `${PROJECT}/tools/line.sh`,
      '$CLAUDE_PROJECT_DIR/tools/line.sh',
      `"${PROJECT}/tools/line.sh"`,
      'tools/line.sh',
      './tools/line.sh',
      `${PROJECT}/tools/line.sh --flag`,
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
      expect(lint(root, SETTINGS, settings(command.replace('line', 'gone'))), command).toHaveLength(
        1,
      )
    }
  })

  it('needs the bit on the program only, and the file for the program and an interpreter script', () => {
    const root = repo({ 'tools/line.js': 'x' })
    expect(lint(root, SETTINGS, settings(`node ${PROJECT}/tools/line.js`))).toEqual([])
    expect(ids(lint(root, SETTINGS, settings(`node ${PROJECT}/tools/gone.js`)))).toEqual([
      'missing',
    ])
    expect(ids(lint(root, SETTINGS, settings(`bash tools/gone.js`)))).toEqual([])
    // An argument of another program can be a file that the program makes.
    for (const command of [
      `tee -a ${PROJECT}/logs/out.log`,
      `mytool --cache ${PROJECT}/.cache/state.json`,
      `node ${PROJECT}/tools/line.js ${PROJECT}/gone.json`,
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
    }
  })

  it('does not read a command that is not a repository path', () => {
    const root = repo({ 'tools/line.sh': 'x' })
    for (const command of [
      "jq -r '.model.display_name'",
      '~/.claude/statusline.sh',
      '$HOME/.claude/statusline.sh',
      '/usr/local/bin/statusline',
      'statusline.sh',
      `${PROJECT}/$NAME.sh`,
      `${PROJECT}/tools/*.sh`,
      'echo hi > tools/out.log',
      '',
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
    }
  })

  it('stays silent for a value of another shape', () => {
    const root = repo({ 'a.txt': 'x' })
    for (const code of [
      '{}',
      '[]',
      '{"statusLine": null}',
      '{"statusLine": "tools/gone.sh"}',
      '{"statusLine": {"type": "command"}}',
      '{"statusLine": {"command": 5}}',
      '{"statusLine": []}',
      '{"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "tools/gone.sh"}]}]}}',
    ]) {
      expect(lint(root, SETTINGS, code), code).toEqual([])
    }
  })

  it('reads the last of two keys of one name, as JSON.parse does', () => {
    const root = repo({ 'ok.sh': 'x' }, ['ok.sh'])
    const gone = settings(`${PROJECT}/gone.sh`)
    const ok = settings(`${PROJECT}/ok.sh`)
    const join = (a: string, b: string) => `${a.slice(0, -1)},${b.slice(1)}`
    expect(lint(root, SETTINGS, join(gone, ok))).toEqual([])
    expect(lint(root, SETTINGS, join(ok, gone))).toHaveLength(1)
  })

  it('reports in settings.local.json, and resolves from the parent of .claude', () => {
    const root = repo({ 'packages/x/tools/line.sh': 'x' })
    const code = settings(`${PROJECT}/tools/line.sh`)
    expect(ids(lint(root, 'packages/x/.claude/settings.local.json', code))).toEqual([
      'notExecutable',
    ])
    expect(lint(root, '.claude/settings.local.json', code).map((m) => m.messageId)).toEqual([
      'missing',
    ])
  })

  it('reads the index mode, not the disk mode', () => {
    const root = repo({ 'a.sh': 'x', 'b.sh': 'x' }, ['a.sh'])
    chmodSync(path.join(root, 'a.sh'), 0o644)
    chmodSync(path.join(root, 'b.sh'), 0o755)
    expect(lint(root, SETTINGS, settings(`${PROJECT}/a.sh`))).toEqual([])
    expect(ids(lint(root, SETTINGS, settings(`${PROJECT}/b.sh`)))).toEqual(['notExecutable'])
  })

  it('reads the mode that a later git update-index records', () => {
    const root = repo({ 'a.sh': 'x' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/a.sh`))).toHaveLength(1)
    git(root, 'update-index', '--chmod=+x', 'a.sh')
    expect(lint(root, SETTINGS, settings(`${PROJECT}/a.sh`))).toEqual([])
  })

  it('stays silent about the bit for a script that git does not track', () => {
    const root = repo({ 'a.txt': 'x' }, [], { 'loose.sh': '#!/bin/sh\n' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/loose.sh`))).toEqual([])
  })

  it('reports a missing script where git cannot be read, and no bit', () => {
    // With no `.git`, the mode cannot be read, but the file is there or it is not.
    const root = plain({ 'tools/line.sh': 'x' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/line.sh`))).toEqual([])
    expect(ids(lint(root, SETTINGS, settings(`${PROJECT}/tools/gone.sh`)))).toEqual(['missing'])
  })

  it('stays silent about the bit when git cannot run', () => {
    const root = repo({ 'tools/line.sh': 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/line.sh`))).toEqual([])
      expect(ids(lint(root, SETTINGS, settings(`${PROJECT}/tools/gone.sh`)))).toEqual(['missing'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('stays silent for a path out of the repository, and for a link out of it', () => {
    const root = repo({ 'a.txt': 'x' })
    const outside = repo({ 'real.sh': 'x' })
    symlinkSync(path.join(outside, 'real.sh'), path.join(root, 'link.sh'))
    symlinkSync('missing.sh', path.join(root, 'dangling.sh'))
    for (const command of [
      `${PROJECT}/../outside.sh`,
      '../outside.sh',
      `${PROJECT}/link.sh`,
      `${PROJECT}/dangling.sh`,
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
    }
  })

  it('reads a link to a file in the repository where it leads', () => {
    const root = repo({ 'real.sh': 'x' })
    symlinkSync('real.sh', path.join(root, 'alias.sh'))
    expect(ids(lint(root, SETTINGS, settings(`${PROJECT}/alias.sh`)))).toEqual(['notExecutable'])
  })

  it.skipIf(chmodCannotBlock)('stays silent for a directory that it cannot read', () => {
    const root = repo({ 'locked/ok.sh': 'x' })
    withoutAccess(path.join(root, 'locked'), () => {
      expect(lint(root, SETTINGS, settings(`${PROJECT}/locked/ok.sh`))).toEqual([])
    })
  })

  describe('managed settings files', () => {
    it('resolves the project variable from the repository root', () => {
      const root = repo({ 'tools/line.sh': 'x' })
      for (const file of [
        'managed-settings.json',
        'etc/managed-settings.json',
        'etc/managed-settings.d/10-a.json',
      ]) {
        const code = settings(`${PROJECT}/tools/line.sh`)
        expect(ids(lint(root, file, code)), file).toEqual(['notExecutable'])
        expect(ids(lint(root, file, code.replace('line', 'gone'))), file).toEqual(['missing'])
      }
    })

    it('does not read a path from the project in a managed file', () => {
      const root = repo({ 'a.txt': 'x' })
      expect(lint(root, 'managed-settings.json', settings('tools/gone.sh'))).toEqual([])
    })

    it('skips a hidden drop-in, which Claude Code ignores', () => {
      const root = repo({ 'a.txt': 'x' })
      const file = 'managed-settings.d/.20-hidden.json'
      expect(lint(root, file, settings(`${PROJECT}/gone.sh`))).toEqual([])
    })
  })
})
