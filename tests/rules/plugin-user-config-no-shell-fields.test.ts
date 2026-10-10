// A `<UC>` reference fails in a field that a shell runs: the
// `command` of a shell-form hook, the `command` of a monitor, and the
// `headersHelper` of an MCP server (manifest reference, "Fields that run
// through a shell"). The rule reads the manifest and the default files of a
// plugin. The trees are on disk, because the rule finds the plugin around the
// file. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-user-config-no-shell-fields'
const check = it.fails
const linked = noLinks ? it.skip : check
const FILES = [
  '**/.claude-plugin/plugin.json',
  '**/hooks/hooks.json',
  '**/.mcp.json',
  '**/monitors/monitors.json',
]
// Escaped, so that the template literal keeps each reference as text.
const REF = `\${user_config.token}`
const OTHER = `\${user_config.url}`
const UC = `\${user_config.*}`
const TEMPLATES = {
  hook: 'This shell-form hook `command` references `<UC>`. Claude Code fails the hook instead of running it. Set `args` to run it in exec form, or read `CLAUDE_PLUGIN_OPTION_<KEY>` in the script.',
  monitor:
    'A monitor `command` cannot reference `<UC>`. Claude Code does not start the monitor. Have the monitor script read the value from a config file.',
  headersHelper:
    'An MCP `headersHelper` cannot reference `<UC>`. Claude Code reports the server as misconfigured. Put the reference in `headers`, or read the value in the helper script.',
}
const MESSAGES = Object.fromEntries(
  Object.entries(TEMPLATES).map(([id, text]) => [id, text.replaceAll('<UC>', UC)]),
) as Record<keyof typeof TEMPLATES, string>
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)

const hooksOf = (...handlers: unknown[]) => ({
  PostToolUse: [{ matcher: 'Write', hooks: handlers }],
})
const shell = (command: string) => ({ type: 'command', command })
const MANIFEST = '.claude-plugin/plugin.json'

/** The messages for `code` at `file` in a plugin that has the manifest `manifest`. */
const run = (file: string, value: unknown, manifest: unknown = { name: 'p' }) => {
  const { dir } = pluginTree(manifest)
  return lint(dir, file, JSON.stringify(value)).map((m) => m.message)
}
/** The messages for a manifest that sets `fields`. */
const runManifest = (fields: Record<string, unknown>) => {
  const manifest = { name: 'p', ...fields }
  return run(MANIFEST, manifest, manifest)
}

