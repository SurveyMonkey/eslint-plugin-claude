// The `agent` key of the default settings of a plugin runs one of the plugin's own agents as the main
// thread (components page, "Default settings"). The settings are in a root `settings.json` or in the
// manifest key `settings`. The trees are on disk, because the rule lists the agent files of the
// plugin. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-settings-agent-exists'
const check = it
const linked = noLinks ? it.skip : check
const GLOBS = ['**/.claude-plugin/plugin.json', '**/settings.json']

const message = (agent: string) =>
  `\`${agent}\` is not a built-in agent, and no file in \`agents/\` of this plugin defines it. The \`agent\` key runs one of the plugin's own agents.`
const REVIEWER = '---\nname: reviewer\ndescription: d\n---\n'
const manifestOf = (settings: unknown, more: Record<string, unknown> = {}) => ({
  name: 'p',
  settings,
  ...more,
})
/** The messages for the manifest of a plugin tree. */
const inManifest = (
  settings: unknown,
  files: Record<string, string> = {},
  more: Record<string, unknown> = {},
) => {
  const { dir, code } = pluginTree(manifestOf(settings, more), files)
  return lintPlugin(RULE, dir, code)
}
/** The messages for the root `settings.json` of a plugin tree. */
const inFile = (
  text: string,
  files: Record<string, string> = {},
  manifest: unknown = { name: 'p' },
) => {
  const { dir } = pluginTree(manifest, { ...files, 'settings.json': text })
  return lintPluginFile(RULE, GLOBS, path.join(dir, 'settings.json'), text)
}

