// In one scope (a `.claude/` directory or a plugin), each skill and command
// file has its own command name. The trees are on disk under
// tests/fixtures/skill-name-unique/, one tree for each case. The names that
// differ only by case, spacing, invisible characters, fullwidth letters and
// dash variants are built at run time, because a committed file would hide
// the characters.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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

// Two names that the rule treats as one, and two that it keeps apart. A name that Claude Code
// refuses is in `REFUSED`, not here.
const SAME: [string, string, string][] = [
  ['case', 'Deploy', 'deploy'],
  ['case', 'DEPLOY', 'dEpLoY'],
  ['spacing', 'my deploy', 'mydeploy'],
  ['spacing, twice', 'a b c', 'abc'],
  ['dash, twice', 'a\u{2010}b\u{2010}c', 'a-b-c'],
  ['invisible', '\u{ad}deploy', 'deploy'],
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
// A refused name, and a second name that it would fold to. The second name can be refused too.
// Claude Code loads no project skill or command under a refused folder or file name. It ignores
// a refused `name` field. Neither file gives a report.
const REFUSED: [string, string, string][] = [
  ['no-break space', 'deploy\u{a0}', 'deploy'],
  ['ideographic space', 'dep\u{3000}loy', 'deploy'],
  ['tab', 'dep\tloy', 'deploy'],
  ['line separator', 'dep\u{2028}loy', 'deploy'],
  ['paragraph separator', 'dep\u{2029}loy', 'deploy'],
  ['zero-width space, twice', 'd\u{200b}e\u{200b}ploy', 'deploy'],
  ['zero-width space', 'dep\u{200b}loy', 'deploy'],
  ['byte order mark', '\u{feff}deploy', 'deploy'],
  ['two spaces', 'dep  loy', 'deploy'],
  ['space at the end', 'deploy ', 'deploy'],
  ['direction control', 'dep\u{202e}loy', 'deploy'],
  ['both refused', 'dep\u{200b}loy', 'dep\tloy'],
]
const DIFFERENT: [string, string][] = [
  ['d\u{435}ploy', 'deploy'], // a Cyrillic letter looks like a Latin letter
  ['my_app', 'my-app'],
  ['deploy2', 'deploy'],
  ['deploy', 'deploys'],
]
put('three/.claude/commands/t.md', bare)
put('plug/.claude-plugin/plugin.json', '{"name":"p"}')
// A plugin skill folder that Claude Code refuses, with a `name` that it takes. The rule compares
// the loaded `name`. The message prints the folder with each refused character as a code point.
put('escaped/.claude-plugin/plugin.json', '{"name":"e"}')
put('escaped/skills/de\u200bploy/SKILL.md', named('deploy'))
put('escaped/skills/x\u202ey/SKILL.md', named('deploy'))
put('edge/.claude-plugin/plugin.json', '{"name":"g"}')
put('edge/skills/ deploy/SKILL.md', named('deploy'))
put('edge/skills/deploy /SKILL.md', named('deploy'))
put('edge4/.claude/skills/a .md/SKILL.md', bare)
// A refused `name` is ignored, and the skill loads under its folder name.
put('ignored/.claude/skills/deploy/SKILL.md', named(quote('dep\u{200b}loy')))
put('ignored/.claude/skills/other/SKILL.md', named('deploy'))
// Plugin roots for the tests of plugin skill folder names with hyphens.
for (const tree of [
  'hyph',
  'hyphzw',
  'hyphnb',
  'hyphcmd',
  'hyphname',
  'hyphdot',
  'hyphsp',
  'hyphmix',
  'hyphrn',
]) {
  put(`${tree}/.claude-plugin/plugin.json`, `{"name":"${tree}"}`)
}
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
// No `.git`: `.claude/` is the bound, so a link from `.claude/` to a directory beside it
// leaves the bound.
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
// Neither file of a pair reports. A refused `name` gives way to the folder name, and no folder
// name matches.
const refusedCases = REFUSED.flatMap(([, first, second], index) => {
  const { code, filename, other } = pair(300 + index, first, second)
  return [
    { code, filename },
    { code: named(quote(second)), filename: other },
  ]
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
    ...refusedCases,
    // A zero-width space in a folder name and a double space in a command name. Each folds to
    // `ab`. `skill-name-characters` reports each one, and Claude Code loads neither.
    { code: bare, filename: put('refused/.claude/skills/a\u{200b}b/SKILL.md', bare) },
    { code: bare, filename: put('refused/.claude/commands/a  b.md', bare) },
    { code: bare, filename: put('refused/.claude/skills/ab/SKILL.md', bare) },
    // A refused command folder or file name is not compared, in the path or in the name.
    { code: bare, filename: put('refused/.claude/commands/ops /x.md', bare) },
    { code: bare, filename: put('refused/.claude/commands/ops/x.md', bare) },
    { code: bare, filename: put('refused/.claude/commands/ops/x .md', bare) },
    // A project skill folder that Claude Code refuses is not loaded, even with a loaded `name`.
    // The rule compares it in neither file.
    {
      code: named('deploy'),
      filename: put('projname/.claude/skills/de\u{200b}ploy/SKILL.md', named('deploy')),
    },
    {
      code: named('deploy'),
      filename: put('projname/.claude/skills/deploy/SKILL.md', named('deploy')),
    },
    // A plugin skill folder with a refused name loads with hyphens. The rule puts the hyphens in
    // before it folds the name. `a<U+200B>b` is `a-b`, not `ab`. `a<U+00A0>c` is `a-c`, not `ac`.
    { code: bare, filename: put('plug/skills/a\u{200b}b/SKILL.md', bare) },
    { code: bare, filename: put('plug/skills/a\u{a0}c/SKILL.md', bare) },
    { code: bare, filename: put('plug/skills/ab/SKILL.md', bare) },
    { code: bare, filename: put('plug/skills/ac/SKILL.md', bare) },
    // A plugin skill folder with a refused name and a loaded `name` goes by the `name`, not by
    // the folder name with hyphens.
    { code: named('ship'), filename: put('hyphname/skills/a<b/SKILL.md', named('ship')) },
    { code: bare, filename: put('hyphname/skills/a-b/SKILL.md', bare) },
    // A project skill folder with a refused name does not load, so it has no name with hyphens.
    { code: bare, filename: put('hyphproj/.claude/skills/a<b/SKILL.md', bare) },
    { code: bare, filename: put('hyphproj/.claude/skills/a-b/SKILL.md', bare) },
    // The docs do not name a dot, so a dot in a plugin skill folder stays a dot.
    { code: bare, filename: put('hyphdot/skills/a.b/SKILL.md', bare) },
    { code: bare, filename: put('hyphdot/skills/a-b/SKILL.md', bare) },
    // Each space of a run in a plugin skill folder becomes a hyphen. `a  b` is `a--b`, not `a-b`.
    { code: bare, filename: put('hyphsp/skills/a-b/SKILL.md', bare) },
    // A plain space next to a no-break space becomes a hyphen too, so `a<U+00A0><U+0020>b` is
    // `a--b`, not `a-b`.
    { code: bare, filename: put('hyphmix/skills/a-b/SKILL.md', bare) },
    // A command file name with a space at the end is refused. Neither file gives a report.
    { code: bare, filename: put('edge2/.claude/commands/a.md', bare) },
    { code: bare, filename: put('edge2/.claude/commands/a .md', bare) },
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
    // Without `.git`, `.claude/` is the bound, as for the agent rules. The link leaves it.
    {
      code: named('shared:deploy'),
      filename: path.join(scratch, 'nogit', '.claude', 'skills', 's', 'SKILL.md'),
    },
  ],
  invalid: [
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
    // The files that the message names print each refused character as its code point.
    {
      code: bare,
      filename: put('escaped/skills/deploy/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: {
            name: 'deploy',
            others: '`skills/de<U+200B>ploy/SKILL.md`, `skills/x<U+202E>y/SKILL.md`',
          },
        },
      ],
    },
    // A plugin skill folder that is refused, with a loaded `name`, is a subject too.
    {
      code: named('deploy'),
      filename: put('escaped/skills/de\u{200b}ploy/SKILL.md', named('deploy')),
      errors: [
        {
          messageId: 'duplicate',
          data: {
            name: 'deploy',
            others: '`skills/deploy/SKILL.md`, `skills/x<U+202E>y/SKILL.md`',
          },
          line: 2,
        },
      ],
    },
    // A plugin skill folder with a refused name and no loaded `name` goes by its folder name. Each
    // refused character becomes a hyphen. The message prints that name.
    {
      code: bare,
      filename: put('hyph/skills/a<b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/a-b/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    {
      code: bare,
      filename: put('hyph/skills/a-b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/a<U+003C>b/SKILL.md`' },
          line: 1,
          column: 1,
        },
      ],
    },
    // A zero-width space and a no-break space become hyphens too. The rule then folds the result,
    // so `a-b` and `A-B` are one name.
    {
      code: bare,
      filename: put('hyphzw/skills/a\u{200b}b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/A-B/SKILL.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphzw/skills/A-B/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'A-B', others: '`skills/a<U+200B>b/SKILL.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphnb/skills/a\u{a0}b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/A-B/SKILL.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphnb/skills/A-B/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'A-B', others: '`skills/a<U+00A0>b/SKILL.md`' },
        },
      ],
    },
    // A plugin skill folder name with hyphens meets a command name.
    {
      code: bare,
      filename: put('hyphcmd/skills/a<b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`commands/a-b.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphcmd/commands/a-b.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/a<U+003C>b/SKILL.md`' },
        },
      ],
    },
    // Two spaces in a row in a plugin skill folder become two hyphens.
    {
      code: bare,
      filename: put('hyphsp/skills/a  b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a--b', others: '`skills/a--b/SKILL.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphsp/skills/a--b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a--b', others: '`skills/a<U+0020> b/SKILL.md`' },
        },
      ],
    },
    // A no-break space and a plain space in a row in a plugin skill folder become two hyphens.
    {
      code: bare,
      filename: put('hyphmix/skills/a\u{a0} b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a--b', others: '`skills/a--b/SKILL.md`' },
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphmix/skills/a--b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a--b', others: '`skills/a<U+00A0> b/SKILL.md`' },
        },
      ],
    },
    // A plugin skill folder with a refused name and a refused `name` goes by its folder name with
    // hyphens, because Claude Code ignores a refused `name`.
    {
      code: named(quote('dep\u{200b}loy')),
      filename: put('hyphrn/skills/a<b/SKILL.md', named(quote('dep\u{200b}loy'))),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/a-b/SKILL.md`' },
          line: 1,
        },
      ],
    },
    {
      code: bare,
      filename: put('hyphrn/skills/a-b/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a-b', others: '`skills/a<U+003C>b/SKILL.md`' },
        },
      ],
    },
    // A refused `name` gives way to the folder name, and the report is on line 1.
    {
      code: named(quote('dep\u{200b}loy')),
      filename: put('ignored/.claude/skills/deploy/SKILL.md', named(quote('dep\u{200b}loy'))),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/other/SKILL.md`' },
          line: 1,
        },
      ],
    },
    {
      code: named('deploy'),
      filename: put('ignored/.claude/skills/other/SKILL.md', named('deploy')),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'deploy', others: '`skills/deploy/SKILL.md`' },
          line: 2,
        },
      ],
    },
    // A space at the edge of one folder name is a fault.
    {
      code: bare,
      filename: put('edge/skills/deploy/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: {
            name: 'deploy',
            others: '`skills/<U+0020>deploy/SKILL.md`, `skills/deploy<U+0020>/SKILL.md`',
          },
        },
      ],
    },
    // A folder that ends in `.md` keeps its name whole.
    {
      code: bare,
      filename: put('edge4/.claude/skills/a.md/SKILL.md', bare),
      errors: [
        {
          messageId: 'duplicate',
          data: { name: 'a.md', others: '`skills/a .md/SKILL.md`' },
        },
      ],
    },
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

