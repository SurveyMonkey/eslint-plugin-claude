// A plugin cannot know where Claude Code installs it, so a plugin hook reaches its files through
// `${CLAUDE_PLUGIN_ROOT}` "rather than fixed paths"
// (https://code.claude.com/docs/en/plugins/components#path-variables-and-persistent-data). The hooks
// reference shows the same variable in the example of a plugin script
// (https://code.claude.com/docs/en/hooks#reference-scripts-by-path). The rule reads a plugin `hooks.json`
// only. The subagents page shows `./scripts/...` in a project settings file as a working hook
// (https://code.claude.com/docs/en/sub-agents#project-level-hooks-for-subagent-events), and the hooks
// reference says "Use absolute paths", so a project hook and an absolute path get no report.
import { describe, expect, it } from 'vitest'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  settings,
} from '../hooks.test-support.ts'
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-command-path-variable'
/** The placeholder `${variable}`, in a string that is not a template. */
const dir = (variable: string) => `\${${variable}}`
const ids = (handler: object, file = FILES.plugin) =>
  jsonIds(name, settings(hooks('PostToolUse', [handler])), file)
const shell = (line: string, file = FILES.plugin) => ids(command({ command: line }), file)

describe(`${name}: the report`, () => {
  it('reports a plugin hook with ./scripts/a.sh', () => {
    expect(shell('./scripts/a.sh')).toEqual(['relative'])
  })

  it('reports a path that starts in the working directory, in each form', () => {
    for (const line of [
      'scripts/a.sh',
      '../scripts/a.sh',
      './scripts/a.sh --flag',
      'FOO=1 ./scripts/a.sh',
      'exec ./scripts/a.sh',
      'echo hi && ./scripts/a.sh',
      '"./scripts/a.sh"',
    ]) {
      expect(shell(line), line).toEqual(['relative'])
    }
  })

  it('reports the script that an interpreter runs', () => {
    for (const line of [
      'bash scripts/a.sh',
      'sh ./a.sh',
      'node scripts/a.js',
      'python3 -u scripts/a.py',
      'env FOO=1 node scripts/a.js',
    ]) {
      expect(shell(line), line).toEqual(['relative'])
    }
  })

  it('reports exec form, in the command and in the first script argument', () => {
    expect(ids({ type: 'command', command: './scripts/a.sh', args: [] })).toEqual(['relative'])
    expect(ids({ type: 'command', command: 'node', args: ['scripts/a.js', 'x'] })).toEqual([
      'relative',
    ])
  })

  it('reports a command hook in a plugin skill', () => {
    const text = frontmatter(
      'PostToolUse:\n  - hooks:\n      - type: command\n        command: ./a.sh\n',
    )
    expect(markdownIds(name, text, pluginSkill())).toEqual(['relative'])
  })

  it('reports once for each handler, at the command, and names the path', () => {
    const text =
      '{\n  "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "./a.sh; ./b.sh"}]}]}\n}'
    const found = lintJson(name, text, FILES.plugin)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['relative', 2, 64],
    ])
    expect(found[0]?.message).toBe(
      `The plugin hook runs "./a.sh" from the working directory, but Claude Code installs a plugin in a directory that you do not know. Write the path with "${dir('CLAUDE_PLUGIN_ROOT')}".`,
    )
  })
})

describe(`${name}: the silent cases`, () => {
  it(`is silent for ${dir('CLAUDE_PLUGIN_ROOT')}/scripts/a.sh`, () => {
    for (const line of [
      `${dir('CLAUDE_PLUGIN_ROOT')}/scripts/a.sh`,
      `"${dir('CLAUDE_PLUGIN_ROOT')}"/scripts/a.sh`,
      '$CLAUDE_PLUGIN_ROOT/scripts/a.sh',
      `bash ${dir('CLAUDE_PLUGIN_ROOT')}/scripts/a.sh`,
      `${dir('CLAUDE_PLUGIN_DATA')}/bin/run`,
    ]) {
      expect(shell(line), line).toEqual([])
    }
  })

  it('is silent for a bare name, an absolute path and a home path', () => {
    for (const line of [
      'jq .',
      'a.sh',
      '/usr/local/bin/tool',
      '~/bin/tool',
      'C:/tools/a.exe',
      '$HOME/bin/tool',
    ]) {
      expect(shell(line), line).toEqual([])
    }
  })

  it('is silent for a relative path that is an argument and not a script', () => {
    for (const line of [
      'rm -rf ./tmp',
      'git add ./docs',
      'echo ./a.sh',
      'node -v',
      'bash -c "x"',
    ]) {
      expect(shell(line), line).toEqual([])
    }
  })

  it('is silent for exec form with the variable', () => {
    expect(
      ids({ type: 'command', command: `${dir('CLAUDE_PLUGIN_ROOT')}/a.sh`, args: ['./x'] }),
    ).toEqual([])
    expect(
      ids({ type: 'command', command: 'node', args: [`${dir('CLAUDE_PLUGIN_ROOT')}/a.js`] }),
    ).toEqual([])
    expect(ids({ type: 'command', command: 'node', args: [1, 'x'] })).toEqual([])
    expect(ids({ type: 'command', command: 'node', args: [] })).toEqual([])
  })

  it('is silent for a project hook, which the subagents page shows with ./scripts', () => {
    for (const file of [FILES.project, FILES.local, FILES.managed, FILES.dropIn]) {
      expect(shell('./scripts/a.sh', file), file).toEqual([])
    }
    const text = frontmatter(
      'PostToolUse:\n  - hooks:\n      - type: command\n        command: ./a.sh\n',
    )
    expect(markdownIds(name, text, FILES.agent)).toEqual([])
    expect(markdownIds(name, text, FILES.skill)).toEqual([])
  })

  it('is silent for the other handler types, and a command that is no string', () => {
    for (const type of ['http', 'prompt', 'agent', 'mcp_tool', 'other']) {
      expect(ids({ type, command: './a.sh' }), type).toEqual([])
    }
    expect(ids({ type: 'command', command: 5 })).toEqual([])
    expect(ids({ type: 'command' })).toEqual([])
    expect(ids({ command: './a.sh' })).toEqual([])
  })
})
