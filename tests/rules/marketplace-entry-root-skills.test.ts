// The rule reports the skill directories under `skills/` that an entry omits,
// when the source of the entry is the marketplace root and the entry lists
// `skills`. The directories are on disk, because the rule reads them. The files
// glob and the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'marketplace-entry-root-skills'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const SKILL = '---\nname: s\ndescription: d\n---\n'
const SKILLS = {
  'skills/a/SKILL.md': SKILL,
  'skills/b/SKILL.md': SKILL,
  'skills/c/SKILL.md': SKILL,
}
const entry = (fields: Record<string, unknown>, source: unknown = '.') =>
  marketplaceOf([{ name: 'p', source, ...fields }])
const message = (names: string) =>
  `The entry lists "skills" and its source is the marketplace root, so Claude Code loads the listed skills only. It does not load these skills under skills/: ${names}. List each skill, or list "./skills".`

describe(RULE, () => {
  it('reports the omitted skills, on the member, with the full message', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": ".", "skills": ["./skills/a"] }
  ]
}`
    const messages = lint(tree(SKILLS), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'omitted',
      message: message('"b", "c"'),
      line: 4,
      column: 35,
      endColumn: 59,
    })
  })

  it.each([
    ['a string', './skills/a', '"b", "c"'],
    ['a string with a trailing slash', './skills/a/', '"b", "c"'],
    ['an array', ['./skills/b', './skills/c'], '"a"'],
    ['a path that needs normal form', ['./skills/./a', './skills//b/'], '"c"'],
    ['paths out of skills/', ['./extra/x'], '"a", "b", "c"'],
    ['a path below a skill', ['./skills/a/sub'], '"a", "b", "c"'],
    ['paths with a sibling name', ['./skills-extra', './skills/a'], '"b", "c"'],
  ])('reports with the skills as %s', (_title, skills, names) => {
    const messages = lint(tree(SKILLS), entry({ skills }))
    expect(messages.map((m) => m.message)).toEqual([message(names)])
  })

  it.each([
    ['"."', '.'],
    ['"./"', './'],
  ])('reports for the source %s', (_title, source) => {
    expect(lint(tree(SKILLS), entry({ skills: ['./skills/a'] }, source))).toHaveLength(1)
  })

  it('reports with a plugin.json at the marketplace root, and with none', () => {
    const withManifest = tree({
      ...SKILLS,
      '.claude-plugin/plugin.json': manifestOf({ name: 'r' }),
    })
    expect(lint(withManifest, entry({ skills: ['./skills/a'] }))).toHaveLength(1)
    expect(lint(tree(SKILLS), entry({ skills: ['./skills/a'] }))).toHaveLength(1)
  })

  it('reports for a plugin.json at the root that lists skills too, because the entry lists them', () => {
    const dir = tree({
      ...SKILLS,
      '.claude-plugin/plugin.json': manifestOf({ name: 'r', skills: ['./skills/'] }),
    })
    expect(lint(dir, entry({ skills: ['./skills/a'] }))).toHaveLength(1)
  })

  it('names a skill directory only when it holds a SKILL.md', () => {
    const dir = tree({
      'skills/a/SKILL.md': SKILL,
      'skills/empty/x.md': 'x',
      'skills/loose.md': 'x',
      'skills/nested/deeper/SKILL.md': SKILL,
    })
    expect(lint(dir, entry({ skills: ['./skills/a'] }))).toEqual([])
    const more = tree({ ...SKILLS, 'skills/empty/x.md': 'x', 'skills/loose.md': 'x' })
    const messages = lint(more, entry({ skills: ['./skills/a'] }))
    expect(messages.map((m) => m.message)).toEqual([message('"b", "c"')])
  })

  it('reports each entry on its own', () => {
    const dir = tree({ ...SKILLS, 'plugins/p/skills/z/SKILL.md': SKILL })
    const code = marketplaceOf([
      { name: 'p', source: '.', skills: ['./skills/a'] },
      { name: 'q', source: './plugins/p', skills: ['./skills/q'] },
      { name: 'r', source: '.', skills: ['./skills'] },
      { name: 's', source: '.', skills: ['./skills/b', './skills/c'] },
    ])
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('"b", "c"'), message('"a"')])
  })

  it('reads the last of two skills keys, as JSON.parse does', () => {
    const open = '{"plugins": [{"source": ".", '
    const twice = `${open}"skills": ["./skills"], "skills": ["./skills/a"]}]}`
    expect(lint(tree(SKILLS), twice)).toHaveLength(1)
    const reverse = `${open}"skills": ["./skills/a"], "skills": ["./skills"]}]}`
    expect(lint(tree(SKILLS), reverse)).toEqual([])
  })

  it.skipIf(noLinks)('reports a source that is a link to the marketplace root', () => {
    const dir = tree(SKILLS)
    link(dir, 'self', '.')
    expect(lint(dir, entry({ skills: ['./skills/a'] }, './self'))).toHaveLength(1)
  })

  it.skipIf(noLinks)('counts a skill folder that is a link inside the marketplace root', () => {
    const dir = tree({ ...SKILLS, 'shared/z/SKILL.md': SKILL })
    link(dir, 'skills/z', '../shared/z')
    const messages = lint(dir, entry({ skills: ['./skills/a'] }))
    expect(messages.map((m) => m.message)).toEqual([message('"b", "c", "z"')])
  })

  it.skipIf(noLinks)('reads a skills directory that is a link inside the marketplace root', () => {
    const dir = tree({ 'store/a/SKILL.md': SKILL, 'store/b/SKILL.md': SKILL })
    link(dir, 'skills', 'store')
    const messages = lint(dir, entry({ skills: ['./skills/a'] }))
    expect(messages.map((m) => m.message)).toEqual([message('"b"')])
  })

  it('reports in a tree with no .git', () => {
    expect(lint(tree(SKILLS, false), entry({ skills: ['./skills/a'] }))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['the default directory', ['./skills']],
    ['the default directory with a slash', ['./skills/']],
    ['the default directory as a string', './skills'],
    ['the plugin root', ['.']],
    ['the plugin root with a slash', './'],
    ['the default directory beside a skill', ['./skills/a', './skills']],
    ['every skill', ['./skills/a', './skills/b', './skills/c']],
    ['every skill in normal form variants', ['./skills/a/', './skills/./b', './skills//c']],
  ])('stays silent when the entry lists %s', (_title, skills) => {
    expect(lint(tree(SKILLS), entry({ skills }))).toEqual([])
  })

  it.each([
    ['no skills key', {}],
    ['skills as null', { skills: null }],
    ['skills as a number', { skills: 3 }],
    ['skills as an object', { skills: { a: './skills/a' } }],
    ['skills as an empty array', { skills: [] }],
    ['skills as an empty string', { skills: '' }],
    ['an element that is not a string', { skills: ['./skills/a', 3] }],
    ['an element that is an empty string', { skills: ['./skills/a', ''] }],
    ['a path with no ./ prefix', { skills: ['skills/a'] }],
    ['an absolute path', { skills: ['/skills/a'] }],
    ['a path with ..', { skills: ['./skills/a', './skills/../skills/b'] }],
    ['a path with a backslash', { skills: ['./skills\\a'] }],
    ['a network path', { skills: ['//skills/a'] }],
    ['a different spelling of the key', { Skills: ['./skills/a'] }],
  ])('stays silent for %s', (_title, fields) => {
    expect(lint(tree(SKILLS), entry(fields))).toEqual([])
  })

  it('stays silent for a source that is not the marketplace root', () => {
    const dir = tree({
      ...SKILLS,
      'plugins/p/skills/z/SKILL.md': SKILL,
      'plugins/p/skills/y/SKILL.md': SKILL,
    })
    const skills = ['./skills/a']
    expect(lint(dir, entry({ skills }, './plugins/p'))).toEqual([])
    const bare = marketplaceOf([{ name: 'p', source: 'p', skills }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, bare)).toEqual([])
    const root = marketplaceOf([{ name: 'p', source: 'plugins', skills }], {
      metadata: { pluginRoot: '.' },
    })
    expect(lint(dir, root)).toEqual([])
  })

  it('stays silent when skills/ is not there, is empty, or is a file', () => {
    const skills = ['./skills/a']
    expect(lint(tree({}), entry({ skills }))).toEqual([])
    expect(lint(tree({ 'skills/.keep': '' }), entry({ skills }))).toEqual([])
    expect(lint(tree({ skills: 'a file' }), entry({ skills }))).toEqual([])
  })

  it.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/'],
    ['a source with ..', './plugins/..'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(tree(SKILLS), entry({ skills: ['./skills/a'] }, source))).toEqual([])
  })

  it('stays silent for a manifest that the rule cannot read', () => {
    const skills = ['./skills/a']
    const bad = (text: string) => tree({ ...SKILLS, '.claude-plugin/plugin.json': text })
    expect(lint(bad('{'), entry({ skills }))).toEqual([])
    expect(lint(bad('[]'), entry({ skills }))).toEqual([])
  })

  it('stays silent for an entry that is not an object', () => {
    expect(lint(tree(SKILLS), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a skills directory that is a link out of the marketplace root',
    () => {
      const repo = tree({ 'shared/skills/x/SKILL.md': SKILL, 'shared/skills/y/SKILL.md': SKILL })
      const dir = path.join(repo, 'site')
      link(dir, 'skills', '../shared/skills')
      expect(lint(dir, entry({ skills: ['./skills/x'] }))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'stays silent for a skills directory out of the marketplace root, even when its folders link back in',
    () => {
      const repo = tree({ 'site/real/a/SKILL.md': SKILL, 'site/real/b/SKILL.md': SKILL })
      const dir = path.join(repo, 'site')
      link(repo, 'shared/skills/a', '../../site/real/a')
      link(repo, 'shared/skills/b', '../../site/real/b')
      link(dir, 'skills', '../shared/skills')
      expect(lint(dir, entry({ skills: ['./skills/a'] }))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'stays silent for a skills directory that is a link out of the repository',
    () => {
      const outside = tree({ 'x/SKILL.md': SKILL, 'y/SKILL.md': SKILL })
      const dir = tree({})
      link(dir, 'skills', outside)
      expect(lint(dir, entry({ skills: ['./skills/x'] }))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'stays silent for a skills directory that is a dangling link, or a loop',
    () => {
      const dir = tree({})
      link(dir, 'skills', 'gone')
      expect(lint(dir, entry({ skills: ['./skills/x'] }))).toEqual([])
      const looped = tree({})
      link(looped, 'skills', 'skills')
      expect(lint(looped, entry({ skills: ['./skills/x'] }))).toEqual([])
    },
  )

  it.skipIf(noLinks)(
    'names no skill folder that is a link out of the root, out of the repository, or dangling',
    () => {
      const repo = tree({ 'shared/y/SKILL.md': SKILL, 'site/skills/a/SKILL.md': SKILL })
      const outside = tree({ 'z/SKILL.md': SKILL })
      const dir = path.join(repo, 'site')
      link(dir, 'skills/y', '../../shared/y')
      link(dir, 'skills/z', path.join(outside, 'z'))
      link(dir, 'skills/dead', 'gone')
      link(dir, 'skills/x/SKILL.md', 'gone.md')
      expect(lint(dir, entry({ skills: ['./skills/a'] }))).toEqual([])
    },
  )

  it.skipIf(noLinks)('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree(
      { 'shared/skills/x/SKILL.md': SKILL, 'shared/skills/y/SKILL.md': SKILL },
      false,
    )
    const dir = path.join(top, 'site')
    link(dir, 'skills', '../shared/skills')
    expect(lint(dir, entry({ skills: ['./skills/x'] }))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)(
    'stays silent for a skills directory that the rule cannot read',
    () => {
      const dir = tree(SKILLS)
      withoutAccess(path.join(dir, 'skills'), () => {
        expect(lint(dir, entry({ skills: ['./skills/a'] }))).toEqual([])
      })
    },
  )

  it.skipIf(chmodCannotBlock)('names no skill folder that the rule cannot read', () => {
    const dir = tree(SKILLS)
    withoutAccess(path.join(dir, 'skills', 'b'), () => {
      const messages = lint(dir, entry({ skills: ['./skills/a'] }))
      expect(messages.map((m) => m.message)).toEqual([message('"c"')])
    })
  })
})
