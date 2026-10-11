// The reader of the scripts that a command of a plugin runs. A script is a regular text file with a
// real path in the plugin root. The trees are on disk.
import { execFileSync } from 'node:child_process'
import { chmodSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPluginAt } from '../src/plugin-manifest.ts'
import { afterRoot, pluginScripts } from '../src/plugin-scripts.ts'
import { link, noLinks, tree } from './marketplace-tree.test-support.ts'
import { pluginTree } from './plugin-tree.test-support.ts'

// The largest script that the reader reads, in bytes.
const LIMIT = 1_048_576
const linked = noLinks ? it.skip : it
const unreadable = noLinks || process.getuid?.() === 0 ? it.skip : it

/** The scripts of the command `command` in a plugin that holds `files`. */
function scripts(command: string, files: Record<string, string>) {
  const { dir } = pluginTree({ name: 'p' }, files)
  return pluginScripts(readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>, command)
}

describe('afterRoot', () => {
  it.each([
    [`\${CLAUDE_PLUGIN_ROOT}/a`, '/a'],
    ['$CLAUDE_PLUGIN_ROOT/a', '/a'],
    [`\${CLAUDE_PLUGIN_ROOT}`, ''],
    ['$CLAUDE_PLUGIN_ROOT"/a', '/a'],
    [`\${CLAUDE_PLUGIN_ROOT}x`, 'x'],
    ['$CLAUDE_PLUGIN_ROOT_X/a', undefined],
    [`\${CLAUDE_PLUGIN_DATA}/a`, undefined],
    [`a/\${CLAUDE_PLUGIN_ROOT}`, undefined],
  ])('%s gives %j', (word, rest) => {
    expect(afterRoot(word)).toBe(rest)
  })
})

describe('pluginScripts', () => {
  it('gives the text and the real path of a script that the program names', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'scripts/run.sh': 'echo hi\n' })
    const plugin = readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>
    expect(pluginScripts(plugin, `"\${CLAUDE_PLUGIN_ROOT}/scripts/run.sh" --x`)).toEqual([
      {
        word: `\${CLAUDE_PLUGIN_ROOT}/scripts/run.sh`,
        file: path.join(plugin.realRoot, 'scripts/run.sh'),
        text: 'echo hi\n',
      },
    ])
  })

  it('gives the script that an interpreter runs, and not a later argument', () => {
    const files = { 'a.js': 'a', 'b.js': 'b' }
    const found = scripts(`node \${CLAUDE_PLUGIN_ROOT}/a.js \${CLAUDE_PLUGIN_ROOT}/b.js`, files)
    expect(found.map(({ text }) => text)).toEqual(['a'])
  })

  it('gives the scripts of a program and of a pipe in order', () => {
    const files = { 'a.sh': 'a', 'b.sh': 'b' }
    expect(
      scripts(`\${CLAUDE_PLUGIN_ROOT}/a.sh | \${CLAUDE_PLUGIN_ROOT}/b.sh`, files),
    ).toHaveLength(1)
  })

  it.each([
    ['a script that is not there', `\${CLAUDE_PLUGIN_ROOT}/none.sh`, {}],
    ['a folder', `\${CLAUDE_PLUGIN_ROOT}/dir`, { 'dir/x': 'x' }],
    ['a binary file', `\${CLAUDE_PLUGIN_ROOT}/b`, { b: 'a\0b' }],
    ['a script above the limit', `\${CLAUDE_PLUGIN_ROOT}/big`, { big: 'x'.repeat(LIMIT + 1) }],
    ['a relative program', './run.sh', { 'run.sh': 'x' }],
    ['a project path', `\${CLAUDE_PROJECT_DIR}/run.sh`, { 'run.sh': 'x' }],
    ['a path above the plugin', `\${CLAUDE_PLUGIN_ROOT}/../run.sh`, { 'run.sh': 'x' }],
  ])('gives no script for %s', (_title, command, files) => {
    expect(scripts(command, files)).toEqual([])
  })

  it('reads a script at the limit', () => {
    const files = { big: 'x'.repeat(LIMIT) }
    expect(scripts(`\${CLAUDE_PLUGIN_ROOT}/big`, files)).toHaveLength(1)
  })

  linked('reads a script that is a link to a file in the plugin', () => {
    const { dir, top } = pluginTree({ name: 'p' }, { 'real.sh': 'x' })
    link(top, 'run.sh', 'real.sh')
    const plugin = readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/run.sh`).map(({ text }) => text)).toEqual([
      'x',
    ])
  })

  linked('gives no script for a link to a file of the repository out of the plugin', () => {
    const top = tree({
      'plugins/q/.claude-plugin/plugin.json': '{"name":"q"}',
      'shared/real.sh': 'x',
    })
    link(top, 'plugins/q/run.sh', path.join(top, 'shared/real.sh'))
    const plugin = readPluginAt(path.join(top, 'plugins/q')) as NonNullable<
      ReturnType<typeof readPluginAt>
    >
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/run.sh`)).toEqual([])
  })

  linked('gives no script for a link out of the repository, or with no target', () => {
    const { dir, top } = pluginTree({ name: 'p' })
    const elsewhere = tree({ 'x.sh': 'x' }, false)
    link(top, 'out.sh', path.join(elsewhere, 'x.sh'))
    link(top, 'gone.sh', path.join(top, 'nothing'))
    const plugin = readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/out.sh`)).toEqual([])
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/gone.sh`)).toEqual([])
  })

  linked('gives no script for a named pipe, which a read would wait on', () => {
    const { dir, top } = pluginTree({ name: 'p' })
    execFileSync('sh', ['-c', 'mkfifo "$0"', path.join(top, 'pipe')])
    const plugin = readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/pipe`)).toEqual([])
  })

  unreadable('gives no script for a file that cannot be read', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'run.sh': 'x' })
    const plugin = readPluginAt(dir) as NonNullable<ReturnType<typeof readPluginAt>>
    chmodSync(path.join(dir, 'run.sh'), 0o000)
    expect(pluginScripts(plugin, `\${CLAUDE_PLUGIN_ROOT}/run.sh`)).toEqual([])
  })
})
