// The hooks reference says to set `args` whenever a hook references a path placeholder: each element
// of `args` is one argument with no quoting (https://code.claude.com/docs/en/hooks#reference-scripts-by-path
// and #exec-form-and-shell-form). It also says to omit `args` when the hook needs shell features such
// as pipes or `&&`, so the rule reads a line of one simple command only.
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

const name = 'hooks-prefer-exec-form'
const ids = (handler: object, file = FILES.project) =>
  jsonIds(name, settings(hooks('PostToolUse', [handler], 'Write')), file)
const run = (text: string, fields: Record<string, unknown> = {}) =>
  ids(command({ command: text, ...fields }))
const dir = (variable: string) => `\${${variable}}`
const P = dir('CLAUDE_PROJECT_DIR')

describe(`${name}: shell form with a placeholder`, () => {
  it('reports a placeholder in a shell-form command', () => {
    for (const text of [
      `${P}/a.sh`,
      `"${dir('CLAUDE_PLUGIN_ROOT')}/a.sh" --fix`,
      `node "${dir('CLAUDE_PLUGIN_DATA')}"/x.js`,
      `bash '${P}/a.sh'`,
      `exec ${P}/a.sh`,
    ]) {
      expect(run(text), text).toEqual(['exec'])
    }
  })

  it('reports with an explicit bash shell, and when args is no array', () => {
    expect(run(`${P}/a.sh`, { shell: 'bash' })).toEqual(['exec'])
    expect(run(`${P}/a.sh`, { args: 'x' })).toEqual(['exec'])
  })

  it('reports once for a handler', () => {
    expect(run(`${P}/a.sh ${P}/b.sh`)).toEqual(['exec'])
  })

  it('reports at the command string', () => {
    const text = `{\n  "hooks": {\n    "Stop": [{"hooks": [{"type": "command", "command": "${P}/a.sh"}]}]\n  }\n}`
    const [message] = lintJson(name, text, FILES.project)
    expect([message?.line, message?.column]).toEqual([3, 56])
    expect(message?.message).toBe(
      'This command references a path placeholder in shell form. Set "args" for exec form: "command" is the executable, and each "args" item is one argument with no quoting.',
    )
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent in exec form', () => {
    expect(run(`${P}/a.sh`, { args: [] })).toEqual([])
    expect(run('node', { args: [`${P}/a.js`] })).toEqual([])
  })

  it('is silent when the command has no path placeholder', () => {
    for (const text of [
      './a.sh',
      '',
      'echo $CLAUDE_PROJECT_DIR/a',
      `echo ${dir('CLAUDE_ENV_FILE')}`,
      `echo ${dir('user_config.x')}`,
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it('is silent when the line needs a shell', () => {
    for (const text of [
      `${P}/a.sh | grep x`,
      `${P}/a.sh && ${P}/b.sh`,
      `${P}/a.sh; ${P}/b.sh`,
      `${P}/a.sh > out.txt`,
      `${P}/a.sh < in.txt`,
      `${P}/a.sh &`,
      `${P}/*.sh`,
      `${P}/a?.sh`,
      `echo $HOME ${P}/a.sh`,
      `FOO=1 ${P}/a.sh`,
      `echo $(cat ${P}/a)`,
      `echo \`cat ${P}/a\``,
      `${P}/a.sh\n${P}/b.sh`,
      `(${P}/a.sh)`,
      `${P}/t[12].sh`,
      `${P}/{a,b}.sh`,
      `~/bin/tool ${P}/f`,
      `${P}/a.sh # note`,
      `${P}/a.sh !x`,
    ]) {
      expect(run(text), text).toEqual([])
    }
  })

  it('skips leading space before it reads an assignment', () => {
    expect(run(`  FOO=1 ${P}/a.sh`)).toEqual([])
  })

  it('is silent for a PowerShell hook, which this rule leaves to its author', () => {
    expect(run(`& "${P}\\a.ps1"`, { shell: 'powershell' })).toEqual([])
  })

  it('is silent for a handler that is no command hook, and for a command that is no string', () => {
    expect(ids({ type: 'http', url: `${P}/a`, command: `${P}/a` })).toEqual([])
    expect(ids({ type: 'prompt', prompt: P })).toEqual([])
    expect(ids({ type: 'command', command: 1 })).toEqual([])
    expect(ids({ type: 'command' })).toEqual([])
  })
})

describe(`${name}: the files`, () => {
  it('reads every settings file and the hooks.json of a plugin', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(command({ command: `${P}/a.sh` }), file), file).toEqual(['exec'])
      expect(ids(command({ command: `${P}/a.sh`, args: [] }), file), file).toEqual([])
    }
  })

  it('reads the frontmatter of a skill and of a project subagent', () => {
    const yaml = (extra: string) =>
      frontmatter(
        `PostToolUse:\n  - matcher: Write\n    hooks:\n      - type: command\n        command: '${P}/a.sh'\n${extra}`,
      )
    for (const file of [FILES.skill, FILES.agent]) {
      expect(markdownIds(name, yaml(''), file), file).toEqual(['exec'])
      expect(markdownIds(name, yaml('        args: []\n'), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in, and in a hooks.json of a hidden folder', () => {
    expect(ids(command({ command: `${P}/a.sh` }), FILES.hidden)).toEqual([])
    expect(ids(command({ command: `${P}/a.sh` }), '/repo/.github/hooks/hooks.json')).toEqual([])
  })
})
