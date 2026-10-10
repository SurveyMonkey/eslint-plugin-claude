// A monitor process gets none of the plugin variables in its environment. Claude
// Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the
// command, and exports no `CLAUDE_PLUGIN_OPTION_<KEY>` (manifest reference,
// "Where each variable resolves"). The trees are on disk, because the rule
// finds the plugin around the file. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-monitors-command-env'
const check = it.fails
const linked = noLinks ? it.skip : check
const FILES = ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json']
const MANIFEST = '.claude-plugin/plugin.json'
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)

// Escaped, so that the template literal keeps each variable as text.
const braced = (name: string) => `\${${name}}`
const path_ = (variable: string) =>
  `Claude Code does not export \`$${variable}\` to a monitor process. Write \`${braced(variable)}\`, which Claude Code substitutes in the command.`
const option = (variable: string) =>
  `Claude Code does not export \`$${variable}\` to a monitor process. A monitor cannot read a plugin option. Have the monitor script read the value from a config file.`

const monitorOf = (command: unknown) => [{ name: 'm', description: 'd', command }]
/** The messages for a monitors array at `file` in a plugin that has the manifest `manifest`. */
const run = (file: string, value: unknown, manifest: unknown = { name: 'p' }) => {
  const { dir } = pluginTree(manifest)
  return lint(dir, file, JSON.stringify(value)).map((m) => m.message)
}
/** The messages for a manifest that sets `fields`. */
const runManifest = (fields: Record<string, unknown>) => {
  const manifest = { name: 'p', ...fields }
  return run(MANIFEST, manifest, manifest)
}
const runCommand = (command: string) =>
  runManifest({ experimental: { monitors: monitorOf(command) } })

