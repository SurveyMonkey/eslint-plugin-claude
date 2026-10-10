// Claude Code does not load a component that sits inside `.claude-plugin/`.
// Only `plugin.json` belongs there, and `marketplace.json` for a marketplace
// (manifest reference, "Manifest file"). The rule lists the components that it
// finds in that directory. The trees are on disk, because the rule reads the
// directory. The files glob and the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-manifest-location'
const check = it.fails
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const message = (names: string) =>
  `Claude Code does not load components from \`.claude-plugin/\`: ${names}. Only \`plugin.json\` and \`marketplace.json\` belong there. Move each component to the plugin root.`

describe(RULE, () => {
  check(
    'reports a skills directory in .claude-plugin/, on the manifest, with the full message',
    () => {
      const { dir, code } = pluginTree(
        { name: 'p' },
        { '.claude-plugin/skills/s/SKILL.md': '# S\n' },
      )
      const messages = lint(dir, code)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'misplaced',
        message: message('`skills`'),
        line: 1,
        column: 1,
      })
    },
  )

  check.each([
    ['commands', { '.claude-plugin/commands/c.md': '# C\n' }, '`commands`'],
    ['agents', { '.claude-plugin/agents/a.md': '# A\n' }, '`agents`'],
    ['hooks', { '.claude-plugin/hooks/hooks.json': '{}' }, '`hooks`'],
    ['output styles', { '.claude-plugin/output-styles/s.md': '# S\n' }, '`output-styles`'],
    ['workflows', { '.claude-plugin/workflows/w.js': '' }, '`workflows`'],
    ['themes', { '.claude-plugin/themes/t.json': '{}' }, '`themes`'],
    ['monitors', { '.claude-plugin/monitors/monitors.json': '[]' }, '`monitors`'],
    ['executables', { '.claude-plugin/bin/tool': '' }, '`bin`'],
    ['settings', { '.claude-plugin/settings.json': '{}' }, '`settings.json`'],
    ['an MCP file', { '.claude-plugin/.mcp.json': '{}' }, '`.mcp.json`'],
    ['an LSP file', { '.claude-plugin/.lsp.json': '{}' }, '`.lsp.json`'],
  ])('reports %s', (_title, files, names) => {
    const { dir, code } = pluginTree({ name: 'p' }, files)
    expect(lint(dir, code).map((m) => m.message)).toEqual([message(names)])
  })

  check('names each component once, in name order, in one report', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      {
        '.claude-plugin/skills/s/SKILL.md': '# S\n',
        '.claude-plugin/.mcp.json': '{}',
        '.claude-plugin/agents/a.md': '# A\n',
        '.claude-plugin/commands/c.md': '# C\n',
      },
    )
    expect(lint(dir, code).map((m) => m.message)).toEqual([
      message('`.mcp.json`, `agents`, `commands`, `skills`'),
    ])
  })

  check('reports a component that is a file', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { '.claude-plugin/skills': 'not a directory' })
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('`skills`')])
  })

  check('reports a plugin that sits below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { '.claude-plugin/commands/c.md': '# C\n' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })

  linked('reports a component that is a link inside the repository', () => {
    const { dir, code, top } = pluginTree({ name: 'p' }, { 'shared/s/SKILL.md': '# S\n' })
    link(top, '.claude-plugin/skills', '../shared')
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('`skills`')])
  })
})

describe(`${RULE} (silent)`, () => {
  check('stays silent for a directory that holds only the manifest', () => {
    const { dir, code } = pluginTree({ name: 'p' })
    expect(lint(dir, code)).toEqual([])
  })

  check('stays silent for the components at the plugin root', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      {
        'skills/s/SKILL.md': '# S\n',
        'commands/c.md': '# C\n',
        'agents/a.md': '# A\n',
        'hooks/hooks.json': '{}',
        '.mcp.json': '{}',
      },
    )
    expect(lint(dir, code)).toEqual([])
  })

  check(
    'stays silent for a marketplace.json beside the manifest, and for files that are no component',
    () => {
      const { dir, code } = pluginTree(
        { name: 'p' },
        {
          '.claude-plugin/marketplace.json': '{}',
          '.claude-plugin/README.md': '# P\n',
          '.claude-plugin/notes/n.md': '# N\n',
          '.claude-plugin/Skills': 'a name that differs in letter case',
        },
      )
      expect(lint(dir, code)).toEqual([])
    },
  )

  check('stays silent for a directory that holds no manifest on disk', () => {
    const top = tree({ '.claude-plugin/skills/s/SKILL.md': '# S\n' })
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
    ['a manifest that is null', 'null'],
  ])('makes no report for %s', (_title, text) => {
    const { dir, code } = pluginTree(text, { '.claude-plugin/skills/s/SKILL.md': '# S\n' })
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const outside = tree({
      'p/plugin.json': '{"name": "p"}',
      'p/skills/s/SKILL.md': '# S\n',
    })
    const top = tree({})
    link(top, '.claude-plugin', path.join(outside, 'p'))
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  linked('makes no report for a manifest that is a link out of the repository', () => {
    const outside = tree({ 'plugin.json': '{"name": "p"}' })
    const files = { '.claude-plugin/skills/s/SKILL.md': '# S\n' }
    // Control: the same tree, with the manifest in the repository, gets a report.
    const inside = pluginTree({ name: 'p' }, files)
    expect(lint(inside.dir, inside.code)).toHaveLength(1)
    const top = tree(files)
    link(top, '.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(top, '{"name": "p"}')).toEqual([])
  })

  locked('makes no report for a .claude-plugin directory that it cannot read', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { '.claude-plugin/skills/s/SKILL.md': '# S\n' })
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, '.claude-plugin'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
