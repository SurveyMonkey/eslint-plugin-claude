// In one scope (a `.claude/` directory or a plugin), each skill and command
// file has its own command name. The trees are on disk under
// tests/fixtures/skill-name-unique/, one tree for each case. The names that
// differ only by case, spacing, invisible characters, fullwidth letters and
// dash variants are built at run time, because a committed file would hide
// the characters.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-name-unique')
const at = (...parts: string[]) => path.join(fixtures, ...parts)
const skillAt = (tree: string, folder: string, ...above: string[]) =>
  at(tree, ...above, '.claude', 'skills', folder, 'SKILL.md')
const named = (value: string) => `---\nname: ${value}\n---\n\n# Skill\n`
const bare = '# Skill\n'
// A quoted YAML string. The line separators are escapes, because YAML reads a raw one as a line break.
const quote = (value: string) =>
  JSON.stringify(value).replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`)

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-name-unique-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

// Two names that the rule treats as one, and two that it keeps apart.
const SAME: [string, string, string][] = [
  ['case', 'Deploy', 'deploy'],
  ['case', 'DEPLOY', 'dEpLoY'],
  ['spacing', 'my deploy', 'mydeploy'],
  ['spacing', 'deploy\u{a0}', 'deploy'],
  ['spacing', 'dep\u{3000}loy', 'deploy'],
  ['spacing', 'dep\tloy', 'deploy'],
  ['spacing', 'dep\u{2028}loy', 'deploy'],
  ['spacing', 'dep\u{2029}loy', 'deploy'],
  ['spacing, twice', 'a b c', 'abc'],
  ['invisible, twice', 'd\u{200b}e\u{200b}ploy', 'deploy'],
  ['dash, twice', 'a\u{2010}b\u{2010}c', 'a-b-c'],
  ['invisible', 'dep\u{200b}loy', 'deploy'],
  ['invisible', '\u{ad}deploy', 'deploy'],
  ['invisible', '\u{feff}deploy', 'deploy'],
  ['invisible', 'dep\u{200d}loy', 'deploy'],
  ['fullwidth', '\u{ff44}\u{ff45}\u{ff50}\u{ff4c}\u{ff4f}\u{ff59}', 'deploy'],
  ['fullwidth', '\u{ff24}\u{ff25}\u{ff30}\u{ff2c}\u{ff2f}\u{ff39}', 'deploy'],
  ['compatibility form', '\u{fb01}le', 'file'],
  ['dash', 'my\u{2010}app', 'my-app'],
  ['dash', 'my\u{2011}app', 'my-app'],
  ['dash', 'my\u{2012}app', 'my-app'],
  ['dash', 'my\u{2015}app', 'my-app'],
  ['dash', 'my\u{2013}app', 'my-app'],
  ['dash', 'my\u{2014}app', 'my-app'],
  ['dash', 'my\u{2212}app', 'my-app'],
  ['dash', 'my\u{ff0d}app', 'my-app'],
  ['dash', 'my\u{fe63}app', 'my-app'],
]
const DIFFERENT: [string, string][] = [
  ['d\u{435}ploy', 'deploy'], // a Cyrillic letter looks like a Latin letter
  ['my_app', 'my-app'],
  ['deploy2', 'deploy'],
  ['deploy', 'deploys'],
]
put('three/.claude/commands/t.md', bare)
// The `commands` key of a plugin is read instead of `commands/`.
put('ckey/.claude-plugin/plugin.json', '{"name":"c","commands":"./cmds"}')
put('ckey/commands/review.md', bare)
put('ckey/skills/review/SKILL.md', bare)
// A key that is an alias has a value, and no key node to report on.
const alias = '---\nx: &k name\n*k : build\n---\n\n# Skill\n'
put('alias/.claude/skills/a/SKILL.md', alias)
put('alias/.claude/skills/b/SKILL.md', named('build'))
put('three/.claude/skills/u/SKILL.md', named('t'))
// A link to a file that is not there is not a command.
put('dead/.claude/skills/x/SKILL.md', named('x'))
mkdirSync(path.join(scratch, 'dead/.claude/commands'), { recursive: true })
symlinkSync('missing.md', path.join(scratch, 'dead/.claude/commands/x.md'))
// A link that sorts before the directory that it names. The real path gives the command name.
put('twin/.claude/commands/real/deploy.md', bare)
symlinkSync('real', path.join(scratch, 'twin/.claude/commands/a-link'))
put('twin/.claude/skills/s/SKILL.md', named('real:deploy'))
// No `.git`: the project directory is the bound, so a link from `.claude/` to a
// directory beside it is followed.
put('nogit/shared/deploy.md', bare)
put('nogit/.claude/skills/s/SKILL.md', named('shared:deploy'))
mkdirSync(path.join(scratch, 'nogit/.claude/commands'), { recursive: true })
symlinkSync('../../shared', path.join(scratch, 'nogit/.claude/commands/shared'))
const pair = (index: number, first: string, second: string) => {
  const tree = `fold-${index}`
  const file = (folder: string, value: string) =>
    put(`${tree}/.claude/skills/${folder}/SKILL.md`, named(quote(value)))
  return {
    code: named(quote(first)),
    filename: file('a', first),
    other: file('b', second),
    tree,
  }
}

const sameCases = SAME.map(([, first, second], index) => {
  const { code, filename } = pair(index, first, second)
  return {
    code,
    filename,
    errors: [
      {
        messageId: 'duplicate' as const,
        data: { name: first, others: '`skills/b/SKILL.md`' },
        line: 2,
      },
    ],
  }
})
const differentCases = DIFFERENT.map(([first, second], index) => {
  const { code, filename } = pair(100 + index, first, second)
  return { code, filename }
})

markdownTester.run('skill-name-unique', ruleOf('skill-name-unique'), {
  valid: [
    // One skill in the scope, with a supporting file beside it (not a skill).
    // A name that no other file has.
    { code: bare, filename: skillAt('single', 'only') },
    ...differentCases,
    // Two scopes may share a name: nested `.claude/` directories, two plugins, a plugin and the project.
    { code: bare, filename: skillAt('scopes', 'deploy') },
    { code: bare, filename: skillAt('scopes', 'deploy', 'packages', 'web') },
    { code: bare, filename: at('scopes', 'plugin-a', 'skills', 'deploy', 'SKILL.md') },
    { code: bare, filename: at('scopes', 'plugin-b', 'skills', 'deploy', 'SKILL.md') },
    // A command file takes its name from its path. Its `name` field is not read.
    { code: named('other'), filename: at('cmd-name', '.claude', 'commands', 'c.md') },
    { code: bare, filename: skillAt('cmd-name', 'other') },
    // A folder below a skill folder is not a skill.
    { code: bare, filename: skillAt('nested', 'a') },
    // A plugin that sets `commands` does not load `commands/`, so nothing collides.
    { code: bare, filename: path.join(scratch, 'ckey', 'skills', 'review', 'SKILL.md') },
    { code: bare, filename: path.join(scratch, 'ckey', 'commands', 'review.md') },
    // The plugin-root skill has no name from a folder or a path.
    { code: named('review'), filename: at('plugin', 'SKILL.md') },
    {
      code: named('x'),
      filename: path.join(scratch, 'dead', '.claude', 'skills', 'x', 'SKILL.md'),
    },
    // The frontmatter of this file does not parse, so the rule reads nothing from it.
    { code: '---\nname: [unclosed\n---\n', filename: skillAt('bad-sibling', 'dup') },
    // Not a skill or command file.
    { code: named('build'), filename: at('dup-name', 'docs', 'SKILL.md') },
    { code: named('build'), filename: at('dup-name', '.claude', 'agents', 'build.md') },
  ],
  invalid: [
    {
      code: named('shared:deploy'),
      filename: path.join(scratch, 'nogit', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'duplicate' }],
    },
    {
      code: named('real:deploy'),
      filename: path.join(scratch, 'twin', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'real:deploy', others: '`commands/real/deploy.md`' },
        },
      ],
    },
    // A key that is an alias: the report falls back to line 1.
    {
      code: alias,
      filename: path.join(scratch, 'alias', '.claude', 'skills', 'a', 'SKILL.md'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'build', others: '`skills/b/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    // A shared `name`.
    {
      code: named('build'),
      filename: skillAt('dup-name', 'a'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'build', others: '`skills/b/SKILL.md`' },
          line: 2,
          column: 7,
          endLine: 2,
          endColumn: 12,
        },
      ],
    },
    {
      code: named('build'),
      filename: skillAt('dup-name', 'b'),
      errors: [
        { messageId: 'duplicate', data: { name: 'build', others: '`skills/a/SKILL.md`' }, line: 2 },
      ],
    },
    // A `name` and a folder name.
    {
      code: bare,
      filename: skillAt('name-vs-folder', 'deploy'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/ship/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    {
      code: named('deploy'),
      filename: skillAt('name-vs-folder', 'ship'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/deploy/SKILL.md`' },
          line: 2,
        },
      ],
    },
    // A skill and a command file: the command never runs.
    {
      code: bare,
      filename: skillAt('skill-vs-command', 'deploy'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`commands/deploy.md`' },
          line: 1,
        },
      ],
    },
    {
      code: '# Deploy command\n',
      filename: at('skill-vs-command', '.claude', 'commands', 'deploy.md'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/deploy/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    // The `name` of a command file is not read, so the report stays on line 1.
    {
      code: '---\nname: other\n---\n\n# Deploy command\n',
      filename: at('cmd-with-name', '.claude', 'commands', 'deploy.md'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/deploy/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    // The path of a command file, with `/` as `:`.
    {
      code: '# Deploy command\n',
      filename: at('command-path', '.claude', 'commands', 'ops', 'deploy.md'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'ops:deploy', others: '`skills/x/SKILL.md`' },
        },
      ],
    },
    {
      code: named('ops:deploy'),
      filename: skillAt('command-path', 'x'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'ops:deploy', others: '`commands/ops/deploy.md`' },
          line: 2,
        },
      ],
    },
    // In a plugin, the skills and the commands share the scope.
    {
      code: bare,
      filename: at('plugin', 'skills', 'review', 'SKILL.md'),
      errors: [
        { messageId: 'duplicate', data: { name: 'review', others: '`commands/review.md`' } },
      ],
    },
    {
      code: '# Review command\n',
      filename: at('plugin', 'commands', 'review.md'),
      errors: [
        { messageId: 'duplicate', data: { name: 'review', others: '`skills/review/SKILL.md`' } },
      ],
    },
    // A `name` that is not a string, or is empty, gives way to the folder name.
    {
      code: named('3'),
      filename: skillAt('fallback', 'num'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'num', others: '`skills/other/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    {
      code: named('num'),
      filename: skillAt('fallback', 'other'),
      errors: [
        { messageId: 'duplicate', data: { name: 'num', others: '`skills/num/SKILL.md`' }, line: 2 },
      ],
    },
    {
      code: '---\nname: ""\n---\n',
      filename: skillAt('fallback', 'blank'),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'blank', others: '`skills/z/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    {
      code: named('blank'),
      filename: skillAt('fallback', 'z'),
      errors: [
        { messageId: 'duplicate', data: { name: 'blank', others: '`skills/blank/SKILL.md`' } },
      ],
    },
    // A skill whose frontmatter does not parse still has its folder name.
    {
      code: named('dup'),
      filename: skillAt('bad-sibling', 'x'),
      errors: [{ messageId: 'duplicate', data: { name: 'dup', others: '`skills/dup/SKILL.md`' } }],
    },
    // Each folding of the names.
    ...sameCases,
    // Three files share a name. The report names the other two.
    {
      code: bare,
      filename: put('three/.claude/skills/t/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 't', others: '`skills/u/SKILL.md`, `commands/t.md`' },
        },
      ],
    },
  ],
})