// A manifest that is not a JSON object gives no key. The rule reads no `commands/` folder.
describe('a plugin.json that does not parse to an object', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)

  it.each([
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

// A project `.claude/` is no plugin root, so a manifest in it changes no result (the plugins
// reference puts the manifest under the plugin root). The result is the one with no manifest.
describe('a .claude/.claude-plugin/plugin.json in a project', () => {
  it.each([
    ['a syntax error', '{'],
    ['a `commands` key', '{"commands": "./x"}'],
  ])('does not change the report, for %s', (_name, text) => {
    const tree = `proj-man-${Buffer.from(text).toString('hex')}`
    put(`${tree}/.git/HEAD`, '')
    put(`${tree}/.claude/.claude-plugin/plugin.json`, text)
    put(`${tree}/.claude/commands/dup.md`, bare)
    const skill = path.join(scratch, tree, '.claude', 'skills', 'dup', 'SKILL.md')
    const command = path.join(scratch, tree, '.claude', 'commands', 'dup.md')
    put(`${tree}/.claude/skills/dup/SKILL.md`, bare)
    expect(lintMarkdown('skill-name-unique', bare, skill)).toHaveLength(1)
    expect(lintMarkdown('skill-name-unique', bare, command)).toHaveLength(1)
  })
})

// A `.claude` link whose target holds its own `.git` has the target as its bound, as it has for
// the agent rules. The scan of the target stays inside that bound, so the rule sees it.
describe.skipIf(process.platform === 'win32')('a .claude link to a repository of its own', () => {
  it('reads the skills in the target, and reports a name that clashes', () => {
    put('lnk/.git/HEAD', '')
    put('lnk-target/.git/HEAD', '')
    put('lnk-target/skills/dup/SKILL.md', bare)
    put('lnk-target/skills/other/SKILL.md', named('dup'))
    symlinkSync('../lnk-target', path.join(scratch, 'lnk/.claude'))
    const file = path.join(scratch, 'lnk', '.claude', 'skills', 'dup', 'SKILL.md')
    expect(lintMarkdown('skill-name-unique', bare, file)).toHaveLength(1)
  })
})

// Claude Code 2.1.310 refuses a project skill folder of soft hyphens only. A plugin skill folder of
// soft hyphens loads with one hyphen for each, so `\u{ad}` is `-` and `\u{ad}\u{ad}` is `--`. The
// rule gives no entry to a name that folds to an empty string, so neither tree reports.
describe('a name of format characters only', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)
  const shy = '\u{ad}'

  it.each([
    ['a project', 'shy-proj/.claude/skills'],
    ['a plugin', 'shy-plug/skills'],
  ])('gives no report for two such folders in %s', (_name, dir) => {
    put('shy-plug/.claude-plugin/plugin.json', '{"name":"shy"}')
    const one = put(`${dir}/${shy}/SKILL.md`, bare)
    const two = put(`${dir}/${shy}${shy}/SKILL.md`, bare)
    expect(lint(one, bare)).toEqual([])
    expect(lint(two, bare)).toEqual([])
  })

  it('takes a `name` of format characters only as no name, and compares the folder name', () => {
    const code = named(quote(shy))
    const one = put(`shy-name/.claude/skills/one/SKILL.md`, code)
    const two = put(`shy-name/.claude/skills/two/SKILL.md`, code)
    expect(lint(one, code)).toEqual([])
    expect(lint(two, code)).toEqual([])
    put(`shy-name/.claude/skills/three/SKILL.md`, named('one'))
    expect(lint(one, code)).toHaveLength(1)
  })

  it('gives no report for two command files of format characters only', () => {
    const one = put(`shy-cmd/.claude/commands/${shy}.md`, bare)
    put(`shy-cmd/.claude/commands/${shy}${shy}.md`, bare)
    expect(lint(one, bare)).toEqual([])
  })

  it('keeps the plugin folders `-` and `--` apart', () => {
    put('dash-plug/.claude-plugin/plugin.json', '{"name":"dash"}')
    const one = put('dash-plug/skills/-/SKILL.md', bare)
    const two = put('dash-plug/skills/--/SKILL.md', bare)
    expect(lint(one, bare)).toEqual([])
    expect(lint(two, bare)).toEqual([])
  })
})

