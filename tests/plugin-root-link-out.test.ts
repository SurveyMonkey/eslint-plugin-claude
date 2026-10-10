// A plugin root that links out of the repository, with a `.claude-plugin`
// that links back in, is a plugin that `readPluginAt` does not give. No rule
// of the plugin layer reports for it, because the rule would look at files
// out of the repository (ADR 001, Decision 14). Each case also lints the same
// files in a plugin that sits in the repository, so a silent result is not an
// error of the fixture.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPluginAt } from '../src/plugin-manifest.ts'
import { link, noLinks, tree } from './marketplace-tree.test-support.ts'
import { lintPlugin, lintPluginFile, pluginTree } from './plugin-tree.test-support.ts'
import { lintMarkdown } from './rule-tester.test-support.ts'

const linked = noLinks ? it.skip : it
const MANIFEST = '{"name": "p"}'
const LFS = 'filter=lfs diff=lfs merge=lfs -text'

/** The plugin root `p` of a new repository. The root is a link to a folder
 *  out of the repository that holds `files`. The `.claude-plugin` of that
 *  folder links back to a folder of the repository. Each name of `back` in
 *  that folder links to a file of the repository, which holds the text. */
function linkedOut(
  files: Record<string, string>,
  back: Record<string, string> = {},
  manifest = MANIFEST,
  more: Record<string, string> = {},
) {
  const top = tree({ 'meta/plugin.json': manifest, ...prefixed(back), ...more })
  const elsewhere = tree(files, false)
  link(top, 'p', elsewhere)
  link(elsewhere, '.claude-plugin', path.join(top, 'meta'))
  for (const name of Object.keys(back)) {
    link(elsewhere, name, path.join(top, 'back', name))
  }
  return { top, dir: path.join(top, 'p') }
}
const prefixed = (back: Record<string, string>) =>
  Object.fromEntries(Object.entries(back).map(([name, text]) => [`back/${name}`, text]))

const inside = (files: Record<string, string>) => pluginTree(MANIFEST, files).dir

const SHELL = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: 'command', command: `run \${user_config.key}` }] }] },
})
const MONITORS = JSON.stringify([{ name: 'm', command: 'run $CLAUDE_PLUGIN_ROOT/x' }])

