// A plugin does not know where Claude Code installs it, so it names its files through
// `${CLAUDE_PLUGIN_ROOT}` "rather than fixed paths". The variables are substituted "in hook and
// monitor commands, and in MCP and LSP server configurations" (components page, "Reference plugin
// paths and store data"). `hooks-command-path-variable` owns the hook commands, and
// `mcp-plugin-root-paths` owns the MCP servers. This rule reads the monitor commands and the LSP
// servers. It reports a relative path. The trees are on disk. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import claude from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-path-uses-plugin-root'
const check = it.fails
const linked = noLinks ? it.skip : check
const FILES = ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json', '**/.lsp.json']

const ROOT = `\${CLAUDE_PLUGIN_ROOT}`
const advice = `A plugin can be installed anywhere, and a relative path depends on the folder where Claude Code runs it. Write \`\${CLAUDE_PLUGIN_ROOT}/...\` for a file of the plugin.`
const monitorMessage = (word: string) =>
  `The monitor command uses the relative path "${word}". ${advice}`
const lspMessage = (field: string, server: string, word: string) =>
  `The \`${field}\` of the LSP server "${server}" is the relative path "${word}". ${advice}`

const monitorOf = (command: string) => [{ name: 'm', description: 'd', command }]
/** The messages for a monitor `command` in `monitors/monitors.json`. */
function run(command: string) {
  const { dir } = pluginTree({ name: 'p' })
  const code = JSON.stringify(monitorOf(command))
  return lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code).map(
    (m) => m.message,
  )
}
const server = (config: Record<string, unknown>) => ({
  go: { extensionToLanguage: { '.go': 'go' }, ...config },
})
/** The messages for the LSP servers `servers` in `.lsp.json` of a plugin. */
function runLsp(servers: unknown) {
  const { dir } = pluginTree({ name: 'p' })
  return lintPluginFile(RULE, FILES, path.join(dir, '.lsp.json'), JSON.stringify(servers)).map(
    (m) => m.message,
  )
}

