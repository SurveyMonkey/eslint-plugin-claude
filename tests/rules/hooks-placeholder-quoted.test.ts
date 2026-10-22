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
  it('reports a placeholder outside quotes', () => {
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
      // A quoted text that looks like a mark must not hide the reference.
      `./run.sh "0 0" ${P}/x`,
      `./run.sh "1 1" ${P}/x ${P}/y`,
    ]) {
      expect(run(text), text).toEqual(['unquoted'])
    }
  })

  it('tells reference 1 from reference 11 on a line with twelve references', () => {
    // Only reference 1 is unquoted. The quoted reference 11 must not hide it.
    const refs = Array.from({ length: 12 }, (_, n) => (n === 1 ? P : `"${P}"`))
    expect(run(refs.join(' '))).toEqual(['unquoted'])
  })

  it('reports the bare environment variable form, which splits the same way', () => {
    for (const text of [
      '$CLAUDE_PROJECT_DIR/a.sh',
      'bash $CLAUDE_PLUGIN_ROOT/a.sh',
      'cat $CLAUDE_PLUGIN_DATA',
    ]) {
      expect(run(text), text).toEqual(['unquoted'])
    }
  })

  it('reports once for a handler, and once for each handler', () => {
    expect(run(`${P}/a.sh ${P}/b.sh`)).toEqual(['unquoted'])
    expect(
      jsonIds(
        name,
        settings(hooks('Stop', [command({ command: `${P}/a` }), command({ command: `${P}/b` })])),
        FILES.project,
      ),
    ).toEqual(['unquoted', 'unquoted'])
  })

  it(`reports a placeholder in the value of an unquoted \${...} expansion`, () => {
    // bash splits the value at a space: `${X:-$P}/run.sh` gives two words when `X` is unset and
    // `$P` is `/a b`.
    expect(run(`bash \${HOOK_DIR:-${P}}/run.sh`)).toEqual(['unquoted'])
    expect(run(`bash \${A:-x} \${HOOK_DIR:-${P}}/run.sh`)).toEqual(['unquoted'])
    expect(run(`bash \${HOOK_DIR:-$CLAUDE_PROJECT_DIR}/run.sh`)).toEqual(['unquoted'])
    expect(run(`bash "\${HOOK_DIR:-${P}}/run.sh"`)).toEqual([])
  })

  it(`reads a # in a \${...} expansion as bash does`, () => {
    // bash 5.3 prints `a`, `#b`, then `/a` and `b` (or `b/c`) when `$P` is `/a b`.
    expect(run(`echo \${x:-a #b} $CLAUDE_PROJECT_DIR`)).toEqual(['unquoted'])
    expect(run(`echo \${x:-a #b} ${P}/c`)).toEqual(['unquoted'])
    // bash 5.3 prints `a`, `#b`, `/a` and `b`: the placeholder is in the expansion.
    expect(run(`echo \${x:-a #b ${P}}`)).toEqual(['unquoted'])
    // bash 5.3 prints `a`, `#b`, then `/a b`. The `#` starts no comment, so the quoted
    // placeholder is one word.
    expect(run(`echo \${x:-a #b} "$CLAUDE_PROJECT_DIR"`)).toEqual([])
    expect(run(`echo \${x:-a #b} "${P}/c"`)).toEqual([])
    // bash 5.3 prints `a #b /a b`: a quote in the expansion holds the placeholder.
    expect(run(`echo \${x:-"a #b ${P}"}`)).toEqual([])
  })

  it('is silent for a placeholder in a comment, which bash does not run', () => {
    // bash 5.3 prints `hi`, and an empty line.
    expect(run(`echo hi # ${P}`)).toEqual([])
    expect(run(`echo \${x} #y ${P}`)).toEqual([])
  })

  it('reports a placeholder after a process substitution and a #', () => {
    // bash 5.3 prints `[/dev/fd/63#/a][b]`: the `#` starts no comment, and bash splits the path.
    expect(run(`printf "[%s]" <(true)#$CLAUDE_PROJECT_DIR`)).toEqual(['unquoted'])
    expect(run(`printf "[%s]" >(true)#${P}`)).toEqual(['unquoted'])
    // bash 5.3 prints `[/dev/fd/63]`: the `#` after a blank starts a comment.
    expect(run(`printf "[%s]" <(true) #${P}`)).toEqual([])
  })

  it('reports with an explicit bash shell', () => {
    expect(run(`${P}/a.sh`, { shell: 'bash' })).toEqual(['unquoted'])
  })

  it('reports at the command string and names the placeholder', () => {
    const text = `{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "bash ${P}/a.sh"}]}]\n  }\n}`
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.line, message?.column]).toEqual([3, 56])
    expect(message?.message).toBe(
      `The placeholder "${P}" is not inside quotes. A path with a space splits into words. Wrap it in double quotes, or set "args" for exec form.`,
    )
  })
})

