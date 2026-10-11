// Plugin `bin/` directories come after the user's own `PATH` entries, so a plugin cannot shadow
// `git`, `ls` or another system command (components reference, "Executables"). The docs name two
// commands. The list of the rule is its own choice, in src/data/plugin-layout.ts. The trees are on
// disk, because the rule lists `bin/`. The files glob is in tests/configs.test.ts.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-bin-shadows-system-command'
const check = it
const linked = noLinks ? it.skip : check

const run = (files: Record<string, string>) => {
  const { dir, code } = pluginTree({ name: 'p' }, files)
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports on the document, with the full message', () => {
    const found = run({ 'bin/git': '#!/bin/sh\n' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'shadows',
      message:
        'The file `bin/git` has the name of the system command "git". Claude Code puts the `bin/` of a plugin after the user\'s own `PATH` entries, so the plugin cannot shadow the command. Rename the file.',
      line: 1,
      column: 1,
    })
  })

  check('reports each file with the name of a system command', () => {
    const found = run({ 'bin/ls': '', 'bin/my-tool': '', 'bin/git': '' })
    expect(found.map((m) => m.message.slice(0, 20))).toEqual([
      'The file `bin/git` h',
      'The file `bin/ls` ha',
    ])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { 'bin/ls': '' }, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code)).toHaveLength(1)
  })

  linked('reports a link to a file in the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'scripts/run.sh': '' })
    link(top, 'bin/rm', '../scripts/run.sh')
    expect(lintPlugin(RULE, dir, code)).toHaveLength(1)
  })

  linked('reports in a bin folder that is a link to a folder in the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'tools/cat': '' })
    link(top, 'bin', 'tools')
    expect(lintPlugin(RULE, dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no bin folder', {}],
    ['a name that is not a system command', { 'bin/my-tool': '' }],
    ['a name with an extension', { 'bin/git.sh': '', 'bin/ls.py': '' }],
    ['a name that holds a command', { 'bin/mygit': '', 'bin/git-x': '' }],
    ['a different case', { 'bin/Git': '' }],
    ['a command name in a subfolder', { 'bin/sub/git': '' }],
    ['a command name outside bin', { 'scripts/git': '', git: '' }],
    ['a bin file', { bin: '' }],
    ['a folder with a command name', { 'bin/git/run': '' }],
    ['a bin folder in .claude-plugin', { '.claude-plugin/bin/git': '' }],
  ])('stays silent for %s', (_title, files) => {
    expect(run(files)).toEqual([])
  })

  check('stays silent for an empty bin folder', () => {
    const { dir, code, top } = pluginTree({ name: 'p' })
    mkdirSync(path.join(top, 'bin'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a dangling bin/ls link', () => {
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin/ls', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bin/git link to a file out of the repository', () => {
    const elsewhere = tree({ git: '' })
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin/git', path.join(elsewhere, 'git'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bin/git link to a file that leaves the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'shared/git': '' }, 'plugins/p/')
    link(top, 'plugins/p/bin/git', '../../../shared/git')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bin link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a bin link to a folder out of the repository', () => {
    const elsewhere = tree({ git: '' })
    const { dir, code, top } = pluginTree({ name: 'p' })
    link(top, 'bin', elsewhere)
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse on disk', () => {
    const { dir } = pluginTree('{', { 'bin/git': '' })
    expect(lintPlugin(RULE, dir, '{"name": "p"}')).toEqual([])
  })
})
