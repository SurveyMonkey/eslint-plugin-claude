// In one scope (a `.claude/` directory or a plugin), each skill and command
// file has its own command name. The trees are on disk under
// tests/fixtures/skill-name-unique/, one tree for each case. The names that
// differ only by case, spacing, invisible characters, fullwidth letters and
// dash variants are built at run time, because a committed file would hide
// the characters.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-name-unique')
const at = (...parts: string[]) => path.join(fixtures, ...parts)
const skillAt = (tree: string, folder: string, ...above: string[]) =>
  at(tree, ...above, '.claude', 'skills', folder, 'SKILL.md')
const named = (value: string) => `---\nname: ${value}\n---\n\n# Skill\n`
const bare = '# Skill\n'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-name-unique-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

// Two names that Claude Code treats as one, and two that it keeps apart.
const SAME: [string, string, string][] = [
  ['case', 'Deploy', 'deploy'],
  ['case', 'DEPLOY', 'dEpLoY'],
  ['spacing', 'my deploy', 'mydeploy'],
  ['spacing', 'deploy ', 'deploy'],
  ['spacing', 'dep　loy', 'deploy'],
  ['spacing', 'dep\tloy', 'deploy'],
  ['invisible', 'dep​loy', 'deploy'],
  ['invisible', '­deploy', 'deploy'],
  ['invisible', '﻿deploy', 'deploy'],
  ['invisible', 'dep‍loy', 'deploy'],
  ['fullwidth', 'ｄｅｐｌｏｙ', 'deploy'],
  ['fullwidth', 'ＤＥＰＬＯＹ', 'deploy'],
  ['compatibility form', 'ﬁle', 'file'],
  ['dash', 'my‐app', 'my-app'],
  ['dash', 'my‑app', 'my-app'],
  ['dash', 'my–app', 'my-app'],
  ['dash', 'my—app', 'my-app'],
  ['dash', 'my−app', 'my-app'],
  ['dash', 'my－app', 'my-app'],
  ['dash', 'my﹣app', 'my-app'],
]
const DIFFERENT: [string, string][] = [
  ['dеploy', 'deploy'], // a Cyrillic letter looks like a Latin letter
  ['my_app', 'my-app'],
  ['deploy2', 'deploy'],
  ['deploy', 'deploys'],
]
put('three/.claude/commands/t.md', bare)
put('three/.claude/skills/u/SKILL.md', named('t'))
const pair = (index: number, first: string, second: string) => {
  const tree = `fold-${index}`
  const file = (folder: string, value: string) =>
    put(`${tree}/.claude/skills/${folder}/SKILL.md`, named(JSON.stringify(value)))
  return {
    code: named(JSON.stringify(first)),
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
    // The plugin-root skill has no name from a folder or a path.
    { code: named('review'), filename: at('plugin', 'SKILL.md') },
    // The frontmatter of this file does not parse, so the rule reads nothing from it.
    { code: '---\nname: [unclosed\n---\n', filename: skillAt('bad-sibling', 'dup') },
    // Not a skill or command file.
    { code: named('build'), filename: at('dup-name', 'docs', 'SKILL.md') },
    { code: named('build'), filename: at('dup-name', '.claude', 'agents', 'build.md') },
  ],
  invalid: [
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
