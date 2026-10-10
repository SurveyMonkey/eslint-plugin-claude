// A path placeholder in the `command` of a shell-form hook is a text substitution. A path that holds
// a space splits into words unless the placeholder sits inside quotes. The hooks reference says to wrap
// each placeholder in double quotes (https://code.claude.com/docs/en/hooks#reference-scripts-by-path).
// `claude plugin validate` reports an unquoted placeholder in the `hooks/hooks.json` of a plugin, so
// the rule reads every other file.
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

const name = 'hooks-placeholder-quoted'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('PostToolUse', [handler], 'Write')), file)
const run = (text: string, fields: Record<string, unknown> = {}) =>
  ids(command({ command: text, ...fields }))
const dir = (variable: string) => `\${${variable}}`
const P = dir('CLAUDE_PROJECT_DIR')

describe(`${name}: an unquoted placeholder`, () => {
  it.fails('reports a placeholder outside quotes', () => {
    for (const text of [
      `${P}/a.sh`,
      `bash ${P}/a.sh x`,
      `cat ${dir('CLAUDE_PLUGIN_DATA')}/a`,
      `${dir('CLAUDE_PLUGIN_ROOT')}/a.sh`,
      `"a"${P}`,
      `FOO=${P} run`,
      `echo '"' ${P}`,
      `echo "a" ${P}`,
      `node "x" && ${P}/b.sh`,
      `echo "a b" "${P}/c" ${P}/d`,
    ]) {
      expect(run(text), text).toEqual(['unquoted'])
    }
  })

  it.fails('reports the bare environment variable form, which splits the same way', () => {
    for (const text of [
      '$CLAUDE_PROJECT_DIR/a.sh',
      'bash $CLAUDE_PLUGIN_ROOT/a.sh',
      'cat $CLAUDE_PLUGIN_DATA',
    ]) {
      expect(run(text), text).toEqual(['unquoted'])
    }
  })

  it.fails('reports once for a handler, and once for each handler', () => {
    expect(run(`${P}/a.sh ${P}/b.sh`)).toEqual(['unquoted'])
    expect(
      jsonIds(
        name,
        settings(hooks('Stop', [command({ command: `${P}/a` }), command({ command: `${P}/b` })])),
        FILES.project,
      ),
    ).toEqual(['unquoted', 'unquoted'])
  })

  it.fails('reports with an explicit bash shell', () => {
    expect(run(`${P}/a.sh`, { shell: 'bash' })).toEqual(['unquoted'])
  })

  it.fails('reports at the command string and names the placeholder', () => {
    const text = `{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "bash ${P}/a.sh"}]}]\n  }\n}`
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.line, message?.column]).toEqual([3, 56])
    expect(message?.message).toBe(
      `The placeholder "${P}" is not inside quotes. A path with a space splits into words. Wrap it in double quotes, or set "args" for exec form.`,
    )
  })
})

describe(`${name}: a quoted placeholder`, () => {
  it.fails('is silent when the placeholder is inside quotes', () => {
    for (const text of [
      `"${P}/a.sh"`,
      `"${P}"/a.sh`,
      `'${P}'/a.sh`,
      `bash "${P}/a.sh" x`,
      `bash "$CLAUDE_PROJECT_DIR/a.sh"`,
      `echo "x\\"${P}"`,
      `echo "a ${P} b"`,
      `bash ${P.replace('$', '\\$')}`,
      `cat "${dir('CLAUDE_PLUGIN_ROOT')}/a" "${dir('CLAUDE_PLUGIN_DATA')}/b"`,
      `a;"${P}"/b`,
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it.fails('is silent when there is no path placeholder', () => {
    for (const text of [
      './a.sh',
      '',
      'echo $CLAUDE_PROJECT_DIR_OTHER/a',
      'echo $CLAUDE_PROJECT_DIRX',
      `echo ${dir('CLAUDE_ENV_FILE')}`,
      `echo ${dir('CLAUDE_MODEL')}`,
      'echo CLAUDE_PROJECT_DIR',
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it.fails('is silent for a line with a command substitution, where quotes nest', () => {
    expect(run(`echo "$(cd ${P} && pwd)"`)).toEqual([])
    expect(run(`echo $(cat ${P}/a)`)).toEqual([])
    expect(run(`echo \`cat ${P}/a\``)).toEqual([])
  })
})

describe(`${name}: the handlers`, () => {
  it.fails('is silent in exec form, where no shell reads the command', () => {
    expect(run(`${P}/a.sh`, { args: [] })).toEqual([])
    expect(run(`${P}/a.sh`, { args: [`${P}/b`] })).toEqual([])
  })

  it.fails('reads the command as shell form when args is no array', () => {
    expect(run(`${P}/a.sh`, { args: 'x' })).toEqual(['unquoted'])
  })

  it.fails('is silent for a PowerShell hook, which quotes in its own way', () => {
    expect(run(`& ${P}\\a.ps1`, { shell: 'powershell' })).toEqual([])
  })

  it.fails('is silent for a handler that is no command hook, and for a command that is no string', () => {
    expect(ids({ type: 'http', url: `${P}/a`, command: `${P}/a` })).toEqual([])
    expect(ids({ type: 'prompt', prompt: P })).toEqual([])
    expect(ids({ type: 'command', command: 1 })).toEqual([])
    expect(ids({ type: 'command' })).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it.fails('reads every settings file', () => {
    for (const file of SETTINGS) {
      expect(ids(command({ command: `${P}/a.sh` }), file), file).toEqual(['unquoted'])
      expect(ids(command({ command: `"${P}/a.sh"` }), file), file).toEqual([])
    }
  })

  it.fails('is silent in the hooks.json of a plugin, which claude plugin validate reports', () => {
    expect(ids(command({ command: `${dir('CLAUDE_PLUGIN_ROOT')}/a.sh` }), FILES.plugin)).toEqual([])
  })

  it.fails('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (text: string) =>
      frontmatter(
        `PostToolUse:\n  - matcher: Write\n    hooks:\n      - type: command\n        command: ${text}\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml(`'bash ${P}/a.sh'`), file), file).toEqual(['unquoted'])
      expect(markdownIds(name, yaml(`'bash "${P}/a.sh"'`), file), file).toEqual([])
    }
  })

  it.fails('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids(command({ command: `${P}/a.sh` }), FILES.hidden)).toEqual([])
    expect(ids(command({ command: `${P}/a.sh` }), '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
