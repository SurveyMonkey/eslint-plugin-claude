// A monitor with `when: "on-skill-invoke:<skill>"` starts the first time that skill runs
// (manifest reference, "Monitors"). It never starts when the plugin has no such skill. The trees
// are on disk, because the rule looks for the skill around the file. The files glob is in
// tests/configs.test.ts.
import { chmodSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-monitors-skill-exists'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const FILES = ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json']
const MANIFEST = '.claude-plugin/plugin.json'
const SKILL = (name?: string) => (name === undefined ? '# S\n' : `---\nname: ${name}\n---\n# S\n`)

const message = (skill: string) =>
  `The monitor starts when the skill "${skill}" runs, but the plugin has no such skill. The monitor never starts. Name a skill of this plugin.`
const monitor = (when: unknown) => ({ name: 'm', command: 'run', description: 'd', when })
const lint = (dir: string, file: string, code: string) =>
  lintPluginFile(RULE, FILES, path.join(dir, file), code)
/** The messages for a manifest with one monitor that has `when`, in a plugin with `files`. */
function run(when: unknown, files: Record<string, string> = {}, extra: object = {}) {
  const { dir, code } = pluginTree(
    { name: 'p', experimental: { monitors: [monitor(when)] }, ...extra },
    files,
  )
  return lint(dir, MANIFEST, code).map((m) => m.message)
}
const invoke = (skill: string) => `on-skill-invoke:${skill}`