// A read that fails with `EACCES` is not a missing file. The rule compares no name that
// it cannot read, so it makes no report that rests on one.
describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)

  it('does not compare a skill file that it cannot read', () => {
    // The folder name is `dup`, and the file may set another name.
    const hidden = put('deny-skill/.claude/skills/dup/SKILL.md', named('other'))
    const file = path.join(scratch, 'deny-skill', '.claude', 'skills', 'mine', 'SKILL.md')
    withoutAccess(hidden, () => expect(lint(file, named('dup'))).toEqual([]))
    // The file is readable again, and has the name `other`, so `dup` is free.
    expect(lint(file, named('dup'))).toEqual([])
    // A file that is readable and has the same name is still a duplicate.
    expect(lint(file, named('other'))).toHaveLength(1)
  })

  it('does not compare a skill folder or a skills directory that it cannot read', () => {
    put('deny-folder/.claude/skills/dup/SKILL.md', bare)
    const file = path.join(scratch, 'deny-folder', '.claude', 'skills', 'mine', 'SKILL.md')
    expect(lint(file, named('dup'))).toHaveLength(1)
    withoutAccess(path.join(scratch, 'deny-folder/.claude/skills/dup'), () =>
      expect(lint(file, named('dup'))).toEqual([]),
    )
    withoutAccess(path.join(scratch, 'deny-folder/.claude/skills'), () =>
      expect(lint(file, named('dup'))).toEqual([]),
    )
  })

  it('does not compare a commands directory that it cannot read', () => {
    put('deny-commands/.claude/commands/dup.md', bare)
    const file = path.join(scratch, 'deny-commands', '.claude', 'skills', 'mine', 'SKILL.md')
    expect(lint(file, named('dup'))).toHaveLength(1)
    withoutAccess(path.join(scratch, 'deny-commands/.claude/commands'), () =>
      expect(lint(file, named('dup'))).toEqual([]),
    )
  })

  it('reads no commands/ folder when it cannot read the manifest', () => {
    const manifest = put('deny-manifest/.claude-plugin/plugin.json', '{"commands":"./cmds"}')
    put('deny-manifest/commands/review.md', bare)
    const skill = path.join(scratch, 'deny-manifest', 'skills', 'review', 'SKILL.md')
    const command = path.join(scratch, 'deny-manifest', 'commands', 'review.md')
    put('deny-manifest/skills/review/SKILL.md', bare)
    // The key replaces `commands/`, so the folder is not a command source.
    expect(lint(skill, bare)).toEqual([])
    withoutAccess(manifest, () => {
      expect(lint(skill, bare)).toEqual([])
      expect(lint(command, bare)).toEqual([])
    })
    withoutAccess(path.dirname(manifest), () => {
      expect(lint(skill, bare)).toEqual([])
      expect(lint(command, bare)).toEqual([])
    })
  })

  it.skipIf(process.platform === 'win32')(
    'reads no commands/ folder when plugin.json is a link out of the repository',
    () => {
      put('man-link/.git/HEAD', '')
      put('man-link/commands/review.md', bare)
      put('man-link/skills/review/SKILL.md', bare)
      put('man-link-target/plugin.json', '{"commands":"./cmds"}')
      mkdirSync(path.join(scratch, 'man-link/.claude-plugin'), { recursive: true })
      symlinkSync(
        '../../man-link-target/plugin.json',
        path.join(scratch, 'man-link/.claude-plugin/plugin.json'),
      )
      const skill = path.join(scratch, 'man-link', 'skills', 'review', 'SKILL.md')
      const command = path.join(scratch, 'man-link', 'commands', 'review.md')
      expect(lint(skill, bare)).toEqual([])
      expect(lint(command, bare)).toEqual([])
    },
  )

  it('reports a command file that the rule cannot read, because the path gives its name', () => {
    const hidden = put('deny-command/.claude/commands/dup.md', bare)
    const file = path.join(scratch, 'deny-command', '.claude', 'skills', 'mine', 'SKILL.md')
    withoutAccess(hidden, () => expect(lint(file, named('dup'))).toHaveLength(1))
  })
})