describe(RULE, () => {
  check('reports a shell-form hook on the command, with the full message', () => {
    const code = `{"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "./notify.sh \${user_config.token}"}]}]}}`
    const { dir } = pluginTree(code)
    const found = lint(dir, MANIFEST, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'hook',
      message: MESSAGES.hook,
      line: 1,
      column: 62,
      endColumn: 97,
    })
  })

  check.each([
    [
      'a hook in the inline hooks of the manifest',
      { hooks: hooksOf(shell(`./n.sh ${REF}`)) },
      'hook',
    ],
    [
      'a hook in an inline object of a hooks array',
      { hooks: ['./extra-hooks.json', hooksOf(shell(`./n.sh ${REF}`))] },
      'hook',
    ],
    [
      'a hook that sets a shell',
      { hooks: hooksOf({ type: 'command', command: `n.ps1 ${REF}`, shell: 'powershell' }) },
      'hook',
    ],
    [
      'a headersHelper in the inline servers of the manifest',
      {
        mcpServers: {
          api: { type: 'http', url: 'https://x.test', headersHelper: `./h.sh ${REF}` },
        },
      },
      'headersHelper',
    ],
    [
      'a headersHelper in an inline map of a servers array',
      { mcpServers: ['./servers.json', { api: { headersHelper: `./h.sh ${REF}` } }] },
      'headersHelper',
    ],
    [
      'a monitor in the experimental monitors',
      { experimental: { monitors: [{ name: 'm', command: `./m.sh ${REF}` }] } },
      'monitor',
    ],
    [
      'a monitor in the top-level monitors key',
      { monitors: [{ name: 'm', command: `./m.sh ${REF}` }] },
      'monitor',
    ],
  ])('reports %s', (_title, fields, id) => {
    expect(runManifest(fields)).toEqual([MESSAGES[id as keyof typeof MESSAGES]])
  })

  check.each([
    ['hooks/hooks.json', 'hooks/hooks.json', { hooks: hooksOf(shell(`./n.sh ${REF}`)) }, 'hook'],
    [
      '.mcp.json',
      '.mcp.json',
      { mcpServers: { api: { headersHelper: `./h.sh ${REF}` } } },
      'headersHelper',
    ],
    [
      'monitors/monitors.json',
      'monitors/monitors.json',
      [{ name: 'm', command: `./m.sh ${REF}` }],
      'monitor',
    ],
  ])('reports in %s', (_title, file, value, id) => {
    expect(run(file, value)).toEqual([MESSAGES[id as keyof typeof MESSAGES]])
  })

  check('reports a field once for two references', () => {
    expect(runManifest({ hooks: hooksOf(shell(`./n.sh ${REF} ${OTHER}`)) })).toHaveLength(1)
  })

  check('reports each field on its own, in file order', () => {
    const fields = {
      hooks: hooksOf(shell(`a ${REF}`), shell(`b ${REF}`)),
      mcpServers: { x: { headersHelper: `h ${REF}` }, y: {} },
      experimental: { monitors: [{ command: `m ${REF}` }] },
    }
    expect(runManifest(fields)).toEqual([
      MESSAGES.hook,
      MESSAGES.hook,
      MESSAGES.headersHelper,
      MESSAGES.monitor,
    ])
  })

  check('reports in more than one event and group', () => {
    const hooks = {
      PreToolUse: [{ hooks: [shell(`a ${REF}`)] }],
      Stop: [{ hooks: [shell('ok')] }, { matcher: 'x', hooks: [shell(`b ${REF}`)] }],
    }
    expect(runManifest({ hooks })).toEqual([MESSAGES.hook, MESSAGES.hook])
  })

  check('reads the last of two members with the same name', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = `{"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "ok", "command": "x ${REF}"}]}]}}`
    expect(lint(dir, MANIFEST, code)).toHaveLength(1)
  })

  check('reports in a plugin below the repository root', () => {
    const { dir } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    const code = JSON.stringify({ mcpServers: { a: { headersHelper: REF } } })
    expect(lint(dir, '.mcp.json', code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    [
      'an exec-form hook with a reference in args',
      hooksOf({ type: 'command', command: 'n', args: [REF] }),
    ],
    [
      'an exec-form hook with a reference in command',
      hooksOf({ type: 'command', command: REF, args: [] }),
    ],
    ['a hook with no reference', hooksOf(shell('./n.sh $CLAUDE_PLUGIN_OPTION_TOKEN'))],
    ['an http hook', hooksOf({ type: 'http', url: REF, command: REF })],
    ['a hook with no type', hooksOf({ command: REF })],
    ['a hook with a command that is no string', hooksOf({ type: 'command', command: 3 })],
    ['a hook with no command', hooksOf({ type: 'command' })],
    ['a hook with a type that is no string', hooksOf({ type: 3, command: REF })],
    ['a group that is no object', { PostToolUse: ['x', null] }],
    ['a group with hooks that is no array', { PostToolUse: [{ hooks: shell(REF) }] }],
    ['a handler that is no object', hooksOf('x', 3, null)],
    ['an event that is no array', { PostToolUse: { hooks: [shell(REF)] } }],
    [
      'a reference with a different prefix',
      hooksOf(shell(`$user_config.x \${user_config_x} \${CLAUDE_PLUGIN_ROOT}`)),
    ],
  ])('stays silent in the inline hooks for %s', (_title, hooks) => {
    expect(runManifest({ hooks })).toEqual([])
  })

  check.each([
    ['a string path', './hooks/extra.json'],
    ['a number', 3],
    ['null', null],
    ['an array of paths and other values', ['./a.json', 3, null, ['x']]],
  ])('stays silent for hooks set to %s', (_title, hooks) => {
    expect(runManifest({ hooks })).toEqual([])
  })

  check.each([
    ['a reference in headers', { api: { headers: { Authorization: REF } } }],
    [
      'a reference in env, args, command and url',
      { api: { env: { T: REF }, args: [REF], command: REF, url: REF } },
    ],
    ['a headersHelper with no reference', { api: { headersHelper: './h.sh' } }],
    ['a headersHelper that is no string', { api: { headersHelper: 3 } }],
    ['a server that is no object', { api: 'x', b: null }],
  ])('stays silent in the inline servers for %s', (_title, mcpServers) => {
    expect(runManifest({ mcpServers })).toEqual([])
  })

  check.each([
    ['a string path', './servers.json'],
    ['a bundle path', './server.mcpb'],
    ['an array of paths and other values', ['./a.json', 3, null]],
  ])('stays silent for mcpServers set to %s', (_title, mcpServers) => {
    expect(runManifest({ mcpServers })).toEqual([])
  })

  check.each([
    ['a reference in description', [{ name: 'm', command: 'x', description: REF }]],
    ['a command with no reference', [{ command: 'tail -F ./log' }]],
    ['a command that is no string', [{ command: 3 }, { command: [REF] }]],
    ['an entry that is no object', ['x', null, 3]],
  ])('stays silent in the monitors for %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors } })).toEqual([])
    expect(runManifest({ monitors })).toEqual([])
  })

  check.each([
    ['a string path', './m.json'],
    ['an object', { command: REF }],
    ['a number', 3],
  ])('stays silent for monitors set to %s', (_title, monitors) => {
    expect(runManifest({ experimental: { monitors }, monitors })).toEqual([])
  })

  check('stays silent for experimental set to a string', () => {
    expect(runManifest({ experimental: 'monitors' })).toEqual([])
  })

  check.each([
    ['hooks/hooks.json with no hooks wrapper', 'hooks/hooks.json', hooksOf(shell(REF))],
    [
      'hooks/hooks.json with hooks as an array',
      'hooks/hooks.json',
      { hooks: [hooksOf(shell(REF))] },
    ],
    ['hooks/hooks.json that is an array', 'hooks/hooks.json', []],
    ['.mcp.json with no mcpServers wrapper', '.mcp.json', { api: { headersHelper: REF } }],
    [
      '.mcp.json with mcpServers as an array',
      '.mcp.json',
      { mcpServers: [{ headersHelper: REF }] },
    ],
    ['.mcp.json that is a string', '.mcp.json', 'x'],
    ['monitors/monitors.json that is an object', 'monitors/monitors.json', { command: REF }],
    ['monitors/monitors.json that is a string', 'monitors/monitors.json', REF],
  ])('stays silent for %s', (_title, file, value) => {
    expect(run(file, value)).toEqual([])
  })

  const monitors = [{ name: 'm', command: `./m.sh ${REF}` }]
  check.each([
    ['an inline experimental monitors array', { experimental: { monitors: [] } }],
    ['an inline top-level monitors array', { monitors: [] }],
    ['a path to another file', { experimental: { monitors: './other.json' } }],
    ['a path to another file in the top-level key', { monitors: './other.json' }],
    ['a value that is no path', { experimental: { monitors: 3 } }],
  ])('stays silent in monitors/monitors.json when the manifest sets %s', (_title, fields) => {
    expect(run('monitors/monitors.json', monitors, { name: 'p', ...fields })).toEqual([])
  })

  check.each([
    ['experimental.monitors', { experimental: { monitors: './monitors/monitors.json' } }],
    ['monitors', { monitors: './x/../monitors/monitors.json' }],
    ['an experimental key with no monitors', { experimental: { themes: './t' } }],
    ['an experimental key that is a string', { experimental: 'x' }],
    ['no monitors key', {}],
  ])('reports monitors/monitors.json when the manifest sets %s', (_title, fields) => {
    expect(run('monitors/monitors.json', monitors, { name: 'p', ...fields })).toEqual([
      MESSAGES.monitor,
    ])
  })

  check('stays silent for a file that sits in no plugin', () => {
    const top = tree({})
    const code = JSON.stringify({ mcpServers: { a: { headersHelper: REF } } })
    expect(lint(top, '.mcp.json', code)).toEqual([])
    expect(lint(top, 'hooks/hooks.json', JSON.stringify({ hooks: hooksOf(shell(REF)) }))).toEqual(
      [],
    )
  })

  check.each([
    ['config/hooks.json', 'config/hooks.json'],
    ['hooks/other.json', 'hooks/other.json'],
    ['other/monitors.json', 'other/monitors.json'],
    ['.claude-plugin/other.json', '.claude-plugin/other.json'],
    ['plugin.json outside .claude-plugin/', 'plugin.json'],
    ['.mcp.json below the plugin root', 'sub/.mcp.json'],
  ])('stays silent for a file with the name %s', (_title, file) => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify({
      hooks: hooksOf(shell(REF)),
      mcpServers: { a: { headersHelper: REF } },
      monitors: [{ command: REF }],
    })
    expect(lintPluginFile(RULE, ['**/*.json'], path.join(dir, file), code)).toEqual([])
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    const code = JSON.stringify({ mcpServers: { a: { headersHelper: REF } } })
    expect(lint(top, '.mcp.json', code)).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text)
    const code = JSON.stringify({ mcpServers: { a: { headersHelper: REF } } })
    expect(lint(dir, '.mcp.json', code)).toEqual([])
  })
})
