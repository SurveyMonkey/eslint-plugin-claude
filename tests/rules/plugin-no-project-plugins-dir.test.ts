// Claude Code does not scan the `.claude/plugins/` directory of a project
// (plugin loading reference, "Plugins shared through a repository"). The rule
// reports a plugin below that directory, from its manifest. The trees are on
// disk, because the rule finds the plugin root. The files glob and the decoy
// files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-no-project-plugins-dir'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const MESSAGE =
  'This plugin is under `.claude/plugins/`. Claude Code does not scan that directory. A marketplace entry or `--plugin-dir` can still load it. Move it to `.claude/skills/<name>/`, or enable it through `enabledPlugins`.'
const run = (at: string, files: Record<string, string> = {}) => {
  const { dir, code } = pluginTree({ name: 'p' }, files, at)
  return lint(dir, code)
}

describe(RULE, () => {
  check('reports a plugin in .claude/plugins/, on the manifest, with the full message', () => {
    const messages = run('.claude/plugins/p/')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'projectPlugins',
      message: MESSAGE,
      line: 1,
      column: 1,
    })
  })

  check.each([
    ['a plugin in a folder of plugins', '.claude/plugins/group/p/'],
    ['a plugin in a nested .claude/plugins/', 'packages/x/.claude/plugins/p/'],
    ['a plugin deeper than the plugins folder', '.claude/plugins/a/b/c/p/'],
  ])('reports %s', (_title, at) => {
    expect(run(at).map((m) => m.message)).toEqual([MESSAGE])
  })

  check('reports a plugin with files of its own', () => {
    expect(run('.claude/plugins/p/', { 'skills/s/SKILL.md': '# S\n' })).toHaveLength(1)
  })

  linked('reports a plugin that sits behind a link inside .claude/plugins/', () => {
    const { top, code } = pluginTree({ name: 'p' }, {}, 'store/p/')
    link(top, '.claude/plugins', '../store')
    expect(lint(path.join(top, '.claude', 'plugins', 'p'), code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a plugin in plugins/', 'plugins/p/'],
    ['a project skills plugin', '.claude/skills/p/'],
    ['a plugin at the repository root', ''],
    ['a plugins folder of another directory', '.config/plugins/p/'],
    ['a folder that only starts with plugins', '.claude/plugins-extra/p/'],
    ['a .claude folder in the name of another folder', 'x.claude/plugins/p/'],
    ['a plugin folder in the singular', '.claude/plugin/p/'],
    ['a plugins folder below another folder of .claude', '.claude/other/plugins/p/'],
    ['the plugins folder itself as the plugin', '.claude/plugins/'],
  ])('stays silent for %s', (_title, at) => {
    expect(run(at)).toEqual([])
  })

  check('stays silent for a repository that sits inside a .claude/plugins directory', () => {
    // The cache of Claude Code holds clones like this. The directory is above the repository.
    expect(run('.claude/plugins/repo/', { '.git/HEAD': 'ref: refs/heads/main\n' })).toEqual([])
  })

  check('stays silent in a tree with no .git, which has no repository', () => {
    const top = tree({ '.claude/plugins/p/.claude-plugin/plugin.json': '{"name": "p"}' }, false)
    expect(lint(path.join(top, '.claude', 'plugins', 'p'), '{"name": "p"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ '.claude/plugins/p/README.md': '# P\n' })
    expect(lint(path.join(top, '.claude', 'plugins', 'p'), '{"name": "p"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, {}, '.claude/plugins/p/')
    expect(lint(dir, '{"name": "p"}')).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const outside = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ '.claude/plugins/p/README.md': '# P\n' })
    const dir = path.join(top, '.claude', 'plugins', 'p')
    link(dir, '.claude-plugin', path.join(outside, 'p'))
    expect(lint(dir, '{"name": "p"}')).toEqual([])
  })

  linked('makes no report for a plugin that is a link out of the repository', () => {
    const outside = tree({ '.claude-plugin/plugin.json': '{"name": "p"}' })
    const top = tree({})
    link(top, '.claude/plugins/p', outside)
    expect(lint(path.join(top, '.claude', 'plugins', 'p'), '{"name": "p"}')).toEqual([])
  })

  locked('makes no report for a .claude-plugin directory that it cannot read', () => {
    const { dir, code } = pluginTree({ name: 'p' }, {}, '.claude/plugins/p/')
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, '.claude-plugin'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
