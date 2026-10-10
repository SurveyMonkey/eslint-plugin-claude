// The rule checks the git index mode of a hook script that is itself the command. The
// repositories are real, made with `git init`, because the mode is the one in the index.
// The files glob and the decoy files are in tests/configs.test.ts.
import { chmodSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { git, plain, put, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'hooks-script-executable'
const lint = (root: string, file: string, code: string) =>
  lintJson(RULE, code, path.join(root, file))

/** A settings file with one command hook. */
const settings = (command: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command, ...extra }] }] },
  })

// The variables, escaped so that the template literal keeps them as text.
const PROJECT = `\${CLAUDE_PROJECT_DIR}`
const PLUGIN = `\${CLAUDE_PLUGIN_ROOT}`
const SETTINGS = '.claude/settings.json'
const MANIFEST = { '.claude-plugin/plugin.json': '{"name":"p"}' }

describe(RULE, () => {
  it('reports a script with mode 100644, on the command', () => {
    const root = repo({ '.claude/hooks/check.sh': '#!/bin/sh\n' })
    const code = `{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          { "type": "command", "command": "${PROJECT}/.claude/hooks/check.sh" }
        ]
      }
    ]
  }
}`
    const messages = lint(root, SETTINGS, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'notExecutable',
      line: 6,
      column: 43,
    })
    expect(messages[0]?.message).toContain(`"${PROJECT}/.claude/hooks/check.sh"`)
  })

  it('stays silent for a script with mode 100755', () => {
    const root = repo({ '.claude/hooks/check.sh': '#!/bin/sh\n' }, ['.claude/hooks/check.sh'])
    expect(lint(root, SETTINGS, settings(`${PROJECT}/.claude/hooks/check.sh`))).toEqual([])
  })

  it('reads the forms of the path, as the program', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    for (const command of [
      `${PROJECT}/tools/run.sh`,
      '$CLAUDE_PROJECT_DIR/tools/run.sh',
      `"${PROJECT}"/tools/run.sh`,
      'tools/run.sh',
      './tools/run.sh',
      `${PROJECT}/tools/run.sh --fix "a b"`,
      `${PROJECT}/tools/run.sh && echo done`,
      `${PROJECT}/tools/run.sh | jq .`,
    ]) {
      expect(
        lint(root, SETTINGS, settings(command)).map((m) => m.messageId),
        command,
      ).toEqual(['notExecutable'])
    }
  })

  it('stays silent when the script is an argument of another program', () => {
    const root = repo({ 'tools/run.js': 'x', 'tools/run.sh': 'x' })
    for (const command of [
      `node ${PROJECT}/tools/run.js`,
      `bash "${PROJECT}/tools/run.sh"`,
      `bash tools/run.sh`,
      `FOO=1 ${PROJECT}/tools/run.sh`,
      // Only the program needs the bit. A later script does not.
      `echo start && ${PROJECT}/tools/run.sh`,
      `${PROJECT}/tools/missing.sh && ${PROJECT}/tools/run.sh`,
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
    }
  })

  it('reads the exec form: the command is the program, and args are not', () => {
    const root = repo({ 'tools/run.sh': 'x', 'tools/run.js': 'x' })
    const exec = (command: string, args: unknown) => settings(command, { args })
    expect(
      lint(root, SETTINGS, exec(`${PROJECT}/tools/run.sh`, ['--fix'])).map((m) => m.messageId),
    ).toEqual(['notExecutable'])
    expect(lint(root, SETTINGS, exec('node', [`${PROJECT}/tools/run.js`]))).toEqual([])
    expect(lint(root, SETTINGS, exec('node', [`${PROJECT}/tools/run.js`, 1, null]))).toEqual([])
  })

  it('reports in settings.local.json, and below a nested project', () => {
    const root = repo({ 'packages/x/tools/run.sh': 'x' })
    const code = settings(`${PROJECT}/tools/run.sh`)
    expect(
      lint(root, '.claude/settings.local.json', settings(`${PROJECT}/packages/x/tools/run.sh`)),
    ).toHaveLength(1)
    expect(lint(root, 'packages/x/.claude/settings.json', code)).toHaveLength(1)
  })

  it('stays silent for a script that is not there, and for one that git does not track', () => {
    const root = repo({ 'a.txt': 'x' }, [], { 'tools/loose.sh': '#!/bin/sh\n' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/loose.sh`))).toEqual([])
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/gone.sh`))).toEqual([])
    // A directory has no index entry of its own.
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools`))).toEqual([])
  })

  it('stays silent in a tree with no .git, where the mode cannot be read', () => {
    const root = plain({ 'tools/run.sh': 'x' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/run.sh`))).toEqual([])
  })

  it('stays silent when git cannot run', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    vi.stubEnv('PATH', '')
    try {
      expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/run.sh`))).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('reads the index mode, not the disk mode', () => {
    // The index keeps 100755 while the disk shows 644: no report.
    const root = repo({ 'tools/a.sh': 'x', 'tools/b.sh': 'x' }, ['tools/a.sh'])
    chmodSync(path.join(root, 'tools/a.sh'), 0o644)
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/a.sh`))).toEqual([])
    // The disk shows 755 while the index keeps 100644: a report.
    chmodSync(path.join(root, 'tools/b.sh'), 0o755)
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/b.sh`))).toHaveLength(1)
  })

  it('reads the mode that a new git add records', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/run.sh`))).toHaveLength(1)
    git(root, 'update-index', '--chmod=+x', 'tools/run.sh')
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/run.sh`))).toEqual([])
  })

  it('reads the mode of the file that a link points at', () => {
    const root = repo({ 'tools/real.sh': 'x', 'tools/ok.sh': 'x' }, ['tools/ok.sh'])
    symlinkSync('real.sh', path.join(root, 'tools/alias.sh'))
    symlinkSync('ok.sh', path.join(root, 'tools/ok-alias.sh'))
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/alias.sh`))).toHaveLength(1)
    expect(lint(root, SETTINGS, settings(`${PROJECT}/tools/ok-alias.sh`))).toEqual([])
  })

  it('stays silent for a path out of the repository, and for a link out of it', () => {
    const root = repo({ 'a.txt': 'x' })
    const outside = repo({ 'real.sh': 'x' })
    symlinkSync(path.join(outside, 'real.sh'), path.join(root, 'link.sh'))
    expect(lint(root, SETTINGS, settings(`${PROJECT}/../outside.sh`))).toEqual([])
    expect(lint(root, SETTINGS, settings(`${PROJECT}/link.sh`))).toEqual([])
    expect(
      lint(root, SETTINGS, settings(`${PROJECT}/../${path.basename(outside)}/real.sh`)),
    ).toEqual([])
  })

  it('stays silent for a command that is not a repository path', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    for (const command of [
      'jq -r .name',
      'run.sh',
      '/usr/local/bin/run.sh',
      '~/bin/run.sh',
      `${PROJECT}/$EVENT.sh`,
      `${PROJECT}/tools/*.sh`,
      `> ${PROJECT}/tools/run.sh`,
      '',
    ]) {
      expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
    }
  })

  it('does not read the plugin variable in a settings file', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    expect(lint(root, SETTINGS, settings(`${PLUGIN}/tools/run.sh`))).toEqual([])
  })

  it('stays silent for a handler that is not a command hook', () => {
    const root = repo({ 'tools/run.sh': 'x' })
    for (const handler of [
      { type: 'http', command: `${PROJECT}/tools/run.sh` },
      { command: `${PROJECT}/tools/run.sh` },
      { type: 'command' },
    ]) {
      const code = JSON.stringify({ hooks: { Stop: [{ hooks: [handler] }] } })
      expect(lint(root, SETTINGS, code), JSON.stringify(handler)).toEqual([])
    }
    expect(lint(root, SETTINGS, '{"hooks": []}')).toEqual([])
  })

  describe('managed settings files', () => {
    it('resolves the project variable from the repository root', () => {
      const root = repo({ 'tools/run.sh': 'x' })
      for (const file of [
        'managed-settings.json',
        'etc/managed-settings.json',
        'etc/managed-settings.d/10-a.json',
      ]) {
        expect(lint(root, file, settings(`${PROJECT}/tools/run.sh`)), file).toHaveLength(1)
      }
    })

    it('does not read a path from the project in a managed file', () => {
      const root = repo({ 'tools/run.sh': 'x' })
      expect(lint(root, 'managed-settings.json', settings('tools/run.sh'))).toEqual([])
    })

    it('skips a hidden drop-in, which Claude Code ignores', () => {
      const root = repo({ 'tools/run.sh': 'x' })
      const file = 'managed-settings.d/.20-hidden.json'
      expect(lint(root, file, settings(`${PROJECT}/tools/run.sh`))).toEqual([])
    })
  })

  describe('hooks.json in a plugin', () => {
    const FILE = 'hooks/hooks.json'

    it('reports a plugin script with mode 100644', () => {
      const root = repo({ ...MANIFEST, 'scripts/a.sh': 'x', 'scripts/b.sh': 'x' }, ['scripts/b.sh'])
      expect(lint(root, FILE, settings(`${PLUGIN}/scripts/a.sh`)).map((m) => m.messageId)).toEqual([
        'notExecutable',
      ])
      expect(lint(root, FILE, settings(`${PLUGIN}/scripts/b.sh`))).toEqual([])
      expect(lint(root, FILE, settings('node', { args: [`${PLUGIN}/scripts/a.sh`] }))).toEqual([])
    })

    it('does not read the project variable, or a path from the project', () => {
      const root = repo({ ...MANIFEST, 'scripts/a.sh': 'x' })
      expect(lint(root, FILE, settings(`${PROJECT}/scripts/a.sh`))).toEqual([])
      expect(lint(root, FILE, settings('scripts/a.sh'))).toEqual([])
    })

    it('stays silent for a file that is in no plugin, and for a path out of the plugin', () => {
      const bare = repo({ 'scripts/a.sh': 'x' })
      expect(lint(bare, FILE, settings(`${PLUGIN}/scripts/a.sh`))).toEqual([])
      const root = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'shared/a.sh': 'x' })
      const file = 'plugins/p/hooks/hooks.json'
      expect(lint(root, file, settings(`${PLUGIN}/../../shared/a.sh`))).toEqual([])
    })

    it('resolves the plugin root from the parent of hooks/', () => {
      const root = repo({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'plugins/p/run.sh': 'x' })
      expect(lint(root, 'plugins/p/hooks/hooks.json', settings(`${PLUGIN}/run.sh`))).toHaveLength(1)
    })
  })

  it('puts the plugin and the repository apart when the plugin has its own .git', () => {
    const root = repo({ 'a.txt': 'x' })
    put(root, { 'inner/.claude-plugin/plugin.json': '{}', 'inner/run.sh': 'x' })
    const inner = path.join(root, 'inner')
    git(inner, 'init', '--quiet')
    git(inner, 'add', '--all')
    expect(lint(inner, 'hooks/hooks.json', settings(`${PLUGIN}/run.sh`))).toHaveLength(1)
  })
})
