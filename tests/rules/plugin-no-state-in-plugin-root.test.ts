// `${CLAUDE_PLUGIN_ROOT}` is the install directory of a plugin version. "Each version has its own
// cache directory, so the path changes when the plugin updates. Don't write state there"
// (components page, "Reference plugin paths and store data"). The rule reports a command, or a
// script of the plugin that a command runs, that writes under the plugin root: a redirect, `cp`
// or `mv` to the root, `tee`, `touch` and `mkdir` on a path in the root, and a package install in
// the root. The trees are on disk. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-no-state-in-plugin-root'
const check = it
const linked = noLinks ? it.skip : check
const FILES = [
  '**/.claude-plugin/plugin.json',
  '**/hooks/hooks.json',
  '**/.mcp.json',
  '**/monitors/monitors.json',
]

const ROOT = `\${CLAUDE_PLUGIN_ROOT}`
const DATA = `\${CLAUDE_PLUGIN_DATA}`
const guidance = `The plugin root changes with each version, so Claude Code does not keep the write across an update. Write to \`${DATA}\`, which survives updates.`
const commandMessage = (action: string) =>
  `This command writes under \`\${CLAUDE_PLUGIN_ROOT}\` with ${action}. ${guidance}`
const scriptMessage = (script: string, action: string) =>
  `The script "${script}" writes under \`\${CLAUDE_PLUGIN_ROOT}\` with ${action}. ${guidance}`

const monitorOf = (command: string) => [{ name: 'm', description: 'd', command }]
const hooksOf = (command: string) => ({
  hooks: { SessionStart: [{ hooks: [{ type: 'command', command }] }] },
})
/** The messages for a monitor `command` in a plugin that holds `files`. */
function run(command: string, files: Record<string, string> = {}) {
  const { dir } = pluginTree({ name: 'p' }, files)
  const code = JSON.stringify(monitorOf(command))
  return lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code).map(
    (m) => m.message,
  )
}