// The rule cannot read the manifest behind a dangling link, and that manifest can set `commands`.
describe.skipIf(process.platform === 'win32')('a plugin.json that is a dangling link', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)

  it('reads no commands/ folder', () => {
    put('dangling/commands/review.md', bare)
    put('dangling/skills/review/SKILL.md', bare)
    mkdirSync(path.join(scratch, 'dangling/.claude-plugin'), { recursive: true })
    const manifest = path.join(scratch, 'dangling/.claude-plugin/plugin.json')
    symlinkSync('missing.json', manifest)
    const skill = path.join(scratch, 'dangling', 'skills', 'review', 'SKILL.md')
    const command = path.join(scratch, 'dangling', 'commands', 'review.md')
    expect(lint(skill, bare)).toEqual([])
    expect(lint(command, bare)).toEqual([])
    // With a readable manifest that has no `commands` key, the same tree reports the clash.
    rmSync(manifest)
    writeFileSync(manifest, '{}')
    expect(lint(skill, bare)).toHaveLength(1)
    expect(lint(command, bare)).toHaveLength(1)
  })
})

// A manifest that does not parse can hold a `commands` key, so the rule reads no `commands/` folder.
describe('a plugin.json that does not parse to an object', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)

  it.fails.each([
    ['a syntax error', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a scalar', '3'],
  ])('reads no commands/ folder for %s', (_name, text) => {
    const tree = `bad-${Buffer.from(text).toString('hex')}`
    put(`${tree}/.claude-plugin/plugin.json`, text)
    put(`${tree}/commands/review.md`, bare)
    put(`${tree}/skills/review/SKILL.md`, bare)
    expect(lint(path.join(scratch, tree, 'skills', 'review', 'SKILL.md'), bare)).toEqual([])
    expect(lint(path.join(scratch, tree, 'commands', 'review.md'), bare)).toEqual([])
  })
})