describe(RULE, () => {
  check('reports the when value, with the full message and its place', () => {
    const code = '{"name": "p", "experimental": {"monitors": [{"when": "on-skill-invoke:deploy"}]}}'
    const { dir } = pluginTree(code)
    const found = lint(dir, MANIFEST, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: message('deploy'),
      line: 1,
      column: 54,
      endColumn: 78,
    })
  })

  check('reports a skill that the plugin does not have, beside one that it has', () => {
    expect(run(invoke('missing'), { 'skills/deploy/SKILL.md': SKILL() })).toEqual([
      message('missing'),
    ])
  })

  check('reports a name in the monitors key of the manifest', () => {
    const { dir, code } = pluginTree({ name: 'p', monitors: [monitor(invoke('gone'))] })
    expect(lint(dir, MANIFEST, code).map((m) => m.message)).toEqual([message('gone')])
  })

  check('reports a name in monitors/monitors.json', () => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify([monitor(invoke('gone'))])
    expect(lint(dir, 'monitors/monitors.json', code).map((m) => m.message)).toEqual([
      message('gone'),
    ])
  })

  check('reports each monitor in file order', () => {
    const { dir, code } = pluginTree({
      name: 'p',
      experimental: { monitors: [monitor(invoke('a')), monitor('always'), monitor(invoke('b'))] },
    })
    expect(lint(dir, MANIFEST, code).map((m) => m.message)).toEqual([message('a'), message('b')])
  })

  check.each([
    ['a skill folder with no SKILL.md', { 'skills/deploy/README.md': '' }],
    ['a loose file in skills/', { 'skills/deploy.md': '' }],
    ['a skill in a folder that is not skills/', { 'other/deploy/SKILL.md': SKILL() }],
    ['a skill in a subfolder of a skill folder', { 'skills/a/deploy/SKILL.md': SKILL() }],
    ['a command file in a folder that is not commands/', { 'other/deploy.md': '' }],
    ['a name with another letter case', { 'skills/Deploy/SKILL.md': SKILL() }],
  ])('reports with %s', (_title, files) => {
    expect(run(invoke('deploy'), files)).toEqual([message('deploy')])
  })

  check('reports when a skills path leaves the plugin, which Claude Code drops', () => {
    expect(run(invoke('deploy'), {}, { skills: '../out' })).toEqual([message('deploy')])
  })

  check('reports when the skills key names a folder that is not there', () => {
    expect(run(invoke('deploy'), {}, { skills: './nowhere' })).toEqual([message('deploy')])
  })

  check('reports when a skills path is a file', () => {
    expect(run(invoke('deploy'), { 'one.md': '' }, { skills: './one.md' })).toEqual([
      message('deploy'),
    ])
  })

  check('reports a plugin-qualified name with no such skill', () => {
    expect(run('on-skill-invoke:p:deploy')).toEqual([message('deploy')])
  })

  check('reports an empty name', () => {
    expect(run('on-skill-invoke:')).toEqual([message('')])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a skill folder', { 'skills/deploy/SKILL.md': SKILL() }, {}],
    ['the name in the frontmatter', { 'skills/x/SKILL.md': SKILL('deploy') }, {}],
    [
      'a skill with a frontmatter that does not parse',
      { 'skills/deploy/SKILL.md': '---\n[\n---\n' },
      {},
    ],
    ['a skill with an empty file', { 'skills/deploy/SKILL.md': '' }, {}],
    ['a command file', { 'commands/deploy.md': '' }, {}],
    [
      'a folder that the skills key names',
      { 'extra/deploy/SKILL.md': SKILL() },
      { skills: './extra' },
    ],
    [
      'a folder in the skills array',
      { 'extra/deploy/SKILL.md': SKILL() },
      { skills: ['./other', './extra'] },
    ],
    [
      'a skill folder with a name in the frontmatter',
      { 'one/SKILL.md': SKILL('deploy') },
      { skills: './one' },
    ],
    [
      'the plugin root as a skill, by its frontmatter',
      { 'SKILL.md': SKILL('deploy') },
      { skills: './' },
    ],
    ['a command of the commands map', {}, { commands: { deploy: { source: './d.md' } } }],
  ])('stays silent for %s', (_title, files, extra) => {
    expect(run(invoke('deploy'), files, extra)).toEqual([])
  })

  check('reports a missing skill for a manifest with no name and a root skill', () => {
    const { dir, code } = pluginTree(
      { monitors: [monitor(invoke('deploy'))], skills: './' },
      { 'SKILL.md': SKILL() },
    )
    expect(lint(dir, MANIFEST, code).map((m) => m.message)).toEqual([message('deploy')])
  })

  check('stays silent for the plugin name when the plugin root is a skill', () => {
    expect(run(invoke('p'), { 'SKILL.md': SKILL() }, { skills: './' })).toEqual([])
  })

  check('stays silent for a command name that starts with the plugin name', () => {
    expect(
      run('on-skill-invoke:ops:deploy', { 'commands/ops/deploy.md': '' }, { name: 'ops' }),
    ).toEqual([])
  })

  check('stays silent for a plugin-qualified name of a skill that exists', () => {
    expect(run('on-skill-invoke:p:deploy', { 'skills/deploy/SKILL.md': SKILL() })).toEqual([])
  })

  check('stays silent for the folder name of a skill folder that the skills key names', () => {
    expect(run(invoke('one'), { 'one/SKILL.md': SKILL() }, { skills: './one' })).toEqual([])
  })

  check('stays silent for the command name of a subfolder command', () => {
    expect(run('on-skill-invoke:ops:deploy', { 'commands/ops/deploy.md': '' })).toEqual([])
  })

  check.each([
    ['always', 'always'],
    ['a name that does not start a skill trigger', 'on-skill-invoke'],
    ['another trigger', 'on-start:deploy'],
    ['a number', 5],
    ['null', null],
    ['an object', { skill: 'deploy' }],
  ])('stays silent for a when value of %s', (_title, when) => {
    expect(run(when)).toEqual([])
  })

  check('stays silent for a monitor with no when', () => {
    const { dir, code } = pluginTree({
      name: 'p',
      experimental: { monitors: [{ name: 'm', command: 'run', description: 'd' }] },
    })
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  check('stays silent for a monitors value that is not an array', () => {
    const { dir, code } = pluginTree({ name: 'p', monitors: { when: invoke('gone') } })
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  check('stays silent for a monitors file that a manifest key replaces', () => {
    const { dir } = pluginTree({ name: 'p', experimental: { monitors: './other.json' } })
    const code = JSON.stringify([monitor(invoke('gone'))])
    expect(lint(dir, 'monitors/monitors.json', code)).toEqual([])
  })

  check('stays silent for a commands key that names paths, which the rule does not list', () => {
    expect(run(invoke('deploy'), {}, { commands: './cmds' })).toEqual([])
    expect(run(invoke('deploy'), {}, { commands: ['./cmds'] })).toEqual([])
  })

  check.each([
    ['hooks/hooks.json', '**/hooks/hooks.json'],
    ['.mcp.json', '**/.mcp.json'],
  ])('stays silent for %s, if a glob matches it', (file, glob) => {
    const { dir } = pluginTree({ name: 'p' })
    const code = JSON.stringify([monitor(invoke('gone'))])
    expect(lintPluginFile(RULE, [glob], path.join(dir, file), code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    const valid = JSON.stringify({ name: 'p', monitors: [monitor(invoke('gone'))] })
    expect(lint(dir, MANIFEST, valid)).toEqual([])
  })

  check('stays silent for monitors.json in a folder with no plugin', () => {
    const dir = tree({})
    const code = JSON.stringify([monitor(invoke('gone'))])
    expect(lint(dir, 'monitors/monitors.json', code)).toEqual([])
  })

  linked('stays silent for a skill folder that is a link to a folder in the repository', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'shared/SKILL.md': SKILL() },
    )
    link(top, 'skills/deploy', '../shared')
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a skills folder that is a link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p', monitors: [monitor(invoke('deploy'))] })
    link(top, 'skills', 'ghost')
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a commands folder that is a link with no target', () => {
    const { dir, code, top } = pluginTree({ name: 'p', monitors: [monitor(invoke('deploy'))] })
    link(top, 'commands', 'ghost')
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a SKILL.md that is a link with no target', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'skills/x/other.md': '' },
    )
    link(top, 'skills/x/SKILL.md', 'ghost')
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a SKILL.md that is a link out of the repository', () => {
    const elsewhere = tree({ 'SKILL.md': SKILL('deploy') }, false)
    const { dir, code, top } = pluginTree({ name: 'p', monitors: [monitor(invoke('deploy'))] })
    link(top, 'skills/x/SKILL.md', path.join(elsewhere, 'SKILL.md'))
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a skills key path that is a link out of the repository', () => {
    const elsewhere = tree({ 'deploy/SKILL.md': SKILL() }, false)
    const { dir, code, top } = pluginTree({
      name: 'p',
      skills: './out',
      monitors: [monitor(invoke('deploy'))],
    })
    link(top, 'out', elsewhere)
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  linked('stays silent for a commands folder with a link out of the repository', () => {
    const elsewhere = tree({ 'c.md': '' }, false)
    const { dir, code, top } = pluginTree({ name: 'p', monitors: [monitor(invoke('deploy'))] })
    link(top, 'commands/out', elsewhere)
    expect(lint(dir, MANIFEST, code)).toEqual([])
  })

  locked('stays silent for a skills folder that the rule cannot list', () => {
    const { dir, code } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'skills/x/SKILL.md': SKILL() },
    )
    const skills = path.join(dir, 'skills')
    expect(withoutAccess(skills, () => lint(dir, MANIFEST, code))).toEqual([])
  })

  locked('stays silent for a skills folder that the rule can enter and cannot list', () => {
    const { dir, code } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'skills/x/SKILL.md': SKILL() },
    )
    const skills = path.join(dir, 'skills')
    const mode = statSync(skills).mode
    chmodSync(skills, 0o100)
    try {
      expect(lint(dir, MANIFEST, code)).toEqual([])
    } finally {
      chmodSync(skills, mode)
    }
  })

  locked('stays silent for a skill folder that the rule cannot enter', () => {
    const { dir, code } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'skills/x/SKILL.md': SKILL() },
    )
    const folder = path.join(dir, 'skills', 'x')
    expect(withoutAccess(folder, () => lint(dir, MANIFEST, code))).toEqual([])
  })

  locked('stays silent for a SKILL.md that the rule cannot read', () => {
    const { dir, code } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'skills/x/SKILL.md': SKILL() },
    )
    const file = path.join(dir, 'skills', 'x', 'SKILL.md')
    expect(withoutAccess(file, () => lint(dir, MANIFEST, code))).toEqual([])
  })

  locked('stays silent for a commands folder that the rule cannot list', () => {
    const { dir, code } = pluginTree(
      { name: 'p', monitors: [monitor(invoke('deploy'))] },
      { 'commands/c.md': '' },
    )
    const commands = path.join(dir, 'commands')
    expect(withoutAccess(commands, () => lint(dir, MANIFEST, code))).toEqual([])
  })
})