describe(RULE, () => {
  check('reports a redirect to the root, with the full message and the location', () => {
    const code = JSON.stringify(monitorOf(`echo x > ${ROOT}/log`))
    const { dir } = pluginTree({ name: 'p' })
    const found = lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'command',
      message: commandMessage('a redirect'),
      line: 1,
      column: code.indexOf('"echo x') + 1,
    })
  })

  check.each([
    ['an attached target', `echo x >${ROOT}/log`],
    ['an append', `echo x >> ${ROOT}/log`],
    ['a quoted target', `echo x > "${ROOT}/log"`],
    ['a single quoted target', `echo x > '${ROOT}/log'`],
    ['the bare variable', 'echo x > $CLAUDE_PLUGIN_ROOT/log'],
    ['the error stream', `run 2> ${ROOT}/err`],
    ['both streams', `run &> ${ROOT}/all`],
    ['a redirect in a pipe', `run | sort > ${ROOT}/out`],
  ])('reports %s', (_title, command) => {
    expect(run(command)).toEqual([commandMessage('a redirect')])
  })

  check.each([
    ['cp', `cp a.txt ${ROOT}/`, '`cp`'],
    ['cp with flags', `cp -r a ${ROOT}/dir`, '`cp`'],
    ['mv', `mv a "${ROOT}/b"`, '`mv`'],
    ['tee', `echo x | tee ${ROOT}/log`, '`tee`'],
    ['tee with a flag', `echo x | tee -a ${ROOT}/log`, '`tee`'],
    ['touch', `touch ${ROOT}/ready`, '`touch`'],
    ['mkdir', `mkdir -p ${ROOT}/cache`, '`mkdir`'],
    ['a program after an assignment', `LC_ALL=C cp a ${ROOT}/b`, '`cp`'],
    ['a program after sudo', `sudo cp a ${ROOT}/b`, '`cp`'],
  ])('reports %s into the root', (_title, command, action) => {
    expect(run(command)).toEqual([commandMessage(action)])
  })

  check.each([
    ['npm with --prefix', `npm install --prefix ${ROOT}`, '`npm install`'],
    ['npm with --prefix=', `npm ci --prefix="${ROOT}"`, '`npm ci`'],
    ['npm i', `npm i --prefix ${ROOT}`, '`npm i`'],
    ['npm after cd', `cd "${ROOT}" && npm install`, '`npm install`'],
    ['npm after cd to a folder', `cd ${ROOT}/web && npm ci`, '`npm ci`'],
    ['pnpm after cd', `cd ${ROOT} && pnpm install`, '`pnpm install`'],
    ['yarn add after cd', `cd ${ROOT} && yarn add left-pad`, '`yarn add`'],
    ['bun after cd', `cd ${ROOT} && bun i`, '`bun i`'],
  ])('reports %s', (_title, command, action) => {
    expect(run(command)).toEqual([commandMessage(action)])
  })

  check('reports a command once, for its first write', () => {
    expect(run(`touch ${ROOT}/a; echo x > ${ROOT}/b`)).toEqual([commandMessage('`touch`')])
  })

  check('reports a write in a script that the command runs, with the full message', () => {
    const files = { 'scripts/s.sh': 'set -e\necho x > "$CLAUDE_PLUGIN_ROOT/state"\n' }
    expect(run(`"${ROOT}/scripts/s.sh"`, files)).toEqual([
      scriptMessage(`${ROOT}/scripts/s.sh`, 'a redirect'),
    ])
  })

  check('reports a write in a script that an interpreter runs', () => {
    const files = { 'run.sh': `cd "${ROOT}"\nnpm install\n` }
    expect(run(`bash ${ROOT}/run.sh`, files)).toEqual([
      scriptMessage(`${ROOT}/run.sh`, '`npm install`'),
    ])
  })

  check('reports the command and each script that writes', () => {
    const files = { 'a.sh': `touch ${ROOT}/x`, 'b.sh': 'echo ok' }
    expect(run(`${ROOT}/a.sh && node ${ROOT}/b.sh && mkdir ${ROOT}/d`, files)).toEqual([
      commandMessage('`mkdir`'),
      scriptMessage(`${ROOT}/a.sh`, '`touch`'),
    ])
  })

  check.each([
    ['a read', `cat ${ROOT}/state`],
    ['a copy from the root', `cp "${ROOT}/package.json" .`],
    ['a copy from the root to the data folder', `cp ${ROOT}/a ${DATA}/a`],
    ['a redirect to the data folder', `echo x > ${DATA}/log`],
    ['npm in the data folder', `npm install --prefix ${DATA}`],
    ['npm after cd to the data folder', `cd "${DATA}" && npm install`],
    ['npm with no folder', 'npm install'],
    ['npm after cd to the root and back', `cd ${ROOT} && cd ${DATA} && npm install`],
    ['a command that is not an install', `cd ${ROOT} && npm test`],
    ['a run of cd in the root', `cd ${ROOT} && ls`],
    ['stream redirects', 'run > /dev/null 2>&1'],
    ['a stream copy', 'run >&2'],
    ['a redirect from the root', `sort < ${ROOT}/in`],
    ['another variable', 'echo x > $CLAUDE_PLUGIN_ROOT_DIR/log'],
    ['the root in an argument of tee', `echo ${ROOT} | tee /tmp/log`],
    ['a name that holds cp', `mycp a ${ROOT}/b`],
    ['an assignment alone', `X=${ROOT}`],
    ['cp with flags only', 'cp -r'],
  ])('stays silent for %s', (_title, command) => {
    expect(run(command)).toEqual([])
  })

  check('stays silent for the SessionStart command of the components page', () => {
    const command = `diff -q "${ROOT}/package.json" "${DATA}/package.json" >/dev/null 2>&1 || (cd "${DATA}" && cp "${ROOT}/package.json" . && npm install) || rm -f "${DATA}/package.json"`
    expect(run(command)).toEqual([])
  })

  check.each([
    ['a comment line', `# echo x > ${ROOT}/log\necho ok\n`],
    ['a write to the data folder', `echo x > "${DATA}/log"\n`],
    ['no write', 'echo hi\n'],
  ])('stays silent for a script with %s', (_title, text) => {
    expect(run(`${ROOT}/s.sh`, { 's.sh': text })).toEqual([])
  })

  check('stays silent for a script that is not there', () => {
    expect(run(`${ROOT}/missing.sh`)).toEqual([])
  })

  check('stays silent for a script that writes, when it is binary', () => {
    expect(run(`${ROOT}/s.sh`, { 's.sh': `\0 > ${ROOT}/x` })).toEqual([])
  })

  linked('stays silent for a script that is a link out of the repository', () => {
    const { dir, top } = pluginTree({ name: 'p' })
    const elsewhere = tree({ 's.sh': `echo x > ${ROOT}/x` }, false)
    link(top, 's.sh', path.join(elsewhere, 's.sh'))
    const code = JSON.stringify(monitorOf(`${ROOT}/s.sh`))
    expect(lintPluginFile(RULE, FILES, path.join(dir, 'monitors/monitors.json'), code)).toEqual([])
  })

  check('reports a shell-form hook of hooks/hooks.json', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify(hooksOf(`touch ${ROOT}/x`))
    const found = lintPluginFile(RULE, FILES, path.join(dir, 'hooks/hooks.json'), code)
    expect(found.map((m) => m.message)).toEqual([commandMessage('`touch`')])
  })

  check('reports a shell-form hook and a monitor of the manifest', () => {
    const manifest = JSON.stringify({
      name: 'p',
      hooks: hooksOf(`touch ${ROOT}/x`).hooks,
      monitors: monitorOf(`mkdir ${ROOT}/d`),
    })
    const { dir } = pluginTree(manifest)
    const found = lintPluginFile(
      RULE,
      FILES,
      path.join(dir, '.claude-plugin/plugin.json'),
      manifest,
    )
    expect(found.map((m) => m.message)).toEqual([
      commandMessage('`touch`'),
      commandMessage('`mkdir`'),
    ])
  })

  check('reports a headersHelper of .mcp.json', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify({
      mcpServers: { s: { url: 'https://a.example/mcp', headersHelper: `touch ${ROOT}/x` } },
    })
    const found = lintPluginFile(RULE, FILES, path.join(dir, '.mcp.json'), code)
    expect(found.map((m) => m.message)).toEqual([commandMessage('`touch`')])
  })

  check('stays silent for an exec-form hook, which runs no shell', () => {
    const { dir } = pluginTree({ name: 'p' })
    const hooks = {
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'touch', args: [`${ROOT}/x`] }] }],
      },
    }
    const code = JSON.stringify(hooks)
    expect(lintPluginFile(RULE, FILES, path.join(dir, 'hooks/hooks.json'), code)).toEqual([])
  })

  check('stays silent in a folder that is no plugin', () => {
    const top = tree({})
    const code = JSON.stringify(monitorOf(`touch ${ROOT}/x`))
    expect(lintPluginFile(RULE, FILES, path.join(top, 'monitors/monitors.json'), code)).toEqual([])
  })
})
