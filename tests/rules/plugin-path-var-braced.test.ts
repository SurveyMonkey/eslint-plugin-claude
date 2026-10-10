// Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`
// in the Markdown of a plugin skill, command and agent, and not the bare form
// (manifest reference, "Where each variable resolves"). The plugin trees are on
// disk, because the rule finds the plugin around the file. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { pluginTree } from '../plugin-tree.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'plugin-path-var-braced'
const check = it.fails
const linked = noLinks ? it.skip : check

const plugin = pluginTree({ name: 'p' }).dir
const badManifest = pluginTree('{').dir
const arrayManifest = pluginTree('[]').dir
const noManifest = tree({})
const outside = tree({})
const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
if (!noLinks) {
  link(outside, '.claude-plugin', path.join(elsewhere, 'p'))
}

// Escaped, so that the template literal keeps each variable as text.
const root = `\${CLAUDE_PLUGIN_ROOT}`
const data = `\${CLAUDE_PLUGIN_DATA}`
const skillDir = `\${CLAUDE_SKILL_DIR}`
const message = (variable: string) =>
  `Claude Code substitutes \`\${${variable}}\` in plugin content and not \`$${variable}\`. The bare form stays literal text, and a Bash command has no such variable. Write \`\${${variable}}\`.`

const skill = path.join(plugin, 'skills', 's', 'SKILL.md')
const command = path.join(plugin, 'commands', 'c.md')
const agent = path.join(plugin, 'agents', 'a.md')
const BARE = 'Run $CLAUDE_PLUGIN_ROOT/run.sh\n'
const messages = (code: string, filename: string) =>
  lintMarkdown(RULE, code, filename).map((m) => m.message)

describe(RULE, () => {
  check('reports on the variable, with the full message', () => {
    const found = lintMarkdown(RULE, '---\nname: s\n---\n\nRun $CLAUDE_PLUGIN_ROOT/run.sh\n', skill)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'bare',
      message: message('CLAUDE_PLUGIN_ROOT'),
      line: 5,
      column: 5,
      endLine: 5,
      endColumn: 24,
    })
  })

  check('reports the data variable', () => {
    const found = lintMarkdown(RULE, 'Cache in $CLAUDE_PLUGIN_DATA/cache\n', command)
    expect(found.map((m) => [m.message, m.line, m.column, m.endColumn])).toEqual([
      [message('CLAUDE_PLUGIN_DATA'), 1, 10, 29],
    ])
  })

  check.each([
    ['a skill', skill],
    ['the root SKILL.md of a plugin', path.join(plugin, 'SKILL.md')],
    ['a command', command],
    ['a command in a subfolder', path.join(plugin, 'commands', 'ns', 'd.md')],
    ['an agent', agent],
    ['an agent in a subfolder', path.join(plugin, 'agents', 'review', 'deep', 'b.md')],
  ])('reports in %s', (_title, filename) => {
    expect(messages(BARE, filename)).toEqual([message('CLAUDE_PLUGIN_ROOT')])
  })

  check('reports each use, in a list and in fenced code, and not the braced use', () => {
    const code = `$CLAUDE_PLUGIN_ROOT and $CLAUDE_PLUGIN_DATA ${root}\n\n- $CLAUDE_PLUGIN_ROOT\n\n\`\`\`sh\nsh "$CLAUDE_PLUGIN_ROOT/run.sh"\n\`\`\`\n`
    const found = lintMarkdown(RULE, code, skill)
    expect(found.map((m) => [m.line, m.column])).toEqual([
      [1, 1],
      [1, 25],
      [3, 3],
      [6, 5],
    ])
    expect(found.map((m) => m.message)).toEqual([
      message('CLAUDE_PLUGIN_ROOT'),
      message('CLAUDE_PLUGIN_DATA'),
      message('CLAUDE_PLUGIN_ROOT'),
      message('CLAUDE_PLUGIN_ROOT'),
    ])
  })

  check('reports the body after a frontmatter block that does not parse', () => {
    const found = lintMarkdown(
      RULE,
      '---\nname: [unclosed\n---\n\nRun $CLAUDE_PLUGIN_ROOT\n',
      skill,
    )
    expect(found.map((m) => m.line)).toEqual([5])
  })

  check('reports the bare form on a line that also has the braced form', () => {
    const found = lintMarkdown(RULE, `Run ${root}/a and $CLAUDE_PLUGIN_ROOT/b\n`, command)
    expect(found.map((m) => [m.line, m.column])).toEqual([[1, 29]])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['an empty file', '', skill],
    ['the braced form', `Run ${root}/run.sh and ${data}/cache\n`, skill],
    ['the braced form in a command', `Run ${root}\n`, command],
    ['the braced form in an agent', `Run ${root}\n`, agent],
    ['a variable that works everywhere', `Run ${skillDir}/run.sh $CLAUDE_SKILL_DIR\n`, skill],
    [
      'a name that only starts like the variable',
      'Run $CLAUDE_PLUGIN_ROOT_DIR/x $CLAUDE_PLUGIN_DATAS $CLAUDE_PLUGIN_ROOT2 $CLAUDE_PLUGIN_OPTION_X\n',
      skill,
    ],
    ['text that is no variable', 'Run CLAUDE_PLUGIN_ROOT and $CLAUDE_PLUGIN\n', skill],
    ['text with no variable', '# S\n\nNothing here.\n', skill],
    [
      'the frontmatter, which is not the body',
      '---\nname: s\nallowed-tools: Bash($CLAUDE_PLUGIN_ROOT/run.sh)\n---\n\nBody\n',
      skill,
    ],
    ['a local skill', BARE, path.join(plugin, '.claude', 'skills', 's', 'SKILL.md')],
    ['a local command', BARE, path.join(plugin, '.claude', 'commands', 'c.md')],
    ['a local agent', BARE, path.join(plugin, '.claude', 'agents', 'a.md')],
    ['a SKILL.md outside skills/', BARE, path.join(plugin, 'docs', 'SKILL.md')],
    ['a SKILL.md in agents/', BARE, path.join(plugin, 'agents', 'SKILL.md')],
    [
      'a skill of a manifest that does not parse',
      BARE,
      path.join(badManifest, 'skills', 's', 'SKILL.md'),
    ],
    [
      'a command of a manifest that does not parse',
      BARE,
      path.join(badManifest, 'commands', 'c.md'),
    ],
    ['an agent of a manifest that does not parse', BARE, path.join(badManifest, 'agents', 'a.md')],
    [
      'a skill of a manifest that is an array',
      BARE,
      path.join(arrayManifest, 'skills', 's', 'SKILL.md'),
    ],
    ['a skill with no manifest', BARE, path.join(noManifest, 'skills', 's', 'SKILL.md')],
    ['a command with no manifest', BARE, path.join(noManifest, 'commands', 'c.md')],
    ['an agent with no manifest', BARE, path.join(noManifest, 'agents', 'a.md')],
  ])('stays silent for %s', (_title, code, filename) => {
    expect(messages(code, filename)).toEqual([])
  })

  linked('stays silent for a skill of a .claude-plugin directory out of the repository', () => {
    expect(messages(BARE, path.join(outside, 'skills', 's', 'SKILL.md'))).toEqual([])
  })

  linked('stays silent for an agent of a .claude-plugin directory out of the repository', () => {
    expect(messages(BARE, path.join(outside, 'agents', 'a.md'))).toEqual([])
  })
})