describe(RULE, () => {
  check('reports an agent of the manifest settings, with the full message and position', () => {
    const found = inManifest({ agent: 'ghost' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: message('ghost'),
      line: 1,
      column: 33,
      endLine: 1,
      endColumn: 40,
    })
  })

  check('reports an agent of the root settings.json, with the full message and position', () => {
    const found = inFile('{"agent": "ghost"}')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: message('ghost'),
      line: 1,
      column: 11,
      endColumn: 18,
    })
  })

  check('reports when the plugin has agents and none has the name', () => {
    expect(inManifest({ agent: 'ghost' }, { 'agents/reviewer.md': REVIEWER })).toHaveLength(1)
    expect(inFile('{"agent": "ghost"}', { 'agents/reviewer.md': REVIEWER })).toHaveLength(1)
  })

  check('reports the file name of an agent that its frontmatter renames', () => {
    const files = { 'agents/x.md': '---\nname: audit\n---\n' }
    expect(inManifest({ agent: 'x' }, files).map((m) => m.messageId)).toEqual(['missing'])
  })

  check('reports a name that differs from an agent by a letter', () => {
    expect(inManifest({ agent: 'reviewers' }, { 'agents/reviewer.md': REVIEWER })).toHaveLength(1)
  })

  check('reports the scoped name of the plugin for an agent that is not there', () => {
    expect(inManifest({ agent: 'p:ghost' }, { 'agents/reviewer.md': REVIEWER })).toHaveLength(1)
  })

  check('reports a name that lacks the subfolder of the agent', () => {
    const files = { 'agents/review/security.md': '---\nname: security\n---\n' }
    expect(inManifest({ agent: 'p:security' }, files)).toHaveLength(1)
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(manifestOf({ agent: 'ghost' }), {}, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['missing'])
  })

  check('reports the manifest agent when the root settings.json has no supported key', () => {
    const files = { 'settings.json': '{"model": "x"}' }
    expect(inManifest({ agent: 'ghost' }, files).map((m) => m.messageId)).toEqual(['missing'])
  })

  check.each([
    ['an empty object', '{}'],
    ['a key of the prototype', '{"constructor": 1}'],
  ])('reports the manifest agent when the root settings.json is %s', (_title, text) => {
    expect(
      inManifest({ agent: 'ghost' }, { 'settings.json': text }).map((m) => m.messageId),
    ).toEqual(['missing'])
  })

  check('reports the last of two agent keys, as JSON.parse reads them', () => {
    const files = { 'agents/reviewer.md': REVIEWER }
    expect(inFile('{"agent": "ghost", "agent": "reviewer"}', files)).toEqual([])
    expect(inFile('{"agent": "reviewer", "agent": "ghost"}', files)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['the name of the file', 'reviewer'],
    ['the name in another case', 'Reviewer'],
    ['the scoped name', 'p:reviewer'],
    ['the scoped name in another case', 'P:REVIEWER'],
    ['the scoped name with the name in another case', 'p:REVIEWER'],
  ])('stays silent for an agent given as %s', (_title, agent) => {
    const files = { 'agents/reviewer.md': REVIEWER }
    expect(inManifest({ agent }, files)).toEqual([])
    expect(inFile(JSON.stringify({ agent }), files)).toEqual([])
  })

  check('stays silent for the name in the frontmatter of an agent', () => {
    const files = { 'agents/x.md': '---\nname: audit\n---\n' }
    expect(inManifest({ agent: 'audit' }, files)).toEqual([])
  })

  check('stays silent for an agent with no frontmatter, which the file name names', () => {
    expect(inManifest({ agent: 'plain' }, { 'agents/plain.md': 'You review.\n' })).toEqual([])
  })

  check('stays silent for an agent in a subfolder, by its name and its scoped name', () => {
    const files = { 'agents/review/security.md': '---\nname: security\n---\n' }
    expect(inManifest({ agent: 'security' }, files)).toEqual([])
    expect(inManifest({ agent: 'p:review:security' }, files)).toEqual([])
  })

  check('uses the directory name for a plugin whose manifest has no name', () => {
    const files = { 'agents/reviewer.md': REVIEWER }
    const found = pluginTree('{"settings": {"agent": "dir:reviewer"}}', files, 'dir/')
    expect(lintPlugin(RULE, found.dir, found.code)).toEqual([])
    const ghost = pluginTree('{"settings": {"agent": "dir:ghost"}}', files, 'dir/')
    expect(lintPlugin(RULE, ghost.dir, ghost.code).map((m) => m.messageId)).toEqual(['missing'])
  })

  check('uses the directory name for a plugin whose manifest name is not a string', () => {
    const files = { 'agents/reviewer.md': REVIEWER }
    const { dir, code } = pluginTree({ name: 5, settings: { agent: 'dir:ghost' } }, files, 'dir/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['missing'])
  })

  check('stays silent for a scoped name whose prefix only starts with the plugin name', () => {
    expect(inManifest({ agent: 'pq:ghost' }, { 'agents/reviewer.md': REVIEWER })).toEqual([])
  })

  check('reports a scoped name when the plugin name has capitals', () => {
    const { dir, code } = pluginTree({ name: 'Foo', settings: { agent: 'foo:ghost' } })
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['missing'])
  })

  check('reports a scoped name whose prefix has another case than the plugin name', () => {
    expect(inManifest({ agent: 'P:ghost' }, { 'agents/reviewer.md': REVIEWER })).toHaveLength(1)
  })

  check.each([
    ['Explore'],
    ['Plan'],
    ['general-purpose'],
    ['claude'],
    ['statusline-setup'],
    ['claude-code-guide'],
    ['explore'],
  ])('stays silent for the built-in agent %s', (agent) => {
    expect(inManifest({ agent })).toEqual([])
    expect(inFile(JSON.stringify({ agent }))).toEqual([])
  })

  check('stays silent for the scoped name of an agent of another plugin', () => {
    expect(inManifest({ agent: 'other:reviewer' })).toEqual([])
  })

  check.each([
    ['an agent that is empty', { agent: '' }],
    ['an agent that is a number', { agent: 3 }],
    ['an agent that is null', { agent: null }],
    ['no agent', { subagentStatusLine: {} }],
    ['settings with no keys', {}],
    ['settings that is a string', 'agent'],
    ['settings that is an array', [{ agent: 'ghost' }]],
    ['settings that is null', null],
  ])('stays silent for %s', (_title, settings) => {
    expect(inManifest(settings)).toEqual([])
    expect(inFile(JSON.stringify(settings))).toEqual([])
  })

  check('stays silent when the manifest sets the agents key, which replaces the scan', () => {
    expect(inManifest({ agent: 'ghost' }, {}, { agents: ['./custom/ghost.md'] })).toEqual([])
    const { dir } = pluginTree({ name: 'p', agents: [] })
    expect(
      lintPluginFile(RULE, GLOBS, path.join(dir, 'settings.json'), '{"agent":"ghost"}'),
    ).toEqual([])
  })

  check('stays silent for the manifest agent when the root settings.json wins', () => {
    const files = { 'settings.json': '{"agent": "reviewer"}', 'agents/reviewer.md': REVIEWER }
    expect(inManifest({ agent: 'ghost' }, files)).toEqual([])
    expect(
      inManifest({ agent: 'ghost' }, { 'settings.json': '{"subagentStatusLine": {}}' }),
    ).toEqual([])
  })

  check('stays silent for a settings.json that is not at the plugin root', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'sub/settings.json': '{"agent": "ghost"}' })
    const file = path.join(dir, 'sub', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"agent": "ghost"}')).toEqual([])
  })

  check('stays silent for a settings.json in a folder that is no plugin', () => {
    const top = tree({ 'settings.json': '{"agent": "ghost"}' })
    const file = path.join(top, 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"agent": "ghost"}')).toEqual([])
  })

  check('stays silent for the settings.json of a project .claude folder', () => {
    const top = tree({ '.claude/settings.json': '{"agent": "ghost"}' })
    const file = path.join(top, '.claude', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"agent": "ghost"}')).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, JSON.stringify(manifestOf({ agent: 'ghost' })))).toEqual([])
  })

  check(
    'stays silent for a settings.json that sits in a plugin with a manifest that does not parse',
    () => {
      const { dir } = pluginTree('{', { 'settings.json': '{"agent": "ghost"}' })
      expect(
        lintPluginFile(RULE, GLOBS, path.join(dir, 'settings.json'), '{"agent": "ghost"}'),
      ).toEqual([])
    },
  )
})

