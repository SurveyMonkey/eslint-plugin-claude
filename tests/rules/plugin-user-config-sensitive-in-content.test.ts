// Claude Code writes a placeholder for `${user_config.KEY}` in skill and agent content when the
// option is `sensitive` (manifest reference, "Reference a saved value"). The plugin trees are on
// disk, because the rule reads the manifest around the file. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { pluginTree } from '../plugin-tree.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'plugin-user-config-sensitive-in-content'
const check = it
const linked = noLinks ? it.skip : check

const option = (extra: Record<string, unknown> = {}) => ({
  type: 'string',
  title: 'T',
  description: 'D',
  ...extra,
})
const MANIFEST = {
  name: 'p',
  userConfig: {
    token: option({ sensitive: true }),
    url: option(),
    flag: option({ sensitive: false }),
    text: option({ sensitive: 'true' }),
  },
}
const plugin = pluginTree(MANIFEST).dir
const skill = path.join(plugin, 'skills', 's', 'SKILL.md')
const agent = path.join(plugin, 'agents', 'a.md')

// Escaped, so that the template literal keeps each reference as text.
const ref = (key: string) => `\${user_config.${key}}`
const message = (key: string) =>
  `The option \`${key}\` is sensitive, so Claude Code writes a placeholder for \`${ref(key)}\` in skill and agent content, and not the value. Pass the value to a hook, an MCP server or an LSP server.`
const messages = (code: string, filename: string) =>
  lintMarkdown(RULE, code, filename).map((m) => m.message)

describe(RULE, () => {
  check('stays silent for an empty file', () => {
    expect(messages('', skill)).toEqual([])
  })

  check('reports the reference, with the full message and its place', () => {
    const found = lintMarkdown(RULE, `---\nname: s\n---\n\nCall with ${ref('token')} now\n`, skill)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'placeholder',
      message: message('token'),
      line: 5,
      column: 11,
      endLine: 5,
      endColumn: 31,
    })
  })

  check.each([
    ['a skill', skill],
    ['the root SKILL.md of a plugin', path.join(plugin, 'SKILL.md')],
    ['an agent', agent],
    ['an agent in a subfolder', path.join(plugin, 'agents', 'review', 'b.md')],
  ])('reports in %s', (_title, filename) => {
    expect(messages(`Use ${ref('token')}\n`, filename)).toEqual([message('token')])
  })

  check('reports each use, in a list and in fenced code', () => {
    const code = `${ref('token')} and ${ref('token')}\n\n- ${ref('token')}\n\n\`\`\`sh\nrun ${ref('token')}\n\`\`\`\n`
    const found = lintMarkdown(RULE, code, skill)
    expect(found.map((m) => [m.line, m.column])).toEqual([
      [1, 1],
      [1, 26],
      [3, 3],
      [6, 5],
    ])
  })

  check('reports a sensitive option and not a plain one in the same file', () => {
    expect(messages(`${ref('url')} ${ref('token')} ${ref('flag')}\n`, skill)).toEqual([
      message('token'),
    ])
  })

  check('reports the body after a frontmatter block that does not parse', () => {
    const found = lintMarkdown(RULE, `---\nname: [unclosed\n---\n\nRun ${ref('token')}\n`, skill)
    expect(found.map((m) => m.line)).toEqual([5])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['an option that is not sensitive', `Use ${ref('url')}\n`, skill],
    ['an option with sensitive false', `Use ${ref('flag')}\n`, skill],
    ['an option with sensitive set to a string', `Use ${ref('text')}\n`, skill],
    ['an option that the manifest does not declare', `Use ${ref('ghost')}\n`, skill],
    ['a key of the prototype', `Use ${ref('constructor')}\n`, skill],
    ['a reference with a dash in the key', `Use \${user_config.to-ken}\n`, skill],
    [
      'a variable that is not user_config',
      `Use \${CLAUDE_PLUGIN_ROOT} $user_config.token\n`,
      skill,
    ],
    ['text with no reference', '# S\n\nNothing here.\n', skill],
    [
      'the frontmatter, which is not the body',
      `---\nname: s\ndescription: ${ref('token')}\n---\n\nBody\n`,
      skill,
    ],
    [
      'a command, which the docs do not name',
      `Use ${ref('token')}\n`,
      path.join(plugin, 'commands', 'c.md'),
    ],
    [
      'a local skill',
      `Use ${ref('token')}\n`,
      path.join(plugin, '.claude', 'skills', 's', 'SKILL.md'),
    ],
    ['a local agent', `Use ${ref('token')}\n`, path.join(plugin, '.claude', 'agents', 'a.md')],
    ['a SKILL.md outside skills/', `Use ${ref('token')}\n`, path.join(plugin, 'docs', 'SKILL.md')],
  ])('stays silent for %s', (_title, code, filename) => {
    expect(messages(code, filename)).toEqual([])
  })

  check.each([
    ['no userConfig', { name: 'p' }],
    ['a userConfig that is an array', { name: 'p', userConfig: ['token'] }],
    ['a userConfig that is a string', { name: 'p', userConfig: 'token' }],
    ['a userConfig that is null', { name: 'p', userConfig: null }],
    ['an option that is null', { name: 'p', userConfig: { token: null } }],
    ['an option that is a string', { name: 'p', userConfig: { token: 'sensitive' } }],
    ['a manifest that is an array', []],
  ])('stays silent for %s', (_title, manifest) => {
    const dir = pluginTree(manifest).dir
    expect(messages(`Use ${ref('token')}\n`, path.join(dir, 'skills', 's', 'SKILL.md'))).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const dir = pluginTree('{').dir
    expect(messages(`Use ${ref('token')}\n`, path.join(dir, 'skills', 's', 'SKILL.md'))).toEqual([])
  })

  check('stays silent for a skill with no manifest', () => {
    const dir = tree({})
    expect(messages(`Use ${ref('token')}\n`, path.join(dir, 'skills', 's', 'SKILL.md'))).toEqual([])
  })

  linked('stays silent for a skill of a .claude-plugin directory out of the repository', () => {
    const outside = tree({})
    const elsewhere = tree({ 'p/plugin.json': JSON.stringify(MANIFEST) }, false)
    link(outside, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(
      messages(`Use ${ref('token')}\n`, path.join(outside, 'skills', 's', 'SKILL.md')),
    ).toEqual([])
  })
})
