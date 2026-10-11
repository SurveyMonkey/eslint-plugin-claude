// Claude Code copies an installed plugin into its cache. "Files outside the plugin directory aren't
// copied, so when a script inside a copied plugin reads a path above the plugin root, such as
// `../shared`, it doesn't find them" (loading page, "In-place and copied plugins"; the
// troubleshooting page, "Files the plugin references outside its directory aren't found"). The
// rule reports a command that names a path above `${CLAUDE_PLUGIN_ROOT}`, and a script of the
// plugin that names a path above the plugin root. It resolves the path of a script from the folder
// of the script. The trees are on disk. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-no-parent-path-escape'
const check = it.fails
const linked = noLinks ? it.skip : check
const FILES = [
  '**/.claude-plugin/plugin.json',
  '**/hooks/hooks.json',
  '**/.mcp.json',
  '**/monitors/monitors.json',
]

const ROOT = `\${CLAUDE_PLUGIN_ROOT}`
const advice =
  'Claude Code copies an installed plugin into its cache, and the copy has no files outside the plugin directory. Move the files into the plugin, or reach them through a link inside the plugin.'
const commandMessage = (word: string) =>
  `This command names "${word}", which is above the plugin root. ${advice}`
const scriptMessage = (script: string, word: string) =>
  `The script "${script}" names "${word}", which is above the plugin root. ${advice}`

const monitorOf = (command: string) => [{ name: 'm', description: 'd', command }]
/** The messages for a monitor `command` in a plugin that holds `files`. */
function run(command: string, files: Record<string, string> = {}) {
  const { dir } = pluginTree({ name: 'p' }, files)
  const code = JSON.stringify(monitorOf(command))
  return lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code).map(
    (m) => m.message,
  )
}
/** The messages of the script `text` at `name`, which a monitor runs. */
const runScript = (text: string, name = 'run.sh') => run(`bash ${ROOT}/${name}`, { [name]: text })

