// A skills directory that the `skills` key of a manifest names holds one folder
// for each skill, with a `SKILL.md` in it. A loose `.md` file in it is not a
// skill. The shipped rule `skill-file-layout` reports the loose files of the
// default `skills/` directory, so this rule skips that directory. The trees are
// on disk, because the rule lists the directory. The files glob is in
// tests/configs.test.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, lintMarkdown, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-skill-dir-layout'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const SKILL = '---\nname: s\ndescription: d\n---\n'
const message = (file: string, dir: string, stem = path.basename(file, '.md')) =>
  `\`${file}\` is a loose file in the skills directory \`${dir}\`. Claude Code does not find it. Move it to \`${stem}/SKILL.md\`.`
const withSkills = (skills: unknown, files: Record<string, string>) =>
  pluginTree({ name: 'p', skills }, files)
const run = (skills: unknown, files: Record<string, string>) => {
  const { dir, code } = withSkills(skills, files)
  return lint(dir, code)
}

describe(RULE, () => {
  check('reports a loose file, on the path string, with the full message', () => {
    const { dir, code } = withSkills('./extra', { 'extra/loose.md': '# Loose\n' })
    const messages = lint(dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'loose',
      message: message('loose.md', './extra'),
      line: 1,
      column: 22,
      endColumn: 31,
    })
  })

  check('reports a loose file next to skill folders', () => {
    const messages = run(['./extra'], {
      'extra/a/SKILL.md': SKILL,
      'extra/notes.md': '# Notes\n',
    })
    expect(messages.map((m) => m.message)).toEqual([message('notes.md', './extra')])
  })

  check('reports each loose file, in name order, and each directory on its own', () => {
    const messages = run(['./one', './two/'], {
      'one/b.md': '# B\n',
      'one/a.md': '# A\n',
      'one/ok/SKILL.md': SKILL,
      'two/c.md': '# C\n',
    })
    expect(messages.map((m) => m.message)).toEqual([
      message('a.md', './one'),
      message('b.md', './one'),
      message('c.md', './two/'),
    ])
  })

  check.each([
    ['a directory below the default skills/', './skills/team'],
    ['a directory named skills below another directory', './extra/skills'],
    ['a path with a trailing slash', './extra/'],
    ['a path in normal form', './extra/./'],
    ['a path with no ./ prefix', 'extra'],
  ])('reports for %s', (_title, entry) => {
    const messages = run([entry], {
      'skills/team/loose.md': '# L\n',
      'extra/loose.md': '# L\n',
      'extra/skills/loose.md': '# L\n',
    })
    expect(messages.map((m) => m.message)).toEqual([message('loose.md', entry)])
  })

  check('reports when the key is the last of two', () => {
    const { dir } = withSkills(['./extra'], { 'extra/loose.md': '# L\n' })
    const code = '{"name": "p", "skills": [], "skills": ["./extra"]}'
    expect(lint(dir, code)).toHaveLength(1)
  })

  check('reports a loose file after strings that the rule cannot read', () => {
    const messages = run([3, null, { a: 1 }, './extra'], { 'extra/loose.md': '# L\n' })
    expect(messages).toHaveLength(1)
  })

  linked('reports a directory that is a link inside the plugin', () => {
    const { dir, code, top } = withSkills('./alias', { 'store/loose.md': '# L\n' })
    link(top, 'alias', 'store')
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('loose.md', './alias')])
  })

  linked('reports a loose file that is a link to a file inside the plugin', () => {
    const { dir, code, top } = withSkills('./extra', { 'notes/n.md': '# N\n' })
    link(top, 'extra/n.md', '../notes/n.md')
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('n.md', './extra')])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p', skills: ['./extra'] },
      { 'extra/loose.md': '# L\n' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([['./skills'], ['./skills/'], ['./skills/./'], ['./extra/../skills'], ['skills']])(
    'leaves the default directory %s to skill-file-layout',
    (entry) => {
      const { dir, code } = withSkills([entry], { 'skills/loose.md': '# Loose\n' })
      expect(lint(dir, code)).toEqual([])
      // The shipped rule reports the same file, so a second report would be a duplicate.
      const shipped = lintMarkdown(
        'skill-file-layout',
        '# Loose\n',
        path.join(dir, 'skills', 'loose.md'),
      )
      expect(shipped.map((m) => m.messageId)).toEqual(['loose'])
    },
  )

  linked('leaves a skills directory that is a link to skill-file-layout', () => {
    const { dir, code, top } = withSkills('./skills', { 'store/loose.md': '# L\n' })
    link(top, 'skills', 'store')
    expect(lint(dir, code)).toEqual([])
  })

  check.each([['.'], ['./']])('stays silent for the plugin root as %s', (entry) => {
    expect(run([entry], { 'loose.md': '# L\n', 'README.md': '# R\n' })).toEqual([])
  })

  check('stays silent for a folder that holds a SKILL.md itself', () => {
    const messages = run('./one-skill', {
      'one-skill/SKILL.md': SKILL,
      'one-skill/reference.md': '# Reference\n',
    })
    expect(messages).toEqual([])
  })

  check('stays silent for a README, files that are no Markdown, and folders', () => {
    const messages = run('./extra', {
      'extra/README.md': '# R\n',
      'extra/readme.md': '# R\n',
      'extra/notes.txt': 'x',
      'extra/notes.md.bak': 'x',
      'extra/dir.md/SKILL.md': SKILL,
      'extra/a/SKILL.md': SKILL,
    })
    expect(messages).toEqual([])
  })

  check.each([
    ['no skills key', { name: 'p' }],
    ['skills as null', { name: 'p', skills: null }],
    ['skills as a number', { name: 'p', skills: 3 }],
    ['skills as an object', { name: 'p', skills: { a: './extra' } }],
    ['skills as an empty array', { name: 'p', skills: [] }],
    ['elements that are no strings', { name: 'p', skills: [3, null, ['./extra']] }],
    ['a different spelling of the key', { name: 'p', Skills: ['./extra'] }],
  ])('stays silent for %s', (_title, manifest) => {
    const { dir, code } = pluginTree(manifest, { 'extra/loose.md': '# L\n' })
    expect(lint(dir, code)).toEqual([])
  })

  check('stays silent for a path that is not on disk, and for a file', () => {
    expect(run(['./ghost', './file.md'], { 'file.md': '# F\n' })).toEqual([])
  })

  check('stays silent for the last of two keys that lists nothing', () => {
    const { dir } = withSkills(['./extra'], { 'extra/loose.md': '# L\n' })
    expect(lint(dir, '{"skills": ["./extra"], "skills": []}')).toEqual([])
  })

  check('stays silent for a path out of the plugin, also when it holds a loose file', () => {
    const { dir, code, top } = pluginTree(
      { name: 'p', skills: ['../shared', './a/../../shared'] },
      {},
      'plugins/p/',
    )
    mkdirSync(path.join(top, 'plugins', 'shared'), { recursive: true })
    writeFileSync(path.join(top, 'plugins', 'shared', 'loose.md'), '# L\n')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a link that leaves the plugin and stays in the repository', () => {
    const { dir, code, top } = pluginTree({ name: 'p', skills: './alias' }, {}, 'plugins/p/')
    mkdirSync(path.join(top, 'shared'), { recursive: true })
    writeFileSync(path.join(top, 'shared', 'loose.md'), '# L\n')
    link(dir, 'alias', '../../shared')
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a link out of the repository', () => {
    const outside = tree({ 'loose.md': '# L\n' })
    const { dir, code } = withSkills('./alias', {})
    link(dir, 'alias', outside)
    expect(lint(dir, code)).toEqual([])
  })

  linked('stays silent for a dangling link', () => {
    const { dir, code } = withSkills('./alias', {})
    link(dir, 'alias', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ 'extra/loose.md': '# L\n' })
    expect(lint(top, '{"name": "p", "skills": ["./extra"]}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, { 'extra/loose.md': '# L\n' })
    expect(lint(dir, '{"name": "p", "skills": ["./extra"]}')).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const outside = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree({ 'extra/loose.md': '# L\n' })
    link(top, '.claude-plugin', path.join(outside, 'p'))
    expect(lint(top, '{"name": "p", "skills": ["./extra"]}')).toEqual([])
  })

  locked('makes no report for a skills directory that it cannot list', () => {
    const { dir, code } = withSkills('./extra', { 'extra/loose.md': '# L\n' })
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, 'extra'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