describe('a plugin root that links out of the repository', () => {
  const jsonCases: [string, string, string, string][] = [
    ['plugin-user-config-no-shell-fields', 'hooks/hooks.json', '**/hooks/hooks.json', SHELL],
    [
      'plugin-monitors-command-env',
      'monitors/monitors.json',
      '**/monitors/monitors.json',
      MONITORS,
    ],
  ]
  it.each(jsonCases)('%s reports in the plugin in the repository', (rule, file, glob, code) => {
    expect(lintPluginFile(rule, [glob], path.join(inside({}), file), code)).toHaveLength(1)
  })
  linked.each(jsonCases)('%s stays silent for the linked plugin', (rule, file, glob, code) => {
    const { dir } = linkedOut({})
    expect(lintPluginFile(rule, [glob], path.join(dir, file), code)).toEqual([])
  })

  it('plugin-path-var-braced reports in the plugin in the repository', () => {
    const file = path.join(inside({}), 'skills', 's', 'SKILL.md')
    expect(
      lintMarkdown('plugin-path-var-braced', 'Run $CLAUDE_PLUGIN_ROOT/x\n', file),
    ).toHaveLength(1)
  })
  linked('plugin-path-var-braced stays silent for the linked plugin', () => {
    const { dir } = linkedOut({})
    const file = path.join(dir, 'skills', 's', 'SKILL.md')
    expect(lintMarkdown('plugin-path-var-braced', 'Run $CLAUDE_PLUGIN_ROOT/x\n', file)).toEqual([])
  })

  it('plugin-no-git-lfs reports in the plugin in the repository', () => {
    const files = { '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '' }
    expect(lintPlugin('plugin-no-git-lfs', inside(files), MANIFEST)).toHaveLength(1)
  })
  linked('plugin-no-git-lfs stays silent for the linked plugin', () => {
    const { dir } = linkedOut({ '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '' })
    expect(lintPlugin('plugin-no-git-lfs', dir, MANIFEST)).toEqual([])
  })

  it('plugin-package-lockfile reports in the plugin in the repository', () => {
    const files = { 'package.json': '{}', 'yarn.lock': '' }
    expect(lintPlugin('plugin-package-lockfile', inside(files), MANIFEST)).toHaveLength(1)
  })
  // The files link back in, so only a look at the folder out of the repository
  // tells that no npm lockfile is there.
  linked('plugin-package-lockfile stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, { 'package.json': '{}', 'yarn.lock': '' })
    expect(lintPlugin('plugin-package-lockfile', dir, MANIFEST)).toEqual([])
  })
})

describe('the cross-file rules of the plugin layer', () => {
  const SETTINGS = JSON.stringify({ name: 'p', settings: { agent: 'a' } })
  it('plugin-settings-single-source reports in the plugin in the repository', () => {
    const { dir, code } = pluginTree(SETTINGS, { 'settings.json': '{"agent": "b"}' })
    expect(lintPlugin('plugin-settings-single-source', dir, code).map((m) => m.messageId)).toEqual([
      'ignored',
    ])
  })
  linked('plugin-settings-single-source stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, { 'settings.json': '{"agent": "b"}' }, SETTINGS)
    expect(lintPlugin('plugin-settings-single-source', dir, SETTINGS)).toEqual([])
  })

  const SENSITIVE = JSON.stringify({
    name: 'p',
    userConfig: { token: { type: 'string', title: 'T', description: 'D', sensitive: true } },
  })
  const USE = `Use \${user_config.token}\n`
  it('plugin-user-config-sensitive-in-content reports in the plugin in the repository', () => {
    const file = path.join(pluginTree(SENSITIVE).dir, 'skills', 's', 'SKILL.md')
    expect(
      lintMarkdown('plugin-user-config-sensitive-in-content', USE, file).map((m) => m.messageId),
    ).toEqual(['placeholder'])
  })
  linked('plugin-user-config-sensitive-in-content stays silent for the linked plugin', () => {
    const file = path.join(linkedOut({}, {}, SENSITIVE).dir, 'skills', 's', 'SKILL.md')
    expect(lintMarkdown('plugin-user-config-sensitive-in-content', USE, file)).toEqual([])
  })

  const MONITOR = JSON.stringify({
    name: 'p',
    monitors: [{ name: 'm', command: 'run', description: 'd', when: 'on-skill-invoke:gone' }],
  })
  it('plugin-monitors-skill-exists reports in the plugin in the repository', () => {
    const { dir, code } = pluginTree(MONITOR)
    expect(lintPlugin('plugin-monitors-skill-exists', dir, code).map((m) => m.messageId)).toEqual([
      'missing',
    ])
  })
  linked('plugin-monitors-skill-exists stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, {}, MONITOR)
    expect(lintPlugin('plugin-monitors-skill-exists', dir, MONITOR)).toEqual([])
  })

  const CATALOG = JSON.stringify({
    name: 'acme',
    plugins: [{ name: 'p', source: { source: 'npm', package: '@acme/p' } }],
  })
  const DEPENDENT = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
  it('plugin-dependencies-resolve reports in the plugin in the repository', () => {
    const { dir, code } = pluginTree(DEPENDENT, { '.claude-plugin/marketplace.json': CATALOG })
    expect(lintPlugin('plugin-dependencies-resolve', dir, code).map((m) => m.messageId)).toEqual([
      'missing',
    ])
  })
  linked('plugin-dependencies-resolve stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, {}, DEPENDENT, { '.claude-plugin/marketplace.json': CATALOG })
    expect(lintPlugin('plugin-dependencies-resolve', dir, DEPENDENT)).toEqual([])
  })

  it('plugin-npm-source-shrinkwrap reports in the plugin in the repository', () => {
    const { dir, code } = pluginTree(MANIFEST, {
      '.claude-plugin/marketplace.json': CATALOG,
      'package.json': '{}',
    })
    expect(lintPlugin('plugin-npm-source-shrinkwrap', dir, code).map((m) => m.messageId)).toEqual([
      'missing',
    ])
  })
  linked('plugin-npm-source-shrinkwrap stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, { 'package.json': '{}' }, MANIFEST, {
      '.claude-plugin/marketplace.json': CATALOG,
    })
    expect(lintPlugin('plugin-npm-source-shrinkwrap', dir, MANIFEST)).toEqual([])
  })
})

describe('the path and settings rules of the plugin layer', () => {
  const SKILLS = JSON.stringify({ name: 'p', skills: './skills' })
  it('plugin-skills-key-redundant-default reports in the plugin in the repository', () => {
    const { dir, code } = pluginTree(SKILLS)
    expect(
      lintPlugin('plugin-skills-key-redundant-default', dir, code).map((m) => m.messageId),
    ).toEqual(['redundant'])
  })
  linked('plugin-skills-key-redundant-default stays silent for the linked plugin', () => {
    const { dir } = linkedOut({}, {}, SKILLS)
    expect(lintPlugin('plugin-skills-key-redundant-default', dir, SKILLS)).toEqual([])
  })
})

describe('readPluginAt', () => {
  it('gives the plugin for a root in the repository', () => {
    expect(readPluginAt(inside({}))).toMatchObject({ fields: { name: 'p' } })
  })
  linked('gives no plugin for a root that links out of the repository', () => {
    expect(readPluginAt(linkedOut({}).dir)).toBeUndefined()
  })
})