describe(RULE, () => {
  check('reports a variable on the command, with the full message', () => {
    const code = '{"experimental": {"monitors": [{"command": "tail -F $CLAUDE_PLUGIN_DATA/log"}]}}'
    const { dir } = pluginTree(code)
    const found = lint(dir, MANIFEST, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'pathVariable',
      message: path_('CLAUDE_PLUGIN_DATA'),
      line: 1,
      column: 40,
      endColumn: 76,
    })
  })

  check.each([
    ['$CLAUDE_PLUGIN_ROOT', 'CLAUDE_PLUGIN_ROOT', path_],
    ['$CLAUDE_PLUGIN_DATA', 'CLAUDE_PLUGIN_DATA', path_],
    ['$CLAUDE_PLUGIN_OPTION_API_TOKEN', 'CLAUDE_PLUGIN_OPTION_API_TOKEN', option],
    ['$CLAUDE_PLUGIN_OPTION_a1', 'CLAUDE_PLUGIN_OPTION_a1', option],
  ])('reports %s', (text, variable, make) => {
    expect(runCommand(`"${text}"/run.sh --x`)).toEqual([make(variable)])
    expect(runCommand(text)).toEqual([make(variable)])
    expect(runCommand(`${text}/run.sh`)).toEqual([make(variable)])
    expect(runCommand(`echo ${text}.log`)).toEqual([make(variable)])
  })

  check('reports a variable of the top-level monitors key', () => {
    expect(runManifest({ monitors: monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh') })).toEqual([
      path_('CLAUDE_PLUGIN_ROOT'),
    ])
  })

  check('reports a variable in monitors/monitors.json', () => {
    expect(run('monitors/monitors.json', monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh'))).toEqual([
      path_('CLAUDE_PLUGIN_ROOT'),
    ])
  })

  check('reports each variable once, in order of first use', () => {
    const command =
      '$CLAUDE_PLUGIN_ROOT/a $CLAUDE_PLUGIN_DATA/b $CLAUDE_PLUGIN_ROOT/c $CLAUDE_PLUGIN_OPTION_X'
    expect(runCommand(command)).toEqual([
      path_('CLAUDE_PLUGIN_ROOT'),
      path_('CLAUDE_PLUGIN_DATA'),
      option('CLAUDE_PLUGIN_OPTION_X'),
    ])
  })

  check('reports each monitor', () => {
    const monitors = [
      ...monitorOf('$CLAUDE_PLUGIN_ROOT/a'),
      ...monitorOf('ok'),
      ...monitorOf('$CLAUDE_PLUGIN_DATA/b'),
    ]
    expect(runManifest({ experimental: { monitors } })).toEqual([
      path_('CLAUDE_PLUGIN_ROOT'),
      path_('CLAUDE_PLUGIN_DATA'),
    ])
  })

  check('reports a variable beside a braced one', () => {
    const command = `${braced('CLAUDE_PLUGIN_ROOT')}/a $CLAUDE_PLUGIN_ROOT/b`
    expect(runCommand(command)).toEqual([path_('CLAUDE_PLUGIN_ROOT')])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    const code = JSON.stringify(monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh'))
    expect(lint(dir, 'monitors/monitors.json', code)).toHaveLength(1)
  })

  check('reports monitors/monitors.json when the manifest names that file', () => {
    const manifest = { name: 'p', experimental: { monitors: './monitors/monitors.json' } }
    expect(run('monitors/monitors.json', monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh'), manifest)).toEqual([
      path_('CLAUDE_PLUGIN_ROOT'),
    ])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a braced root', braced('CLAUDE_PLUGIN_ROOT')],
    ['a braced root in quotes', `"${braced('CLAUDE_PLUGIN_ROOT')}"/run.sh`],
    ['a braced data variable', `tail -F "${braced('CLAUDE_PLUGIN_DATA')}/log"`],
    ['a braced option, which this rule does not read', braced('CLAUDE_PLUGIN_OPTION_TOKEN')],
    ['a longer name', '$CLAUDE_PLUGIN_ROOT_DIR $CLAUDE_PLUGIN_DATAS $CLAUDE_PLUGIN_ROOTX'],
    ['an option prefix with no name', '$CLAUDE_PLUGIN_OPTION_'],
    ['a name with no dollar sign', 'CLAUDE_PLUGIN_ROOT'],
    ['another plugin variable', '$CLAUDE_PROJECT_DIR $CLAUDE_PLUGIN_OPTIONS'],
    [
      'a user_config reference, which another rule reports',
      `./m.sh ${braced('user_config.token')}`,
    ],
    ['a command with no variable', 'tail -F ./logs/error.log'],
    ['an empty command', ''],
  ])('stays silent for %s', (_title, command) => {
    expect(runCommand(command)).toEqual([])
  })

  check('stays silent for a variable outside the command', () => {
    const monitors = [
      { name: '$CLAUDE_PLUGIN_ROOT', description: '$CLAUDE_PLUGIN_DATA', command: 'x' },
    ]
    expect(runManifest({ experimental: { monitors } })).toEqual([])
  })

  check.each([
    ['a command that is no string', [{ command: 3 }, { command: ['$CLAUDE_PLUGIN_ROOT'] }]],
    ['an entry that is no object', ['$CLAUDE_PLUGIN_ROOT', null, 3]],
  ])('stays silent for %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors } })).toEqual([])
  })

  check.each([
    ['a path', './monitors.json'],
    ['an object', { command: '$CLAUDE_PLUGIN_ROOT' }],
    ['a number', 3],
  ])('stays silent for monitors set to %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors }, monitors })).toEqual([])
  })

  check('stays silent for hooks and servers, which another rule or no rule reads', () => {
    const hooks = {
      Stop: [{ hooks: [{ type: 'command', command: '$CLAUDE_PLUGIN_ROOT/h.sh' }] }],
    }
    const mcpServers = {
      a: { command: '$CLAUDE_PLUGIN_ROOT/s.sh', headersHelper: '$CLAUDE_PLUGIN_DATA' },
    }
    expect(runManifest({ hooks, mcpServers })).toEqual([])
  })

  check.each([
    ['an inline experimental monitors array', { experimental: { monitors: [] } }],
    ['an inline top-level monitors array', { monitors: [] }],
    ['a path to another file', { experimental: { monitors: './other.json' } }],
  ])('stays silent in monitors/monitors.json when the manifest sets %s', (_title, fields) => {
    const manifest = { name: 'p', ...fields }
    expect(run('monitors/monitors.json', monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh'), manifest)).toEqual(
      [],
    )
  })

  check('stays silent for monitors/monitors.json that is not an array', () => {
    expect(run('monitors/monitors.json', { command: '$CLAUDE_PLUGIN_ROOT' })).toEqual([])
  })

  check('stays silent for a file that sits in no plugin', () => {
    const code = JSON.stringify(monitorOf('$CLAUDE_PLUGIN_ROOT/m.sh'))
    expect(lint(tree({}), 'monitors/monitors.json', code)).toEqual([])
  })

  check.each([
    ['other/monitors.json', 'other/monitors.json'],
    ['monitors/other.json', 'monitors/other.json'],
    ['.claude-plugin/other.json', '.claude-plugin/other.json'],
    ['hooks/hooks.json', 'hooks/hooks.json'],
  ])('stays silent for a file with the name %s', (_title, file) => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify({ monitors: monitorOf('$CLAUDE_PLUGIN_ROOT') })
    expect(lintPluginFile(RULE, ['**/*.json'], path.join(dir, file), code)).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    const code = JSON.stringify(monitorOf('$CLAUDE_PLUGIN_ROOT'))
    expect(lint(top, 'monitors/monitors.json', code)).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text)
    const code = JSON.stringify(monitorOf('$CLAUDE_PLUGIN_ROOT'))
    expect(lint(dir, 'monitors/monitors.json', code)).toEqual([])
  })
})
