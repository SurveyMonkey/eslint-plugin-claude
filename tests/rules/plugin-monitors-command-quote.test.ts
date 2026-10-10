// A monitor command runs in a shell, and Claude Code puts the path of the plugin into it as plain
// text. An install path with a space then splits into several words, unless the variable sits
// inside quotes (manifest reference, "Quoting and path separators"). `claude plugin validate`
// reports an unquoted variable in `hooks/hooks.json` only, and passes the same monitor command.
// The trees are on disk, because the rule finds the plugin around the file. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-monitors-command-quote'
const check = it
const linked = noLinks ? it.skip : check
const FILES = ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json']
const MANIFEST = '.claude-plugin/plugin.json'
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)

// Escaped, so that the template literal keeps each variable as text.
const braced = (name: string) => `\${${name}}`
const ROOT = braced('CLAUDE_PLUGIN_ROOT')
const DATA = braced('CLAUDE_PLUGIN_DATA')
const message = (variable: string) =>
  `The monitor command uses \`${variable}\` outside quotes. An install path with a space splits into several words. Wrap the variable in double quotes.`

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
  check('reports a variable on the command, with the full message and the position', () => {
    const code = `{"experimental": {"monitors": [{"command": "node ${ROOT}/m.js"}]}}`
    const { dir } = pluginTree(code)
    const found = lint(dir, MANIFEST, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unquoted',
      message: message(ROOT),
      line: 1,
      column: 44,
      endColumn: 77,
    })
  })

  check.each([
    ['the plugin root', ROOT],
    ['the data directory', DATA],
  ])('reports %s outside quotes', (_title, variable) => {
    expect(runCommand(`node ${variable}/m.js`)).toEqual([message(variable)])
    expect(runCommand(`${variable}/m.sh --x`)).toEqual([message(variable)])
    expect(runCommand(`tail -F ${variable}`)).toEqual([message(variable)])
  })

  check.each([
    ['after a closed double quote', `echo "a" ${ROOT}/m.js`],
    ['between two quoted words', `echo "a"${ROOT}"b"`],
    ['after a closed single quote', `echo 'a' ${ROOT}/m.js`],
    ['after an escaped quote', `echo \\"${ROOT}/m.js`],
    ['after an escaped quote in a quote', `echo "a\\"" ${ROOT}/m.js`],
    ['in a quote that holds a dollar sign', `echo "$HOME" ${ROOT}/m.js`],
    ['after a single quote that holds a backslash', `echo '\\' ${ROOT}/m.js`],
  ])('reports a variable %s', (_title, command) => {
    expect(runCommand(command)).toEqual([message(ROOT)])
  })

  check('reports a variable that a quote follows, and not the next one in the quote', () => {
    expect(runCommand(`${ROOT}"${DATA}"`)).toEqual([message(ROOT)])
  })

  check('reports a variable of the top-level monitors key', () => {
    expect(runManifest({ monitors: monitorOf(`node ${ROOT}/m.js`) })).toEqual([message(ROOT)])
  })

  check('reports a variable in monitors/monitors.json', () => {
    expect(run('monitors/monitors.json', monitorOf(`node ${ROOT}/m.js`))).toEqual([message(ROOT)])
  })

  check('reports each variable once, in order of first use', () => {
    expect(runCommand(`${ROOT}/a ${DATA}/b ${ROOT}/c`)).toEqual([message(ROOT), message(DATA)])
  })

  check('reports an unquoted variable beside a quoted one', () => {
    expect(runCommand(`"${ROOT}"/a ${DATA}/b`)).toEqual([message(DATA)])
  })

  check('reports each monitor', () => {
    const monitors = [
      ...monitorOf(`${ROOT}/a`),
      ...monitorOf(`"${ROOT}"`),
      ...monitorOf(`${DATA}/b`),
    ]
    expect(runManifest({ experimental: { monitors } })).toEqual([message(ROOT), message(DATA)])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    const code = JSON.stringify(monitorOf(`node ${ROOT}/m.js`))
    expect(lint(dir, 'monitors/monitors.json', code)).toHaveLength(1)
  })

  check('reports monitors/monitors.json when the manifest names that file', () => {
    const manifest = { name: 'p', experimental: { monitors: './monitors/monitors.json' } }
    expect(run('monitors/monitors.json', monitorOf(`node ${ROOT}/m.js`), manifest)).toEqual([
      message(ROOT),
    ])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['the whole path in double quotes', `node "${ROOT}/m.js"`],
    ['the variable in double quotes, and the rest outside', `node "${ROOT}"/m.js`],
    ['the data directory in double quotes', `tail -F "${DATA}/log"`],
    ['a variable in single quotes', `node '${ROOT}/m.js'`],
    ['a variable in the middle of a quoted word', `node "a ${ROOT} b"`],
    ['a quote that holds an escaped quote', `node "a\\" ${ROOT}"`],
    ['a quote that is not closed', `node "${ROOT}/m.js`],
    ['a single quote inside double quotes', `node "it's ${ROOT}"`],
    ['both variables in quotes', `cp "${ROOT}/a" "${DATA}/b"`],
  ])('stays silent for %s', (_title, command) => {
    expect(runCommand(command)).toEqual([])
  })

  check.each([
    ['a command substitution', `node "$(dirname ${ROOT})/m.js" ${ROOT}`],
    ['a backtick', `node \`dirname ${ROOT}\``],
  ])('stays silent for %s, where quotes nest', (_title, command) => {
    expect(runCommand(command)).toEqual([])
  })

  check.each([
    ['a bare root, which plugin-monitors-command-env reports', '$CLAUDE_PLUGIN_ROOT/m.js'],
    ['a braced option', braced('CLAUDE_PLUGIN_OPTION_TOKEN')],
    ['the project directory', braced('CLAUDE_PROJECT_DIR')],
    ['a longer name', braced('CLAUDE_PLUGIN_ROOT_DIR')],
    ['a user_config reference, which another rule reports', braced('user_config.token')],
    ['a command with no variable', 'tail -F ./logs/error.log'],
    ['an empty command', ''],
  ])('stays silent for %s', (_title, command) => {
    expect(runCommand(`node ${command}`)).toEqual([])
  })

  check('stays silent for a variable outside the command', () => {
    const monitors = [{ name: ROOT, description: DATA, command: 'x' }]
    expect(runManifest({ experimental: { monitors } })).toEqual([])
  })

  check.each([
    ['a command that is no string', [{ command: 3 }, { command: [ROOT] }]],
    ['an entry that is no object', [ROOT, null, 3]],
  ])('stays silent for %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors } })).toEqual([])
  })

  check.each([
    ['a path', './monitors.json'],
    ['an object', { command: ROOT }],
    ['a number', 3],
  ])('stays silent for monitors set to %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors }, monitors })).toEqual([])
  })

  check('stays silent for hooks and servers, which validate or no rule reads', () => {
    const hooks = { Stop: [{ hooks: [{ type: 'command', command: `${ROOT}/h.sh` }] }] }
    const mcpServers = { a: { command: `${ROOT}/s.sh`, headersHelper: DATA } }
    expect(runManifest({ hooks, mcpServers })).toEqual([])
  })

  check.each([
    ['an inline experimental monitors array', { experimental: { monitors: [] } }],
    ['an inline top-level monitors array', { monitors: [] }],
    ['a path to another file', { experimental: { monitors: './other.json' } }],
  ])('stays silent in monitors/monitors.json when the manifest sets %s', (_title, fields) => {
    const manifest = { name: 'p', ...fields }
    expect(run('monitors/monitors.json', monitorOf(`node ${ROOT}/m.js`), manifest)).toEqual([])
  })

  check('stays silent for monitors/monitors.json that is not an array', () => {
    expect(run('monitors/monitors.json', { command: ROOT })).toEqual([])
  })

  check('stays silent for a file that sits in no plugin', () => {
    const code = JSON.stringify(monitorOf(`node ${ROOT}/m.js`))
    expect(lint(tree({}), 'monitors/monitors.json', code)).toEqual([])
  })

  check.each([
    ['other/monitors.json', 'other/monitors.json'],
    ['monitors/other.json', 'monitors/other.json'],
    ['.claude-plugin/other.json', '.claude-plugin/other.json'],
    ['hooks/hooks.json', 'hooks/hooks.json'],
    ['.mcp.json', '.mcp.json'],
  ])('stays silent for a file with the name %s', (_title, file) => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify({ monitors: monitorOf(`node ${ROOT}`) })
    expect(lintPluginFile(RULE, ['**/*.json'], path.join(dir, file), code)).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    const code = JSON.stringify(monitorOf(`node ${ROOT}`))
    expect(lint(top, 'monitors/monitors.json', code)).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text)
    const code = JSON.stringify(monitorOf(`node ${ROOT}`))
    expect(lint(dir, 'monitors/monitors.json', code)).toEqual([])
  })
})