describe(RULE, () => {
  check('reports a command that names a path above the root, with the full message', () => {
    const code = JSON.stringify(monitorOf(`cat ${ROOT}/../shared/x`))
    const { dir } = pluginTree({ name: 'p' })
    const found = lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'command',
      message: commandMessage(`${ROOT}/../shared/x`),
      line: 1,
      column: code.indexOf('"cat ') + 1,
    })
  })

  check.each([
    ['the bare variable', 'cat $CLAUDE_PLUGIN_ROOT/../x', '$CLAUDE_PLUGIN_ROOT/../x'],
    ['a quoted path', `cat "${ROOT}/../x"`, `${ROOT}/../x`],
    [
      'a quote after the bare variable',
      'cat "$CLAUDE_PLUGIN_ROOT"/../x',
      '$CLAUDE_PLUGIN_ROOT"/../x',
    ],
    ['the parent alone', `ls ${ROOT}/..`, `${ROOT}/..`],
    ['two levels in a row', `ls ${ROOT}/a/../../x`, `${ROOT}/a/../../x`],
    ['a path after a pipe', `echo | cat ${ROOT}/../x`, `${ROOT}/../x`],
  ])('reports %s', (_title, command, word) => {
    expect(run(command)).toEqual([commandMessage(word)])
  })

  check('reports a command once, for its first path', () => {
    expect(run(`cat ${ROOT}/../a ${ROOT}/../b`)).toEqual([commandMessage(`${ROOT}/../a`)])
  })

  check.each([
    ['a path in the root', `cat ${ROOT}/a/b`],
    ['a parent that stays in the root', `cat ${ROOT}/a/../b`],
    ['the root alone', `ls ${ROOT}`],
    ['a path with a dot segment', `cat ${ROOT}/./a`],
    ['a name that starts with two dots', `cat ${ROOT}/..hidden`],
    ['a relative parent, which depends on the working folder', 'cat ../shared/x'],
    ['the data folder', `cat \${CLAUDE_PLUGIN_DATA}/../x`],
    ['text after the variable', `cat ${ROOT}x/../y`],
    ['another variable in the path', `cat ${ROOT}/../$X`],
    ['a longer variable name', 'cat $CLAUDE_PLUGIN_ROOT_DIR/../x'],
  ])('stays silent for %s', (_title, command) => {
    expect(run(command)).toEqual([])
  })

  check('reports a script that names a path above the root, with the full message', () => {
    expect(runScript('set -e\ncat ../shared/x\n')).toEqual([
      scriptMessage(`${ROOT}/run.sh`, '../shared/x'),
    ])
  })

  check.each([
    [
      'a script in a folder, two levels up',
      'scripts/run.sh',
      'cat ../../shared/x',
      '../../shared/x',
    ],
    [
      'a path from the root variable',
      'run.sh',
      'cat "$CLAUDE_PLUGIN_ROOT/../shared"',
      '$CLAUDE_PLUGIN_ROOT/../shared',
    ],
    ['a braced variable', 'run.sh', `cat "${ROOT}/../shared"`, `${ROOT}/../shared`],
    ['a path in the middle', 'run.sh', 'cat a/../../x', 'a/../../x'],
    ['an attached redirect', 'run.sh', 'cat <../x', '../x'],
    ['a redirect target', 'run.sh', 'echo x > ../out', '../out'],
    ['the parent alone', 'run.sh', 'cd ..', '..'],
    ['a path after a pipe', 'run.sh', 'ls | tee ../log', '../log'],
    ['a path after an assignment', 'run.sh', 'X=1 source ../env.sh', '../env.sh'],
  ])('reports %s', (_title, name, line, word) => {
    expect(runScript(`${line}\n`, name)).toEqual([scriptMessage(`${ROOT}/${name}`, word)])
  })

  check('reports a script once, for its first path', () => {
    expect(runScript('cat ../a\ncat ../b\n')).toEqual([scriptMessage(`${ROOT}/run.sh`, '../a')])
  })

  check('reports the command and each script that names a path above the root', () => {
    const files = { 'a.sh': 'cat ../a', 'b.sh': 'echo ok' }
    expect(run(`${ROOT}/a.sh && node ${ROOT}/b.sh && cat ${ROOT}/../c`, files)).toEqual([
      commandMessage(`${ROOT}/../c`),
      scriptMessage(`${ROOT}/a.sh`, '../a'),
    ])
  })

  check.each([
    ['a path in the folder', 'cat ./x'],
    ['a plain name', 'cat x'],
    ['a parent that stays in the plugin', 'cat ../lib/x'],
    ['a path with a variable', 'cat "$(dirname "$0")/../../x"'],
    ['a path with a variable name', 'cat $HOME/../x'],
    ['an absolute path', 'cat /usr/../etc/x'],
    ['a home path', 'cat ~/../x'],
    ['a URL', 'curl https://example.com/a/../b'],
    ['a glob', 'cat ../*.txt'],
    ['a name with dots', 'cat ..hidden ..x/y'],
    ['a flag', 'git log --since=../x'],
    ['a comment line', '# cat ../../x'],
    ['a comment after a command', 'echo ok # see ../../x'],
    ['the data folder', 'cat "$CLAUDE_PLUGIN_DATA/../x"'],
  ])('stays silent for a script with %s', (_title, line) => {
    expect(runScript(`${line}\n`, 'scripts/run.sh')).toEqual([])
  })

  check('stays silent for a script that is not there', () => {
    expect(run(`bash ${ROOT}/missing.sh`)).toEqual([])
  })

  check('stays silent for a binary script', () => {
    expect(runScript('\0 ../../x')).toEqual([])
  })

  linked('stays silent for a script that is a link out of the repository', () => {
    const { dir, top } = pluginTree({ name: 'p' })
    const elsewhere = tree({ 's.sh': 'cat ../x' }, false)
    link(top, 's.sh', path.join(elsewhere, 's.sh'))
    const code = JSON.stringify(monitorOf(`bash ${ROOT}/s.sh`))
    expect(lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code)).toEqual([])
  })

  check('reports a shell-form hook, and stays silent for an exec-form hook', () => {
    const { dir } = pluginTree({ name: 'p' })
    const hook = (extra: object) => ({
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: `cat ${ROOT}/../x`, ...extra }] }],
      },
    })
    const file = path.join(dir, 'hooks/hooks.json')
    const shell = lintPluginFile(RULE, FILES, file, JSON.stringify(hook({})))
    expect(shell.map((m) => m.message)).toEqual([commandMessage(`${ROOT}/../x`)])
    expect(lintPluginFile(RULE, FILES, file, JSON.stringify(hook({ args: ['x'] })))).toEqual([])
  })

  check('reports a headersHelper of .mcp.json', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify({
      mcpServers: { s: { url: 'https://a.example/mcp', headersHelper: `cat ${ROOT}/../x` } },
    })
    const found = lintPluginFile(RULE, FILES, path.join(dir, '.mcp.json'), code)
    expect(found.map((m) => m.message)).toEqual([commandMessage(`${ROOT}/../x`)])
  })

  check('stays silent in a folder that is no plugin', () => {
    const top = tree({})
    const code = JSON.stringify(monitorOf(`cat ${ROOT}/../x`))
    expect(lintPluginFile(RULE, FILES, path.join(top, 'monitors/monitors.json'), code)).toEqual([])
  })
})