describe(RULE, () => {
  check('reports a relative monitor command, with the full message and the location', () => {
    const code = JSON.stringify(monitorOf('./bin/m --watch'))
    const { dir } = pluginTree({ name: 'p' })
    const found = lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'monitor',
      message: monitorMessage('./bin/m'),
      line: 1,
      column: code.indexOf('"./bin/m') + 1,
    })
  })

  check.each([
    ['a parent path', '../bin/m', '../bin/m'],
    ['a program path with a folder', 'bin/m --x', 'bin/m'],
    ['a script of an interpreter', 'node ./server.js', './server.js'],
    ['a path after an assignment', 'X=1 ./m', './m'],
    ['a path after sudo', 'sudo ./m', './m'],
    ['a path after a pipe', 'tail -F log | ./filter', './filter'],
    ['a path after a double ampersand', 'cd x && ./m', './m'],
    ['a path in an argument', 'tail -F ./log', './log'],
  ])('reports %s', (_title, command, word) => {
    expect(run(command)).toEqual([monitorMessage(word)])
  })

  check('reports a monitor command once, for its first path', () => {
    expect(run('./a ./b')).toEqual([monitorMessage('./a')])
  })

  check.each([
    ['the braced variable', `${ROOT}/bin/m`],
    ['the quoted variable', `"${ROOT}/bin/m"`],
    ['the bare variable', '$CLAUDE_PLUGIN_ROOT/bin/m'],
    ['a program on the PATH', 'tail -F /var/log/x'],
    ['a name', 'watch-things --x'],
    ['an absolute program', '/usr/bin/tail -F x'],
    ['a project variable', `\${CLAUDE_PROJECT_DIR}/m`],
    ['a home path', '~/bin/m'],
    ['a dot name', '.hidden-tool'],
    ['a flag with a path', 'tail --file=./log'],
    ['a URL', 'curl https://example.com/a'],
    ['an empty command', ''],
  ])('stays silent for %s', (_title, command) => {
    expect(run(command)).toEqual([])
  })

  check('reads the inline monitors of the manifest, in both keys', () => {
    const manifest = JSON.stringify({
      name: 'p',
      monitors: monitorOf('./a'),
      experimental: { monitors: monitorOf('./b') },
    })
    const { dir } = pluginTree(manifest)
    const found = lintPluginFile(
      RULE,
      FILES,
      path.join(dir, '.claude-plugin/plugin.json'),
      manifest,
    )
    expect(found.map((m) => m.message)).toEqual([monitorMessage('./b'), monitorMessage('./a')])
  })

  check('stays silent for a hook and an MCP server of the manifest, which other rules own', () => {
    const manifest = JSON.stringify({
      name: 'p',
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: './run.sh' }] }] },
      mcpServers: { s: { command: './server', args: ['./x'], headersHelper: './help.sh' } },
    })
    const { dir } = pluginTree(manifest)
    const file = path.join(dir, '.claude-plugin/plugin.json')
    expect(lintPluginFile(RULE, FILES, file, manifest)).toEqual([])
  })

  check('reports the command and the args of an LSP server in .lsp.json', () => {
    const servers = server({ command: './bin/gopls', args: ['./cfg.json', '--stdio', '../x'] })
    expect(runLsp(servers)).toEqual([
      lspMessage('command', 'go', './bin/gopls'),
      lspMessage('args', 'go', './cfg.json'),
      lspMessage('args', 'go', '../x'),
    ])
  })

  check('reports a program path with a folder in an LSP command', () => {
    expect(runLsp(server({ command: 'bin/gopls' }))).toEqual([
      lspMessage('command', 'go', 'bin/gopls'),
    ])
  })

  check('reports the inline LSP servers of the manifest', () => {
    const manifest = JSON.stringify({ name: 'p', lspServers: server({ command: './gopls' }) })
    const { dir } = pluginTree(manifest)
    const found = lintPluginFile(
      RULE,
      FILES,
      path.join(dir, '.claude-plugin/plugin.json'),
      manifest,
    )
    expect(found.map((m) => m.message)).toEqual([lspMessage('command', 'go', './gopls')])
  })

  check.each([
    ['the variable', server({ command: `${ROOT}/bin/gopls`, args: [`${ROOT}/cfg`] })],
    ['a name on the PATH', server({ command: 'gopls', args: ['serve', '--stdio'] })],
    ['an absolute path', server({ command: '/usr/local/bin/gopls', args: ['/etc/x'] })],
    ['a home path', server({ command: '~/bin/gopls' })],
    ['args that are not strings', server({ command: 'gopls', args: [1, { a: './x' }] })],
    ['args that are not an array', server({ command: 'gopls', args: './x' })],
    ['a command that is not a string', server({ command: ['./x'] })],
    ['a server that is not an object', { go: './x' }],
    ['a file that is not an object', ['./x']],
  ])('stays silent for an LSP server with %s', (_title, servers) => {
    expect(runLsp(servers)).toEqual([])
  })

  check('stays silent for a .lsp.json that is not at a plugin root', () => {
    const top = tree({})
    const code = JSON.stringify(server({ command: './gopls' }))
    expect(lintPluginFile(RULE, FILES, path.join(top, '.lsp.json'), code)).toEqual([])
  })

  check('stays silent in a folder that is no plugin', () => {
    const top = tree({})
    const code = JSON.stringify(monitorOf('./m'))
    expect(lintPluginFile(RULE, FILES, path.join(top, 'monitors/monitors.json'), code)).toEqual([])
  })

  linked('stays silent for a .lsp.json of a plugin root that links out of the repository', () => {
    const top = tree({ 'meta/plugin.json': '{"name":"p"}' })
    const elsewhere = tree({}, false)
    link(top, 'p', elsewhere)
    link(elsewhere, '.claude-plugin', path.join(top, 'meta'))
    const code = JSON.stringify(server({ command: './gopls' }))
    expect(lintPluginFile(RULE, FILES, path.join(top, 'p/.lsp.json'), code)).toEqual([])
  })

  check('shares no report with plugin-no-parent-path-escape', () => {
    const { dir } = pluginTree({ name: 'p' })
    const lint = (command: string) =>
      new Linter({ cwd: path.parse(dir).root }).verify(
        JSON.stringify(monitorOf(command)),
        [
          {
            files: FILES,
            plugins: { json, claude },
            language: 'json/json',
            rules: {
              [`claude/${RULE}`]: 'error',
              'claude/plugin-no-parent-path-escape': 'error',
            },
          },
        ],
        { filename: path.join(dir, 'monitors/monitors.json') },
      )
    expect(lint('../shared/run.sh').map((m) => m.ruleId)).toEqual([`claude/${RULE}`])
    expect(lint(`${ROOT}/../shared/run.sh`).map((m) => m.ruleId)).toEqual([
      'claude/plugin-no-parent-path-escape',
    ])
  })
})