// The paths of the manifest `skills` key add to `skills/` (manifest reference, Fields table). A path
// names a folder of skill folders, or one skill folder. Each tree has a `.git`, so the plugin root
// is in the repository.
describe('the skill folders of the manifest skills paths', () => {
  const lint = (file: string, code: string) => lintMarkdown('skill-name-unique', code, file)
  const tree = (name: string, manifest: string) => {
    put(`${name}/.git/HEAD`, '')
    put(`${name}/.claude-plugin/plugin.json`, manifest)
    return (file: string, text = bare) => put(`${name}/${file}`, text)
  }

  it('reports a listed skill and a skills/ skill with one name, in each file', () => {
    const add = tree('lst', '{"name":"l","skills":["./extra"]}')
    const listed = add('extra/a-b/SKILL.md')
    const shipped = add('skills/a-b/SKILL.md')
    expect(lint(listed, bare)).toMatchObject([
      { messageId: 'duplicate', message: expect.stringContaining('`skills/a-b/SKILL.md`') },
    ])
    expect(lint(shipped, bare)).toMatchObject([
      { messageId: 'duplicate', message: expect.stringContaining('`extra/a-b/SKILL.md`') },
    ])
  })

  it('reads a path that names one skill folder, and a path given as a string', () => {
    const add = tree('lst-one', '{"name":"l","skills":"./one"}')
    const listed = add('one/SKILL.md', named('deploy'))
    const shipped = add('skills/deploy/SKILL.md')
    expect(lint(listed, named('deploy'))).toHaveLength(1)
    expect(lint(shipped, bare)).toMatchObject([
      { message: expect.stringContaining('`one/SKILL.md`') },
    ])
  })

  it('compares the listed folder name with hyphens, as for a folder in skills/', () => {
    const add = tree('lst-hyph', '{"name":"l","skills":["./extra"]}')
    const listed = add('extra/a<b/SKILL.md')
    add('skills/a-b/SKILL.md')
    expect(lint(listed, bare)).toMatchObject([
      { message: expect.stringContaining('`a-b` is also the command name of') },
    ])
  })

  it('adds no entry for a manifest that does not parse', () => {
    const add = tree('lst-bad', '{"name":"l","skills":["./extra"]')
    const listed = add('extra/a-b/SKILL.md')
    const shipped = add('skills/a-b/SKILL.md')
    expect(lint(listed, bare)).toEqual([])
    expect(lint(shipped, bare)).toEqual([])
  })

  it('reads no skill twice, and skips a path that gives no skill folder', () => {
    const add = tree(
      'lst-skip',
      '{"name":"l","skills":["./skills","./skills/",3,"./missing","../out",".","./README.md"]}',
    )
    add('README.md', '# Plugin\n')
    add('SKILL.md', named('x'))
    mkdirSync(path.join(scratch, 'lst-skip/skills/empty'), { recursive: true })
    const shipped = add('skills/x/SKILL.md')
    expect(lint(shipped, bare)).toEqual([])
  })

  it('reads no `SKILL.md` that leads out of the plugin', () => {
    put('lst-out/.git/HEAD', '')
    put('lst-out/p/.claude-plugin/plugin.json', '{"name":"l","skills":["./extra"]}')
    put('lst-out/outside.md', bare)
    mkdirSync(path.join(scratch, 'lst-out/p/extra/x'), { recursive: true })
    symlinkSync('../../../outside.md', path.join(scratch, 'lst-out/p/extra/x/SKILL.md'))
    const shipped = put('lst-out/p/skills/x/SKILL.md', bare)
    expect(lint(shipped, bare)).toEqual([])
    expect(lint(path.join(scratch, 'lst-out/p/extra/x/SKILL.md'), bare)).toEqual([])
  })

  it('walks past a plugin root that does not list the skill', () => {
    const add = tree('lst-nest', '{"name":"n","skills":["./inner/a"]}')
    add('inner/.claude-plugin/plugin.json', '{"name":"i"}')
    const listed = add('inner/a/x/SKILL.md')
    add('skills/x/SKILL.md')
    expect(lint(listed, bare)).toMatchObject([
      { message: expect.stringContaining('`skills/x/SKILL.md`') },
    ])
  })

  it('stops at a plugin root that it cannot see', () => {
    const add = tree('lst-unseen', '{"name":"u","skills":["./sub/extra"]}')
    put('lst-unseen-target/plugin.json', '{"name":"t"}')
    mkdirSync(path.join(scratch, 'lst-unseen/sub'), { recursive: true })
    symlinkSync('../../lst-unseen-target', path.join(scratch, 'lst-unseen/sub/.claude-plugin'))
    const listed = add('sub/extra/x/SKILL.md')
    add('skills/x/SKILL.md')
    expect(lint(listed, bare)).toEqual([])
  })

  it('reads no plugin root above a skill folder that is a repository of its own', () => {
    const add = tree('lst-repo', '{"name":"r","skills":["./g"]}')
    add('g/x/.git/HEAD', '')
    const listed = add('g/x/SKILL.md')
    add('skills/x/SKILL.md')
    expect(lint(listed, bare)).toEqual([])
  })

  it('gives no report for a SKILL.md that no plugin lists', () => {
    const add = tree('lst-none', '{"name":"l"}')
    const loose = add('docs/x/SKILL.md')
    add('skills/x/SKILL.md')
    expect(lint(loose, bare)).toEqual([])
  })

  it('gives no report for an unlisted SKILL.md beside a listed duplicate', () => {
    const add = tree('lst-beside', '{"name":"l","skills":["./extra"]}')
    add('extra/a/SKILL.md')
    add('skills/a/SKILL.md')
    expect(lint(add('docs/a/SKILL.md'), bare)).toEqual([])
  })

  it('names a skill one time when two paths give it', () => {
    const add = tree('lst-twice', '{"name":"l","skills":["./skills","./skills/"]}')
    add('skills/a/SKILL.md')
    const other = add('skills/b/SKILL.md', named('a'))
    expect(lint(other, named('a')).map((report) => report.message)).toEqual([
      '`a` is also the command name of `skills/a/SKILL.md`. Claude Code gives that name to only one of them. Rename one.',
    ])
  })

  it('reads each path of the key', () => {
    const add = tree('lst-two', '{"name":"l","skills":["./a","./b"]}')
    const first = add('a/x/SKILL.md')
    const second = add('b/x/SKILL.md')
    expect(lint(first, bare)).toMatchObject([
      { message: expect.stringContaining('`b/x/SKILL.md`') },
    ])
    expect(lint(second, bare)).toMatchObject([
      { message: expect.stringContaining('`a/x/SKILL.md`') },
    ])
  })

  it('names a listed skill folder by its own folder name', () => {
    const add = tree('lst-own', '{"name":"l","skills":"./one"}')
    const listed = add('one/SKILL.md')
    const shipped = add('skills/one/SKILL.md')
    expect(lint(listed, bare)).toMatchObject([
      { message: expect.stringContaining('`skills/one/SKILL.md`') },
    ])
    expect(lint(shipped, bare)).toMatchObject([
      { message: expect.stringContaining('`one/SKILL.md`') },
    ])
  })

  it('reads no skill folder below a listed skill folder', () => {
    const add = tree('lst-below', '{"name":"l","skills":"./one"}')
    add('one/SKILL.md')
    add('one/refs/SKILL.md')
    expect(lint(add('skills/refs/SKILL.md'), bare)).toEqual([])
  })

  it('reads no skill folder below a listed folder whose SKILL.md leads out of the plugin', () => {
    put('lst-out-one/.git/HEAD', '')
    put('lst-out-one/p/.claude-plugin/plugin.json', '{"name":"l","skills":["./extra/x"]}')
    put('lst-out-one/outside.md', bare)
    put('lst-out-one/p/extra/x/sub/SKILL.md', bare)
    symlinkSync('../../../outside.md', path.join(scratch, 'lst-out-one/p/extra/x/SKILL.md'))
    expect(lint(put('lst-out-one/p/skills/sub/SKILL.md', bare), bare)).toEqual([])
  })

  it('reads no listed SKILL.md whose real path the rule cannot get', () => {
    const add = tree('lst-loop', '{"name":"l","skills":["./extra","./one"]}')
    mkdirSync(path.join(scratch, 'lst-loop/extra/x'), { recursive: true })
    symlinkSync('SKILL.md', path.join(scratch, 'lst-loop/extra/x/SKILL.md'))
    mkdirSync(path.join(scratch, 'lst-loop/one'), { recursive: true })
    symlinkSync('SKILL.md', path.join(scratch, 'lst-loop/one/SKILL.md'))
    add('one/sub/SKILL.md')
    expect(lint(add('skills/x/SKILL.md'), bare)).toEqual([])
    expect(lint(add('skills/sub/SKILL.md'), bare)).toEqual([])
  })

  it('lists the listed skills in name order', () => {
    const add = tree('lst-order', '{"name":"l","skills":["./extra"]}')
    add('extra/B/SKILL.md', named('z'))
    add('extra/a/SKILL.md', named('z'))
    expect(lint(add('skills/z/SKILL.md'), bare)).toMatchObject([
      { message: expect.stringContaining('`extra/a/SKILL.md`, `extra/B/SKILL.md`') },
    ])
  })

  it('compares no listed skill with itself through a link', () => {
    const add = tree('lst-link', '{"name":"l","skills":["./extra"]}')
    const listed = add('extra/x/SKILL.md')
    mkdirSync(path.join(scratch, 'lst-link/skills'), { recursive: true })
    symlinkSync('../extra/x', path.join(scratch, 'lst-link/skills/x'))
    expect(lint(listed, bare)).toEqual([])
  })

  it('compares no listed skill with its spelling through a manifest path link', () => {
    const add = tree('lst-alias', '{"name":"l","skills":["./ln"]}')
    const listed = add('real/x/SKILL.md')
    symlinkSync('real', path.join(scratch, 'lst-alias/ln'))
    add('skills/x/SKILL.md')
    expect(lint(listed, bare).map((report) => report.message)).toEqual([
      '`x` is also the command name of `skills/x/SKILL.md`. Claude Code gives that name to only one of them. Rename one.',
    ])
  })

  it('reads no skill folder below a listed folder whose SKILL.md is a dangling link', () => {
    const add = tree('lst-dead', '{"name":"l","skills":["./one"]}')
    mkdirSync(path.join(scratch, 'lst-dead/one'), { recursive: true })
    symlinkSync('missing.md', path.join(scratch, 'lst-dead/one/SKILL.md'))
    add('one/sub/SKILL.md')
    expect(lint(add('skills/sub/SKILL.md'), bare)).toEqual([])
  })

  it('names a listed skill one time when two listed paths give it', () => {
    const add = tree('lst-dup', '{"name":"l","skills":["./extra","./extra/"]}')
    add('extra/a/SKILL.md')
    const other = add('skills/b/SKILL.md', named('a'))
    expect(lint(other, named('a')).map((report) => report.message)).toEqual([
      '`a` is also the command name of `extra/a/SKILL.md`. Claude Code gives that name to only one of them. Rename one.',
    ])
  })

  it('leaves out a listed skill with the real path of a skill in skills/', () => {
    const add = tree('lst-same', '{"name":"l","skills":["./extra"]}')
    add('extra/x/SKILL.md')
    mkdirSync(path.join(scratch, 'lst-same/skills'), { recursive: true })
    symlinkSync('../extra/x', path.join(scratch, 'lst-same/skills/x'))
    const other = add('skills/y/SKILL.md', named('x'))
    expect(lint(other, named('x')).map((report) => report.message)).toEqual([
      '`x` is also the command name of `skills/x/SKILL.md`. Claude Code gives that name to only one of them. Rename one.',
    ])
  })

  it('names the linted skill by the listed folder, not by its real folder', () => {
    const add = tree('lst-target', '{"name":"l","skills":"./alias"}')
    const target = add('target/SKILL.md')
    symlinkSync('target', path.join(scratch, 'lst-target/alias'))
    add('skills/alias/SKILL.md')
    expect(lint(target, bare)).toMatchObject([
      { message: expect.stringContaining('`skills/alias/SKILL.md`') },
    ])
  })
})

