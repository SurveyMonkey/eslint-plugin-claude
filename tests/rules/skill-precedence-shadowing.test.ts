// An enterprise skill beats a personal skill, and a personal skill beats a project skill, when
// they share a name. The rule cannot see personal or enterprise skills, so it reports only the
// names that its options give. It judges the `.claude/` folder in the root of the repository,
// the project folder. The trees are built at run time, because the root of a repository is
// where `.git` is.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-precedence-shadowing-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const at = (...parts: string[]) => path.join(scratch, ...parts)
const put = (file: string) => {
  mkdirSync(path.dirname(at(file)), { recursive: true })
  writeFileSync(at(file), '')
  return at(file)
}

// A repository, with a plugin and a nested package.
mkdirSync(at('repo/.git'), { recursive: true })
const rootSkill = (folder: string) => put(`repo/.claude/skills/${folder}/SKILL.md`)
const rootCommand = (file: string) => put(`repo/.claude/commands/${file}.md`)
const nested = put('repo/packages/web/.claude/skills/deploy/SKILL.md')
put('repo/plugins/p/.claude-plugin/plugin.json')
writeFileSync(at('repo/plugins/p/.claude-plugin/plugin.json'), '{}')
const pluginSkill = put('repo/plugins/p/skills/deploy/SKILL.md')
const pluginCommand = put('repo/plugins/p/commands/deploy.md')
// A tree with no `.git`: the repository root is not above it.
const noGit = put('nogit/.claude/skills/deploy/SKILL.md')

const named = (value: string) => `---\nname: ${value}\n---\n\nBody\n`
const bare = 'Body\n'

const shadowed = (scope: string, name: string, kind = 'skill') => ({
  messageId: 'shadowed' as const,
  data: { scope, name, kind },
  line: 1,
  column: 1,
})

markdownTester.run('skill-precedence-shadowing', ruleOf('skill-precedence-shadowing'), {
  valid: [
    // The rule cannot see personal skills. With no names it reports nothing.
    { code: bare, filename: rootSkill('deploy') },
    { code: bare, filename: rootSkill('deploy'), options: [{}] },
    {
      code: bare,
      filename: rootSkill('deploy'),
      options: [{ personalNames: [], enterpriseNames: [] }],
    },
    // A name that the lists do not hold.
    { code: bare, filename: rootSkill('review'), options: [{ personalNames: ['deploy'] }] },
    { code: bare, filename: rootSkill('review'), options: [{ enterpriseNames: ['deploy'] }] },
    // The list of the other scope does not hold the name.
    { code: bare, filename: rootCommand('review'), options: [{ personalNames: ['deploy'] }] },
    // A `name` that is not a string, or is empty, gives way to the folder name.
    { code: named('3'), filename: rootSkill('plain'), options: [{ personalNames: ['3'] }] },
    // The `name` field of a command file is not read.
    {
      code: named('deploy'),
      filename: rootCommand('other'),
      options: [{ personalNames: ['deploy'] }],
    },
    // A plugin skill and a plugin command are namespaced, so both load.
    { code: bare, filename: pluginSkill, options: [{ personalNames: ['deploy'] }] },
    { code: bare, filename: pluginCommand, options: [{ personalNames: ['deploy'] }] },
    // A nested folder is not the project folder. The docs name no rule for it.
    { code: bare, filename: nested, options: [{ personalNames: ['deploy'] }] },
    // Without a repository root above it, no folder is the project folder.
    { code: bare, filename: noGit, options: [{ personalNames: ['deploy'] }] },
    // Not a skill or command file.
    { code: bare, filename: at('repo/docs/SKILL.md'), options: [{ personalNames: ['SKILL'] }] },
    // The frontmatter does not parse, so only the folder name counts.
    {
      code: '---\nname: [x\n---\n',
      filename: rootSkill('review'),
      options: [{ personalNames: ['x'] }],
    },
  ],
  invalid: [
    // A project skill named in each list.
    {
      code: bare,
      filename: rootSkill('deploy'),
      options: [{ personalNames: ['deploy'] }],
      errors: [shadowed('personal', 'deploy')],
    },
    {
      code: bare,
      filename: rootSkill('deploy'),
      options: [{ enterpriseNames: ['deploy'] }],
      errors: [shadowed('enterprise', 'deploy')],
    },
    // The enterprise skill beats the personal skill, so it names the report.
    {
      code: bare,
      filename: rootSkill('deploy'),
      options: [{ personalNames: ['deploy'], enterpriseNames: ['deploy'] }],
      errors: [shadowed('enterprise', 'deploy')],
    },
    // The folder name and the `name` field both invoke the skill.
    {
      code: named('release'),
      filename: rootSkill('ship'),
      options: [{ personalNames: ['release'] }],
      errors: [shadowed('personal', 'release')],
    },
    {
      code: named('release'),
      filename: rootSkill('ship'),
      options: [{ personalNames: ['ship'] }],
      errors: [shadowed('personal', 'ship')],
    },
    // A `name` that is empty gives way to the folder name.
    {
      code: '---\nname: ""\n---\n',
      filename: rootSkill('blank'),
      options: [{ personalNames: ['blank'] }],
      errors: [shadowed('personal', 'blank')],
    },
    // A command file: a skill wins over a command file of the same name.
    {
      code: bare,
      filename: rootCommand('ship'),
      options: [{ personalNames: ['ship'] }],
      errors: [shadowed('personal', 'ship', 'command')],
    },
    {
      code: bare,
      filename: rootCommand('ops/run'),
      options: [{ enterpriseNames: ['ops:run'] }],
      errors: [shadowed('enterprise', 'ops:run', 'command')],
    },
  ],
})
