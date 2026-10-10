// The manifest key `skills` adds to the default `skills/` scan (manifest reference, "How each key
// combines with its default location"). An entry that names `skills/` again adds nothing. The rule
// reads the spelling of each entry. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-skills-key-redundant-default'
const check = it

const message = (entry: string) =>
  `The \`skills\` entry "${entry}" names the default \`skills/\` directory. The \`skills\` key adds to the default scan, so Claude Code scans that directory without this entry.`
const run = (skills: unknown) => {
  const { dir, code } = pluginTree({ name: 'p', skills })
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports ./skills, with the full message and the position', () => {
    const found = run('./skills')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'redundant',
      message: message('./skills'),
      line: 1,
      column: 22,
      endLine: 1,
      endColumn: 32,
    })
  })

  check.each([
    ['./skills/', './skills/'],
    ['a path with no ./ prefix', 'skills'],
    ['a path with a repeated slash', './skills//'],
    ['a path that walks back into skills', './extra/../skills'],
  ])('reports %s', (_title, entry) => {
    expect(run(entry).map((m) => m.message)).toEqual([message(entry)])
  })

  check('reports the entry in an array and leaves the others alone', () => {
    const found = run(['./extra-skills', './skills/', '.'])
    expect(found.map((m) => m.message)).toEqual([message('./skills/')])
    expect(found[0]).toMatchObject({ line: 1, column: 40 })
  })

  check('reports each entry that names skills/', () => {
    expect(run(['./skills', './skills/']).map((m) => m.message)).toEqual([
      message('./skills'),
      message('./skills/'),
    ])
  })

  check('reports the last of two skills keys', () => {
    const { dir, code } = pluginTree('{"name": "p", "skills": "./x", "skills": "./skills"}')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([message('./skills')])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree({ name: 'p', skills: './skills' }, {}, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['redundant'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a directory of another name', './extra-skills'],
    ['a directory that starts with skills', './skills-extra'],
    ['one skill folder in skills/', './skills/review'],
    ['the plugin root', '.'],
    ['the plugin root with a slash', './'],
    ['skills in a folder', './plugin/skills'],
    ['a backslash path', '.\\skills'],
    ['a path that leaves the plugin', '../skills'],
    ['an empty path', ''],
  ])('stays silent for %s', (_title, entry) => {
    expect(run(entry)).toEqual([])
  })

  check.each([
    ['no skills key', undefined],
    ['a skills key that is a number', 3],
    ['a skills key that is an object', { a: './skills' }],
    ['a skills key that is null', null],
    ['an array with a non-string entry', [3, { a: './skills' }]],
  ])('stays silent for %s', (_title, skills) => {
    expect(run(skills)).toEqual([])
  })

  check.each([
    ['a path that leaves the plugin and comes back', () => '../p/skills'],
    ['the absolute path of skills/', (dir: string) => path.join(dir, 'skills')],
  ])('stays silent for %s', (_title, entry) => {
    const { dir } = pluginTree({ name: 'p' }, {}, 'plugins/p/')
    const code = JSON.stringify({ name: 'p', skills: entry(dir) })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a skills key in another object', () => {
    const { dir, code } = pluginTree({ name: 'p', metadata: { skills: './skills' } })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, '{"name": "p", "skills": "./skills"}')).toEqual([])
  })
})