// The docs say that Claude Code loads a skill one time when several skill folders link to one
// target. So two links to one folder do not report each other. Each other skill with the name
// compares with both paths, because the docs do not say which folder name the skill gets.
describe('two skill folders with one real path', () => {
  it('report each other in no file, and both compare with a third skill', () => {
    put('twin-skill/.git/HEAD', '')
    const first = put('twin-skill/.claude/skills/a/SKILL.md', named('z'))
    symlinkSync('a', path.join(scratch, 'twin-skill/.claude/skills/b'))
    const third = put('twin-skill/.claude/skills/c/SKILL.md', named('z'))
    expect(
      lintMarkdown('skill-name-unique', named('z'), first).map((report) => report.message),
    ).toEqual([
      '`z` is also the command name of `skills/c/SKILL.md`. Claude Code gives that name to only one of them. Rename one.',
    ])
    expect(lintMarkdown('skill-name-unique', named('z'), third)).toMatchObject([
      { message: expect.stringContaining('`skills/a/SKILL.md`, `skills/b/SKILL.md`') },
    ])
  })
})

// A path through a linked directory is not the real path. The walk compares real paths, so it
// meets the repository root.
describe('a listed skill below a linked directory', () => {
  it('reports through the link, and stops at a skill folder that is a repository', () => {
    put('lp-real/.git/HEAD', '')
    put('lp-real/.claude-plugin/plugin.json', '{"name":"l","skills":["./extra","./g"]}')
    put('lp-real/extra/a/SKILL.md', bare)
    put('lp-real/skills/a/SKILL.md', bare)
    put('lp-real/g/x/.git/HEAD', '')
    put('lp-real/g/x/SKILL.md', bare)
    put('lp-real/skills/x/SKILL.md', bare)
    put('lp-real/docs/b/SKILL.md', bare)
    symlinkSync('lp-real', path.join(scratch, 'lp'))
    const lint = (file: string) =>
      lintMarkdown('skill-name-unique', bare, path.join(scratch, 'lp', file))
    expect(lint('extra/a/SKILL.md')).toHaveLength(1)
    expect(lint('g/x/SKILL.md')).toEqual([])
    expect(lint('docs/b/SKILL.md')).toEqual([])
  })
})