describe(`${name}: a quoted placeholder`, () => {
  it('is silent when the placeholder is inside quotes', () => {
    for (const text of [
      `"${P}/a.sh"`,
      `"${P}"/a.sh`,
      `'${P}'/a.sh`,
      `bash "${P}/a.sh" x`,
      `bash "$CLAUDE_PROJECT_DIR/a.sh"`,
      `echo "x\\"${P}"`,
      `echo "a ${P} b"`,
      `cat "${dir('CLAUDE_PLUGIN_ROOT')}/a" "${dir('CLAUDE_PLUGIN_DATA')}/b"`,
      `a;"${P}"/b`,
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it('is silent when there is no path placeholder', () => {
    for (const text of [
      './a.sh',
      '',
      'echo $CLAUDE_PROJECT_DIR_OTHER/a',
      'echo $CLAUDE_PROJECT_DIRX',
      'echo $CLAUDE_PROJECT_DIR1/a',
      'echo $CLAUDE_PROJECT_DIRx/a',
      `echo ${dir('CLAUDE_ENV_FILE')}`,
      `echo ${dir('CLAUDE_MODEL')}`,
      'echo CLAUDE_PROJECT_DIR',
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it('is silent for a line with a command substitution, where quotes nest', () => {
    expect(run(`echo "$(cd ${P} && pwd)"`)).toEqual([])
    expect(run(`echo $(cat ${P}/a)`)).toEqual([])
    expect(run(`echo \`cat ${P}/a\``)).toEqual([])
  })
})

describe(`${name}: the handlers`, () => {
  it('is silent in exec form, where no shell reads the command', () => {
    expect(run(`${P}/a.sh`, { args: [] })).toEqual([])
    expect(run(`${P}/a.sh`, { args: [`${P}/b`] })).toEqual([])
  })

  it('reads the command as shell form when args is no array', () => {
    expect(run(`${P}/a.sh`, { args: 'x' })).toEqual(['unquoted'])
  })

  it('is silent for a PowerShell hook, which quotes in its own way', () => {
    expect(run(`& ${P}\\a.ps1`, { shell: 'powershell' })).toEqual([])
  })

  it('is silent for a handler that is no command hook, and for a command that is no string', () => {
    expect(ids({ type: 'http', url: `${P}/a`, command: `${P}/a` })).toEqual([])
    expect(ids({ type: 'prompt', prompt: P })).toEqual([])
    expect(ids({ type: 'command', command: 1 })).toEqual([])
    expect(ids({ type: 'command' })).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file', () => {
    for (const file of SETTINGS) {
      expect(ids(command({ command: `${P}/a.sh` }), file), file).toEqual(['unquoted'])
      expect(ids(command({ command: `"${P}/a.sh"` }), file), file).toEqual([])
    }
  })

  it('is silent in the hooks.json of a plugin, which claude plugin validate reports', () => {
    expect(ids(command({ command: `${dir('CLAUDE_PLUGIN_ROOT')}/a.sh` }), FILES.plugin)).toEqual([])
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (text: string) =>
      frontmatter(
        `PostToolUse:\n  - matcher: Write\n    hooks:\n      - type: command\n        command: ${text}\n`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml(`'bash ${P}/a.sh'`), file), file).toEqual(['unquoted'])
      expect(markdownIds(name, yaml(`'bash "${P}/a.sh"'`), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids(command({ command: `${P}/a.sh` }), FILES.hidden)).toEqual([])
    expect(ids(command({ command: `${P}/a.sh` }), '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
