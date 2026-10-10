// A `commands` path in a manifest that names a directory with no command in it
// gives a warning in the debug log of Claude Code, and nothing in the session
// (troubleshooting, "Warning: No commands found in plugin custom directory").
// The trees are on disk, because the rule reads the directory. The files glob
// is in tests/configs.test.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-commands-dir-nonempty'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const message = (dir: string) =>
  `The \`commands\` path \`${dir}\` holds no \`.md\` file and no subdirectory with a \`SKILL.md\`. Claude Code loads no command from it. Add command files, or remove the path.`
const run = (commands: unknown, files: Record<string, string>) => {
  const { dir, code } = pluginTree({ name: 'p', commands }, files)
  return lint(dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports a directory with no command, on the path string, with the full message', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './cmds' }, { 'cmds/.gitkeep': '' })
    const found = lint(dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'empty',
      message: message('./cmds'),
      line: 1,
      column: 24,
      endColumn: 32,
    })
  })

  check('reports a directory that is empty', () => {
    const { dir, code, top } = pluginTree({ name: 'p', commands: './cmds' }, {})
    mkdirSync(path.join(top, 'cmds'))
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('./cmds')])
  })

  check.each([
    ['files that are no Markdown', { 'cmds/notes.txt': 'x', 'cmds/c.md.bak': 'x' }],
    ['subdirectories with no Markdown', { 'cmds/sub/notes.txt': 'x', 'cmds/other/.gitkeep': '' }],
    ['a name that only ends like Markdown', { 'cmds/md': 'x', 'cmds/c.mdx': 'x' }],
  ])('reports a directory with %s', (_title, files) => {
    expect(run('./cmds', files)).toEqual([message('./cmds')])
  })

  check('reports the default commands/ directory when the key names it and it is empty', () => {
    expect(run('./commands/', { 'commands/.gitkeep': '' })).toEqual([message('./commands/')])
  })

  check('reports each empty directory of an array, and skips the others', () => {
    const files = { 'a/.gitkeep': '', 'b/c.md': '# C\n', 'd/.gitkeep': '' }
    expect(run(['./a', './b', './d'], files)).toEqual([message('./a'), message('./d')])
  })

  check('reports an array that holds a path and an entry that is no string', () => {
    expect(run([3, null, './a'], { 'a/.gitkeep': '' })).toEqual([message('./a')])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p', commands: './cmds' },
      { 'cmds/.gitkeep': '' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })

  linked('reports a directory that is a link inside the plugin', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', commands: './alias' },
      { 'store/.gitkeep': '' },
    )
    link(top, 'alias', 'store')
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('./alias')])
  })

  linked('reports a directory whose only Markdown entry is a dangling link', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './cmds' }, { 'cmds/.gitkeep': '' })
    link(dir, 'cmds/c.md', 'ghost.md')
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('./cmds')])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a Markdown file', { 'cmds/c.md': '# C\n' }],
    ['a skill folder', { 'cmds/s/SKILL.md': '# S\n' }],
    ['a Markdown file in a subfolder', { 'cmds/ns/c.md': '# C\n' }],
    ['a Markdown file deeper down', { 'cmds/a/b/c.md': '# C\n' }],
    ['a Markdown file next to other files', { 'cmds/notes.txt': 'x', 'cmds/c.md': '# C\n' }],
  ])('stays silent for a directory with %s', (_title, files) => {
    expect(run('./cmds', files)).toEqual([])
  })

  linked('stays silent for a directory with a Markdown file that is a link in the plugin', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', commands: './cmds' },
      { 'shared/c.md': '# C\n' },
    )
    mkdirSync(path.join(top, 'cmds'))
    link(top, 'cmds/c.md', '../shared/c.md')
    expect(lint(dir, code)).toEqual([])
  })

  check.each([
    ['a command file', './cmds/c.md', { 'cmds/c.md': '# C\n' }],
    ['a file that is no Markdown', './cmds/x.txt', { 'cmds/x.txt': 'x' }],
    ['a path that is not on disk', './ghost', {}],
    ['a path with a ghost part', './ghost/cmds', {}],
    ['a path that leaves the plugin', '../cmds', {}],
    ['an absolute path', '/', {}],
    ['an empty string', '', { 'cmds/c.md': '# C\n' }],
  ])('stays silent for %s', (_title, commands, files) => {
    expect(run(commands, files)).toEqual([])
  })

  check('stays silent for a directory above the plugin root, also when it is empty', () => {
    const { dir, code, top } = pluginTree({ name: 'p', commands: './../empty' }, {}, 'plugins/p/')
    mkdirSync(path.join(top, 'plugins', 'empty'))
    expect(lint(dir, code)).toEqual([])
  })

  check.each([
    ['an object map', { status: { source: './commands/status.md' }, about: { content: 'x' } }],
    ['null', null],
    ['a number', 3],
    ['an empty array', []],
  ])('stays silent for commands as %s', (_title, commands) => {
    expect(run(commands, { 'commands/.gitkeep': '' })).toEqual([])
  })

  check('stays silent for no commands key, also with an empty commands/ directory', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { 'commands/.gitkeep': '' })
    expect(lint(dir, code)).toEqual([])
  })

  check('stays silent for the last of two commands keys', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'cmds/.gitkeep': '' })
    expect(lint(dir, '{"name": "p", "commands": "./cmds", "commands": "./cmds/c.md"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ 'cmds/.gitkeep': '' })
    expect(lint(top, '{"name": "p", "commands": "./cmds"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, { 'cmds/.gitkeep': '' })
    expect(lint(dir, '{"name": "p", "commands": "./cmds"}')).toEqual([])
  })

  linked('makes no report for a directory that is a link out of the repository', () => {
    const elsewhere = tree({ '.gitkeep': '' })
    const { dir, code } = pluginTree({ name: 'p', commands: './alias' }, {})
    link(dir, 'alias', elsewhere)
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a directory with a Markdown link out of the repository', () => {
    const elsewhere = tree({})
    writeFileSync(path.join(elsewhere, 'c.md'), '# C\n')
    const { dir, code } = pluginTree({ name: 'p', commands: './cmds' }, { 'cmds/.gitkeep': '' })
    link(dir, 'cmds/c.md', path.join(elsewhere, 'c.md'))
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a dangling link on the path', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './alias/cmds' }, {})
    link(dir, 'alias', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ 'cmds/.gitkeep': '' })
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, '{"name": "p", "commands": "./cmds"}')).toEqual([])
  })

  locked('makes no report for a directory that it cannot list', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './cmds' }, { 'cmds/.gitkeep': '' })
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, 'cmds'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })

  locked('makes no report for a subdirectory that it cannot list', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './cmds' }, { 'cmds/sub/.gitkeep': '' })
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, 'cmds', 'sub'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