// A listed folder that the rule can enter but not list. Its `SKILL.md` is not there, so the rule
// lists the folder, and the list fails.
describe.skipIf(chmodCannotBlock)('a listed folder that the rule cannot list', () => {
  it('gives no skill', () => {
    put('lst-deny/.git/HEAD', '')
    put('lst-deny/.claude-plugin/plugin.json', '{"name":"l","skills":["./extra"]}')
    put('lst-deny/extra/a/SKILL.md', bare)
    const shipped = put('lst-deny/skills/a/SKILL.md', bare)
    const extra = path.join(scratch, 'lst-deny/extra')
    chmodSync(extra, 0o300)
    try {
      expect(lintMarkdown('skill-name-unique', bare, shipped)).toEqual([])
    } finally {
      chmodSync(extra, 0o755)
    }
  })
})

// With no `.git`, the rule reads no directory above a skill folder. So a listed skill outside
// `skills/` gets no report, and a skill in `skills/` still compares with it.
describe('a listed skill with no repository', () => {
  it('reports in the skills/ file only', () => {
    put('lst-nogit/.claude-plugin/plugin.json', '{"name":"l","skills":["./extra"]}')
    const listed = put('lst-nogit/extra/a-b/SKILL.md', bare)
    const shipped = put('lst-nogit/skills/a-b/SKILL.md', bare)
    expect(lintMarkdown('skill-name-unique', bare, listed)).toEqual([])
    expect(lintMarkdown('skill-name-unique', bare, shipped)).toHaveLength(1)
  })
})
