// On Windows, exec form needs `command` to resolve to a real executable. The `.cmd` and `.bat` shims that npm,
// npx, eslint and other tools install are no executables
// (https://code.claude.com/docs/en/hooks#exec-form-and-shell-form). The platform of a team is not in a file, so
// the rule reads the option `platforms` and reports nothing without a Windows value.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { command, FILES, frontmatter, hooks, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-exec-form-windows-shim'
const WINDOWS = ['windows-git-bash']
const ids = (handler: object, platforms: string[] | null = WINDOWS, file = FILES.project) =>
  lintJson(
    name,
    settings(hooks('PostToolUse', [handler], 'Write')),
    file,
    platforms === null ? [] : [{ platforms }],
  ).map((message) => message.messageId)
const lintMd = (code: string, file: string) =>
  new Linter({ cwd: '/' })
    .verify(
      code,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          languageOptions: { frontmatter: 'yaml' },
          rules: { [`claude/${name}`]: ['error', { platforms: WINDOWS }] },
        },
      ],
      { filename: file },
    )
    .map((message) => message.messageId)
const exec = (executable: string, platforms: string[] | null = WINDOWS) =>
  ids(command({ command: executable, args: ['x'] }), platforms)

describe(`${name}: the platforms`, () => {
  it('makes no report without the option, or with an empty list', () => {
    expect(exec('npx', null)).toEqual([])
    expect(ids(command({ command: 'npx', args: [] }), null)).toEqual([])
    expect(exec('npx', [])).toEqual([])
  })

  it('reports for each Windows value', () => {
    for (const platform of ['windows-git-bash', 'windows-no-git-bash']) {
      expect(exec('npx', [platform]), platform).toEqual(['shim'])
    }
    expect(exec('npx', ['macos', 'windows-no-git-bash'])).toEqual(['shim'])
  })

  it('is silent when no value is Windows', () => {
    expect(exec('npx', ['macos', 'linux', 'wsl'])).toEqual([])
  })
})

describe(`${name}: the command`, () => {
  it('reports a bare name of an npm shim', () => {
    for (const executable of ['npx', 'npm', 'pnpm', 'pnpx', 'yarn', 'eslint', 'prettier', 'tsc']) {
      expect(exec(executable), executable).toEqual(['shim'])
    }
  })

  it('reports a .cmd or .bat file and a node_modules/.bin path', () => {
    for (const executable of [
      'tool.cmd',
      'C:\\tools\\Tool.BAT',
      './node_modules/.bin/eslint',
      `\${CLAUDE_PLUGIN_ROOT}/node_modules/.bin/eslint`,
      'node_modules\\.bin\\eslint',
    ]) {
      expect(exec(executable), executable).toEqual(['shim'])
    }
  })

  it('names the command in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('Stop', [command({ command: 'npx', args: ['eslint'] })])),
      FILES.project,
      [{ platforms: WINDOWS }],
    )
    expect(message?.message).toBe(
      'On Windows, exec form spawns "npx" directly, and an npm shim (.cmd or .bat) is no executable. Run the script with "node" and its path in "args", or use shell form.',
    )
  })

  it('is silent for a real executable', () => {
    for (const executable of [
      'node',
      'node.exe',
      'python',
      '/usr/bin/npx',
      './scripts/run.sh',
      'C:\\x\\npx.exe',
    ]) {
      expect(exec(executable), executable).toEqual([])
    }
  })

  it('is silent in shell form, for a command that is no string, and for another handler type', () => {
    expect(ids(command({ command: 'npx eslint' }))).toEqual([])
    expect(ids(command({ command: 5, args: [] }))).toEqual([])
    expect(ids({ type: 'http', url: 'u', command: 'npx', args: [] })).toEqual([])
    expect(ids(command({ command: 'npx', args: 'x' }))).toEqual([])
  })

  it('reports in a plugin file, a skill and a project agent', () => {
    expect(ids(command({ command: 'npx', args: [] }), WINDOWS, FILES.plugin)).toEqual(['shim'])
    const text = frontmatter(
      'Stop:\n  - hooks:\n      - type: command\n        command: npx\n        args: ["x"]\n',
    )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(lintMd(text, file), file).toEqual(['shim'])
    }
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(command({ command: 'npx', args: [] }), WINDOWS, FILES.hidden)).toEqual([])
  })
})
