// A plugin that is ready to publish sets `homepage` and `repository` in `plugin.json`, and has a
// `README.md` at the plugin root. The README is a file beside the manifest, so the trees are on
// disk. A plugin in `.claude/skills/` is never published, so the rule skips it. The files glob is
// in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-manifest-publish-metadata'
const check = it
const linked = noLinks ? it.skip : check

const message = (missing: string) =>
  `The plugin is missing ${missing}. Before you release, set \`homepage\` and \`repository\` in \`plugin.json\`, and add a \`README.md\` at the plugin root.`
const FULL = { name: 'p', homepage: 'https://example.com', repository: 'https://example.com/p' }
const README = { 'README.md': '# P\n' }
const run = (manifest: unknown, files: Record<string, string>, at = '') => {
  const { dir, code } = pluginTree(manifest, files, at)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports a missing homepage, with the full message and the position', () => {
    const { dir, code } = pluginTree({ name: 'p', repository: 'https://example.com/p' }, README)
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: message('`homepage`'),
      line: 1,
      column: 1,
    })
  })

  check.each([
    ['homepage', { name: 'p', repository: 'https://example.com/p' }, README, '`homepage`'],
    ['repository', { name: 'p', homepage: 'https://example.com' }, README, '`repository`'],
    ['README.md', FULL, {}, '`README.md`'],
    ['homepage and repository', { name: 'p' }, README, '`homepage` and `repository`'],
    [
      'homepage and README.md',
      { name: 'p', repository: 'https://x.io' },
      {},
      '`homepage` and `README.md`',
    ],
    [
      'repository and README.md',
      { name: 'p', homepage: 'https://x.io' },
      {},
      '`repository` and `README.md`',
    ],
    ['all three', { name: 'p' }, {}, '`homepage`, `repository` and `README.md`'],
  ])('reports a missing %s', (_title, manifest, files, missing) => {
    expect(run(manifest, files)).toEqual([message(missing)])
  })

  check.each([
    ['an empty homepage', { ...FULL, homepage: '' }, '`homepage`'],
    ['a blank homepage', { ...FULL, homepage: '  ' }, '`homepage`'],
    ['an empty repository', { ...FULL, repository: '' }, '`repository`'],
  ])('reports %s', (_title, manifest, missing) => {
    expect(run(manifest, README)).toEqual([message(missing)])
  })

  check('reports a README.md that is a directory', () => {
    expect(run(FULL, { 'README.md/x.md': '# P\n' })).toEqual([message('`README.md`')])
  })

  check('reports a README in a subfolder and a README with another extension', () => {
    expect(run(FULL, { 'docs/README.md': '# P\n', 'README.txt': 'P\n' })).toEqual([
      message('`README.md`'),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    expect(run({ name: 'p' }, {}, 'plugins/p/')).toEqual([
      message('`homepage`, `repository` and `README.md`'),
    ])
  })

  check('reports a plugin in a skills folder that is not `.claude/skills/<name>`', () => {
    expect(run({ name: 'p' }, {}, 'skills/p/')).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check('stays silent for a plugin that has all three', () => {
    expect(run(FULL, README)).toEqual([])
  })

  check.each([
    ['a homepage that is not a string', { ...FULL, homepage: 1 }],
    ['a repository that is an object', { ...FULL, repository: { url: 'x' } }],
    ['a homepage that is null', { ...FULL, homepage: null }],
  ])('stays silent for %s, which is for claude plugin validate', (_title, manifest) => {
    expect(run(manifest, README)).toEqual([])
  })

  check('stays silent for a plugin in .claude/skills/, which is never published', () => {
    expect(run({ name: 'p' }, {}, '.claude/skills/p/')).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, JSON.stringify({ name: 'p' }))).toEqual([])
  })

  linked('stays silent about a README.md that is a link to a file in the repository', () => {
    const { dir, code, top } = pluginTree(FULL, { 'docs/readme.txt': 'P\n' })
    link(top, 'README.md', 'docs/readme.txt')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent about a README.md that is a link with no target', () => {
    const { dir, code, top } = pluginTree(FULL)
    link(top, 'README.md', 'ghost.md')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent about a README.md that is a link out of the repository', () => {
    const elsewhere = tree({ 'README.md': '# P\n' }, false)
    const { dir, code, top } = pluginTree(FULL)
    link(top, 'README.md', path.join(elsewhere, 'README.md'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('still reports a missing homepage when the README.md cannot be seen', () => {
    const { dir, code, top } = pluginTree({ name: 'p', repository: 'https://x.io' })
    link(top, 'README.md', 'ghost.md')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([message('`homepage`')])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ '.claude-plugin/plugin.json': '{"name": "p"}' }, false)
    const top = tree({})
    link(top, 'plugins/p', elsewhere)
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), '{"name": "p"}')).toEqual([])
  })
})