describe(`${RULE} (paths that the rule cannot read)`, () => {
  linked('stays silent for an agents folder that links out of the repository', () => {
    const elsewhere = tree({ 'reviewer.md': REVIEWER }, false)
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }))
    link(top, 'agents', elsewhere)
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for an agents folder that is a link with no target', () => {
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }))
    link(top, 'agents', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check.each([
    ['does not parse', '{'],
    ['is null', 'null'],
    ['is a number', '3'],
    ['is an array', '["agent"]'],
  ])('stays silent for a root settings.json that %s', (_title, text) => {
    expect(inManifest({ agent: 'ghost' }, { 'settings.json': text })).toEqual([])
  })

  linked('stays silent for a root settings.json that is a link with no target', () => {
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }))
    link(top, 'settings.json', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a root settings.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'settings.json': '{"model": "x"}' }, false)
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }))
    link(top, 'settings.json', path.join(elsewhere, 'settings.json'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  describe.skipIf(chmodCannotBlock)('with no access', () => {
    check('stays silent for an agents folder that cannot be listed', () => {
      const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }), {
        'agents/reviewer.md': REVIEWER,
      })
      withoutAccess(path.join(top, 'agents'), () => {
        expect(lintPlugin(RULE, dir, code)).toEqual([])
      })
    })

    check('stays silent for an agent file that cannot be read', () => {
      const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }), {
        'agents/reviewer.md': REVIEWER,
      })
      withoutAccess(path.join(top, 'agents', 'reviewer.md'), () => {
        expect(lintPlugin(RULE, dir, code)).toEqual([])
      })
    })

    check('stays silent for a root settings.json that cannot be read', () => {
      const { dir, code, top } = pluginTree(manifestOf({ agent: 'ghost' }), {
        'settings.json': '{"model": "x"}',
      })
      withoutAccess(path.join(top, 'settings.json'), () => {
        expect(lintPlugin(RULE, dir, code)).toEqual([])
      })
    })
  })
})
