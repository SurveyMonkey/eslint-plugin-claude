// In exec form, `command` is the executable name or path only. A bare name with whitespace
// has no executable to spawn. An absolute path with spaces is one valid executable
// (https://code.claude.com/docs/en/hooks#exec-form-and-shell-form).
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

const name = 'hooks-exec-form-command-spaces'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('Stop', [handler])), file)
const exec = (executable: string, args: unknown = ['x']) =>
  ids(command({ command: executable, args }))

describe(`${name}: the command`, () => {
  it.fails('reports a bare name that holds whitespace', () => {
    for (const text of ['node script.js', 'my tool', 'my\ttool', ' node', 'node ']) {
      expect(exec(text), text).toEqual(['spaces'])
    }
  })

  it.fails('reports with an empty args array, which is exec form too', () => {
    expect(exec('my tool', [])).toEqual(['spaces'])
  })

  it.fails('names the command and reports at the command string', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "node a.js", "args": []}]}]}\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['spaces', 2, 64],
    ])
    expect(found[0]?.message).toBe(
      'In exec form, "command" is the executable only, and "node a.js" holds whitespace. The spawn fails. Move the extra words into "args".',
    )
  })

  it.fails('is silent for a name with no whitespace, and for a path', () => {
    for (const text of [
      'node',
      'C:\\Program Files\\nodejs\\node.exe',
      '/opt/my tool/run',
      `\${CLAUDE_PLUGIN_ROOT}/bin/my tool`,
      './my tool',
      'bin\\my tool',
      '',
    ]) {
      expect(exec(text), text).toEqual([])
    }
  })

  it.fails('is silent in shell form, where the shell splits the words', () => {
    expect(ids(command({ command: 'node script.js' }))).toEqual([])
    expect(ids(command({ command: 'node script.js', args: 'x' }))).toEqual([])
    expect(ids(command({ command: 'node script.js', args: null }))).toEqual([])
  })

  it.fails('reads a command handler with a string command only', () => {
    expect(ids({ type: 'http', command: 'a b', args: [] })).toEqual([])
    expect(ids({ command: 'a b', args: [] })).toEqual([])
    expect(ids({ type: 'command', command: 5, args: [] })).toEqual([])
    expect(ids({ type: 'command', args: [] })).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it.fails('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: 'a b', args: [] }), file), file).toEqual(['spaces'])
      expect(ids(command({ command: 'ab', args: [] }), file), file).toEqual([])
    }
  })

  it.fails('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (executable: string) =>
      frontmatter(
        `Stop:\n  - hooks:\n      - type: command\n        command: ${executable}\n        args: []\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml('"a b"'), file), file).toEqual(['spaces'])
      expect(markdownIds(name, yaml('ab'), file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in, and in a plugin agent', () => {
    expect(ids(command({ command: 'a b', args: [] }), FILES.hidden)).toEqual([])
    const yaml =
      'Stop:\n  - hooks:\n      - type: command\n        command: "a b"\n        args: []\n'
    expect(markdownIds(name, frontmatter(yaml), pluginAgent())).toEqual([])
  })

  it.fails('is silent on a config that is malformed', () => {
    expect(jsonIds(name, settings([]), FILES.project)).toEqual([])
    expect(
      jsonIds(name, settings({ Stop: [{ hooks: [{ type: 'command' }] }] }), FILES.project),
    ).toEqual([])
  })
})
