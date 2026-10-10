// The rule reads the hook commands of `hooks/hooks.json` in a plugin and of the
// settings files, and checks the repository scripts that they name. The scripts
// are on disk, because the rule looks for them. The files glob and the decoy
// files are in tests/configs.test.ts.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { plain, repo } from '../git-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'hooks-script-exists'
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
const MANIFEST = { '.claude-plugin/plugin.json': '{"name":"p"}' }
const SETTINGS = '.claude/settings.json'
// A test that locks a directory runs where `chmod 000` blocks a read.
const lockedIt = it.skipIf(chmodCannotBlock)

describe(RULE, () => {
  describe('settings files', () => {
    it('reports a project script that is not there, on the command', () => {
      const root = plain()
      const code = `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${PROJECT}/.claude/hooks/gone.sh" }
        ]
      }
    ]
  }
}`
      const messages = lint(root, SETTINGS, code)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'missing',
        line: 7,
        column: 43,
      })
      expect(messages[0]?.message).toContain(`"${PROJECT}/.claude/hooks/gone.sh"`)
    })

    it('stays silent for a project script that is there', () => {
      const root = plain({ '.claude/hooks/ok.sh': '#!/bin/sh\n' })
      expect(lint(root, SETTINGS, settings(`${PROJECT}/.claude/hooks/ok.sh`))).toEqual([])
    })

    it('reports in settings.local.json', () => {
      const root = plain()
      expect(
        lint(root, '.claude/settings.local.json', settings(`${PROJECT}/gone.sh`)),
      ).toHaveLength(1)
    })

    it('resolves the project from the parent of .claude, at any depth', () => {
      const root = plain({ 'packages/x/tools/ok.sh': 'x' })
      const file = 'packages/x/.claude/settings.json'
      expect(lint(root, file, settings(`${PROJECT}/tools/ok.sh`))).toEqual([])
      expect(lint(root, file, settings(`${PROJECT}/tools/gone.sh`))).toHaveLength(1)
    })

    it('reads the forms of the project variable, quoted or not', () => {
      const root = plain({ 'ok.sh': 'x' })
      for (const command of [
        `${PROJECT}/ok.sh`,
        '$CLAUDE_PROJECT_DIR/ok.sh',
        `"${PROJECT}"/ok.sh`,
        `"${PROJECT}/ok.sh"`,
        `'${PROJECT}/ok.sh'`,
      ]) {
        expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
        expect(lint(root, SETTINGS, settings(command.replace('ok', 'gone'))), command).toHaveLength(
          1,
        )
      }
    })

    it('reads a path from the project, with or without ./, as the first word', () => {
      const root = plain({ 'tools/ok.sh': 'x' })
      for (const command of ['tools/ok.sh', './tools/ok.sh', 'tools/ok.sh --flag a b']) {
        expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
        expect(lint(root, SETTINGS, settings(command.replace('ok', 'gone'))), command).toHaveLength(
          1,
        )
      }
    })

    it('reads a script that follows another word', () => {
      const root = plain({ 'ok.js': 'x' })
      expect(lint(root, SETTINGS, settings(`node ${PROJECT}/ok.js --fix`))).toEqual([])
      const messages = lint(root, SETTINGS, settings(`node "${PROJECT}/gone.js" --fix`))
      expect(messages.map((m) => m.messageId)).toEqual(['missing'])
    })

    it('reads each script of a command with an operator', () => {
      const root = plain({ 'ok.sh': 'x' })
      const command = `${PROJECT}/ok.sh && ${PROJECT}/a.sh; ${PROJECT}/b.sh | ${PROJECT}/ok.sh`
      expect(lint(root, SETTINGS, settings(command)).map((m) => m.messageId)).toEqual([
        'missing',
        'missing',
      ])
    })

    it('does not read the target of a redirect, or a word that is not a path', () => {
      const root = plain()
      for (const command of [
        `echo hi > ${PROJECT}/out.log`,
        `echo hi 2>&1 >> "${PROJECT}/out.log"`,
        `cat < ${PROJECT}/in.txt`,
        'jq -r .name',
        'check.sh',
        '/usr/local/bin/check.sh',
        '~/bin/check.sh',
        '$HOME/bin/check.sh',
        `${PROJECT}/$EVENT.sh`,
        `${PROJECT}/hooks/*.sh`,
        `${PROJECT}/{a,b}.sh`,
        `${PROJECT}/dir/`,
        `${PROJECT}`,
        `${PROJECT}\\hooks\\gone.sh`,
        'FOO=bar/x run.sh',
        'C:/tools/gone.sh',
        'tools/dir/',
        '',
      ]) {
        expect(lint(root, SETTINGS, settings(command)), command).toEqual([])
      }
    })

    it('does not read the plugin variable in a settings file', () => {
      const root = plain()
      expect(lint(root, SETTINGS, settings(`${PLUGIN}/gone.sh`))).toEqual([])
    })

    it('reads an exec form hook: the command and each args element', () => {
      const root = plain({ 'ok.js': 'x', 'bin/ok': 'x' })
      const exec = (command: string, args: unknown) => settings(command, { args })
      expect(lint(root, SETTINGS, exec('node', [`${PROJECT}/ok.js`, '--fix']))).toEqual([])
      expect(lint(root, SETTINGS, exec(`${PROJECT}/bin/ok`, []))).toEqual([])
      const gone = lint(root, SETTINGS, exec('node', ['--fix', `${PROJECT}/gone.js`]))
      expect(gone.map((m) => m.messageId)).toEqual(['missing'])
      expect(lint(root, SETTINGS, exec(`${PROJECT}/bin/gone`, [])).map((m) => m.messageId)).toEqual(
        ['missing'],
      )
      // An args element that is not a string holds no path.
      expect(lint(root, SETTINGS, exec('node', [1, null, `${PROJECT}/ok.js`]))).toEqual([])
    })

    it('reports on the args element in an exec form hook', () => {
      const root = plain()
      const code = `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node","args":["${PROJECT}/gone.js"]}]}]}}`
      const messages = lint(root, SETTINGS, code)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ line: 1, column: 72 })
    })

    it('reads a command with a spaced script path in exec form as one path', () => {
      const root = plain({ 'my tools/ok.sh': 'x' })
      const code = settings(`${PROJECT}/my tools/ok.sh`, { args: [] })
      expect(lint(root, SETTINGS, code)).toEqual([])
    })

    it('treats args that is not an array as the shell form', () => {
      const root = plain({ 'ok.js': 'x' })
      const code = settings(`node ${PROJECT}/ok.js`, { args: 'x' })
      expect(lint(root, SETTINGS, code)).toEqual([])
      expect(lint(root, SETTINGS, settings(`node ${PROJECT}/gone.js`, { args: 'x' }))).toHaveLength(
        1,
      )
    })

    it('reports each hook of each event and group', () => {
      const root = plain()
      const code = JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: `${PROJECT}/a.sh` },
                { type: 'command', command: `${PROJECT}/b.sh` },
              ],
            },
            { hooks: [{ type: 'command', command: `${PROJECT}/c.sh` }] },
          ],
          Stop: [{ hooks: [{ type: 'command', command: `${PROJECT}/d.sh` }] }],
        },
      })
      expect(lint(root, SETTINGS, code)).toHaveLength(4)
    })

    it('reads the last of two hooks keys, as JSON.parse does', () => {
      const root = plain({ 'ok.sh': 'x' })
      const one = settings(`${PROJECT}/gone.sh`)
      const two = settings(`${PROJECT}/ok.sh`)
      const join = (a: string, b: string) => `${a.slice(0, -1)},${b.slice(1)}`
      expect(lint(root, SETTINGS, join(one, two))).toEqual([])
      expect(lint(root, SETTINGS, join(two, one))).toHaveLength(1)
    })

    it('stays silent for a handler that is not a command hook', () => {
      const root = plain()
      for (const handler of [
        { type: 'http', url: 'https://x.test', command: `${PROJECT}/gone.sh` },
        { type: 'prompt', command: `${PROJECT}/gone.sh` },
        { command: `${PROJECT}/gone.sh` },
        { type: 'command' },
        { type: 'command', command: 5 },
        { type: 7, command: `${PROJECT}/gone.sh` },
        'text',
      ]) {
        const code = JSON.stringify({ hooks: { Stop: [{ hooks: [handler] }] } })
        expect(lint(root, SETTINGS, code), JSON.stringify(handler)).toEqual([])
      }
    })

    it('stays silent for a hooks value of another shape', () => {
      const root = plain()
      for (const code of [
        '{}',
        '[]',
        '{"hooks": null}',
        '{"hooks": []}',
        '{"hooks": {"Stop": {}}}',
        '{"hooks": {"Stop": ["x"]}}',
        '{"hooks": {"Stop": [{}]}}',
        '{"hooks": {"Stop": [{"hooks": {}}]}}',
        '{"statusLine": {"type": "command", "command": "./gone.sh"}}',
      ]) {
        expect(lint(root, SETTINGS, code), code).toEqual([])
      }
    })

    it('stays silent for a path out of the repository', () => {
      const root = repo({ 'a.txt': 'x' })
      expect(lint(root, SETTINGS, settings(`${PROJECT}/../outside.sh`))).toEqual([])
      expect(lint(root, SETTINGS, settings('../outside.sh'))).toEqual([])
    })

    it('stays inside the project directory without a .git', () => {
      const root = plain({ 'tools/ok.sh': 'x', 'packages/x/a.txt': 'x' })
      const file = 'packages/x/.claude/settings.json'
      expect(lint(root, file, settings(`${PROJECT}/../../tools/ok.sh`))).toEqual([])
    })

    it('stays silent for a link that leads out of the repository', () => {
      const root = repo({ 'a.txt': 'x' })
      const outside = plain({ 'real.sh': 'x' })
      symlinkSync(path.join(outside, 'real.sh'), path.join(root, 'link.sh'))
      symlinkSync(outside, path.join(root, 'linked-dir'))
      expect(lint(root, SETTINGS, settings(`${PROJECT}/link.sh`))).toEqual([])
      expect(lint(root, SETTINGS, settings(`${PROJECT}/linked-dir/real.sh`))).toEqual([])
      expect(lint(root, SETTINGS, settings(`${PROJECT}/linked-dir/gone.sh`))).toEqual([])
    })

    it('stays silent for a dangling link, and finds a link to a file in the repository', () => {
      const root = repo({ 'real.sh': 'x' })
      symlinkSync('missing.sh', path.join(root, 'dangling.sh'))
      symlinkSync('real.sh', path.join(root, 'alias.sh'))
      expect(lint(root, SETTINGS, settings(`${PROJECT}/dangling.sh`))).toEqual([])
      expect(lint(root, SETTINGS, settings(`${PROJECT}/alias.sh`))).toEqual([])
    })

    it('reports a path below a file, where nothing is', () => {
      const root = plain({ 'file.sh': 'x' })
      expect(lint(root, SETTINGS, settings(`${PROJECT}/file.sh/inner.sh`))).toHaveLength(1)
    })

    lockedIt('stays silent for a directory that it cannot read', () => {
      const root = plain({ 'locked/ok.sh': 'x' })
      withoutAccess(path.join(root, 'locked'), () => {
        expect(lint(root, SETTINGS, settings(`${PROJECT}/locked/ok.sh`))).toEqual([])
      })
    })

    it('uses the .git directory as the bound', () => {
      const root = repo({ 'ok.sh': 'x' })
      expect(lint(root, SETTINGS, settings(`${PROJECT}/ok.sh`))).toEqual([])
      expect(lint(root, SETTINGS, settings(`${PROJECT}/gone.sh`))).toHaveLength(1)
    })

    it('reads a script below a project directory that is a link', () => {
      const root = repo({ 'real/ok.sh': 'x', 'real/.claude/a.txt': 'x' })
      mkdirSync(path.join(root, 'site'))
      symlinkSync('../real', path.join(root, 'site', 'proj'))
      const file = 'site/proj/.claude/settings.json'
      expect(lint(root, file, settings(`${PROJECT}/ok.sh`))).toEqual([])
      expect(lint(root, file, settings(`${PROJECT}/gone.sh`))).toHaveLength(1)
    })
  })

  describe('managed settings files', () => {
    it('resolves the project variable from the repository root', () => {
      const root = repo({ 'tools/ok.sh': 'x' })
      for (const file of [
        'managed-settings.json',
        'etc/managed-settings.json',
        'etc/managed-settings.d/10-a.json',
      ]) {
        expect(lint(root, file, settings(`${PROJECT}/tools/ok.sh`)), file).toEqual([])
        expect(lint(root, file, settings(`${PROJECT}/tools/gone.sh`)), file).toHaveLength(1)
      }
    })

    it('does not read a path from the project in a managed file', () => {
      const root = repo({ 'tools/gone.sh': 'x' })
      expect(lint(root, 'managed-settings.json', settings('tools/other.sh'))).toEqual([])
    })

    it('does not read the plugin variable in a managed file', () => {
      const root = repo({ 'a.txt': 'x' })
      expect(lint(root, 'managed-settings.json', settings(`${PLUGIN}/gone.sh`))).toEqual([])
    })

    it('reads a drop-in with the name of a project file', () => {
      const root = repo({ 'a.txt': 'x' })
      const file = 'managed-settings.d/settings.local.json'
      expect(lint(root, file, settings(`${PROJECT}/gone.sh`))).toHaveLength(1)
    })

    it('skips a hidden drop-in, which Claude Code ignores', () => {
      const root = repo({ 'a.txt': 'x' })
      const file = 'managed-settings.d/.20-hidden.json'
      expect(lint(root, file, settings(`${PROJECT}/gone.sh`))).toEqual([])
    })

    it('reads a managed file with no .git, from its directory', () => {
      const root = plain({ 'ok.sh': 'x' })
      expect(lint(root, 'managed-settings.json', settings(`${PROJECT}/ok.sh`))).toEqual([])
      expect(lint(root, 'managed-settings.json', settings(`${PROJECT}/gone.sh`))).toHaveLength(1)
    })
  })

  describe('hooks.json in a plugin', () => {
    const FILE = 'hooks/hooks.json'

    it('reports a plugin script that is not there', () => {
      const root = plain({ ...MANIFEST, 'scripts/ok.sh': 'x' })
      expect(lint(root, FILE, settings(`${PLUGIN}/scripts/ok.sh`))).toEqual([])
      const messages = lint(root, FILE, settings(`${PLUGIN}/scripts/gone.sh`))
      expect(messages.map((m) => m.messageId)).toEqual(['missing'])
    })

    it('reads the form with no braces, and the exec form', () => {
      const root = plain({ ...MANIFEST, 'scripts/ok.sh': 'x' })
      expect(lint(root, FILE, settings('$CLAUDE_PLUGIN_ROOT/scripts/gone.sh'))).toHaveLength(1)
      const code = settings('node', { args: [`${PLUGIN}/scripts/gone.sh`] })
      expect(lint(root, FILE, code)).toHaveLength(1)
    })

    it('resolves the plugin root from the parent of hooks/', () => {
      const root = plain({ 'plugins/p/.claude-plugin/plugin.json': '{}', 'plugins/p/run.sh': 'x' })
      expect(lint(root, 'plugins/p/hooks/hooks.json', settings(`${PLUGIN}/run.sh`))).toEqual([])
      expect(lint(root, 'plugins/p/hooks/hooks.json', settings(`${PLUGIN}/gone.sh`))).toHaveLength(
        1,
      )
    })

    it('does not read the project variable, or a relative path', () => {
      const root = plain(MANIFEST)
      expect(lint(root, FILE, settings(`${PROJECT}/gone.sh`))).toEqual([])
      expect(lint(root, FILE, settings('scripts/gone.sh'))).toEqual([])
    })

    it('stays silent for a file that is not in a plugin', () => {
      const root = plain()
      expect(lint(root, FILE, settings(`${PLUGIN}/gone.sh`))).toEqual([])
      expect(lint(root, '.claude/hooks/hooks.json', settings(`${PLUGIN}/gone.sh`))).toEqual([])
    })

    it('stays silent for a path out of the plugin', () => {
      const root = plain({ ...MANIFEST, 'outside.sh': 'x' })
      const sibling = lint(root, FILE, settings(`${PLUGIN}/../outside.sh`))
      expect(sibling).toEqual([])
      expect(lint(root, FILE, settings(`${PLUGIN}/../gone.sh`))).toEqual([])
    })

    it('stays silent when .claude-plugin has a real path out of the repository', () => {
      const root = repo({ 'a.txt': 'x' })
      const outside = plain({ 'plugin.json': '{}' })
      symlinkSync(outside, path.join(root, '.claude-plugin'))
      expect(lint(root, FILE, settings(`${PLUGIN}/gone.sh`))).toEqual([])
    })
  })
})
