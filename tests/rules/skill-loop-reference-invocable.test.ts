// A prompt that `/loop` runs on a schedule passes a skill to Claude as plain text when the skill
// sets `disable-model-invocation: true`. The rule reads `.claude/loop.md`. When its first line
// starts with `/` and the name of a skill or command file in the same `.claude/` folder, it reads
// that file. The trees are built at run time, because the rule reads other files on disk.
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

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-loop-reference-invocable-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const at = (...parts: string[]) => path.join(scratch, ...parts)
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(at(file)), { recursive: true })
  writeFileSync(at(file), text)
  return at(file)
}

const manual = '---\ndescription: d\ndisable-model-invocation: true\n---\n\nBody\n'
const open = '---\ndescription: d\n---\n\nBody\n'
const loop = (tree: string) => at(tree, '.claude', 'loop.md')

// The tree `a` has a repository root. Its skills and command files:
mkdirSync(at('a/.git'), { recursive: true })
put('a/.claude/skills/deploy/SKILL.md', manual)
put('a/.claude/skills/review/SKILL.md', open)
put('a/.claude/skills/ship/SKILL.md', manual.replace('description: d', 'name: release'))
put('a/.claude/skills/yes/SKILL.md', '---\ndisable-model-invocation: yes\n---\n')
put('a/.claude/skills/off/SKILL.md', '---\ndisable-model-invocation: false\n---\n')
put('a/.claude/skills/user-only/SKILL.md', '---\nuser-invocable: false\n---\n')
put('a/.claude/skills/bad-yaml/SKILL.md', '---\ndisable-model-invocation: [true\n---\n')
put('a/.claude/skills/plain/SKILL.md', 'Body\n')
// Two skills with one name: the rule cannot tell which one runs, so it reports neither.
put('a/.claude/skills/dup/SKILL.md', manual)
put('a/.claude/skills/other/SKILL.md', '---\nname: dup\n---\n')
// A skill wins over a command file of the same name.
put('a/.claude/skills/both/SKILL.md', open)
put('a/.claude/commands/both.md', manual)
put('a/.claude/skills/rev/SKILL.md', manual)
put('a/.claude/commands/rev.md', open)
put('a/.claude/commands/cmd.md', manual)
put('a/.claude/commands/ops/run.md', manual)
put('a/.claude/commands/ok.md', open)
// A skill folder without a `SKILL.md`, and a file.
mkdirSync(at('a/.claude/skills/empty'), { recursive: true })
put('a/.claude/skills/README.md', 'Notes\n')
// A plugin skill is not in the project folder.
put('a/plugins/p/skills/deploy/SKILL.md', manual)
// A link out of the repository: the rule reads nothing there.
put('outside/deploy/SKILL.md', manual)
mkdirSync(at('b/.claude/skills'), { recursive: true })
symlinkSync('../../../outside/deploy', at('b/.claude/skills/deploy'))
mkdirSync(at('b/.git'), { recursive: true })
// A link inside the repository.
put('c/shared/deploy/SKILL.md', manual)
mkdirSync(at('c/.claude/skills'), { recursive: true })
symlinkSync('../../shared/deploy', at('c/.claude/skills/deploy'))
mkdirSync(at('c/.git'), { recursive: true })
// A `skills` entry that is a file, and a tree with no `skills/` folder.
put('d/.claude/skills', 'not a folder\n')
mkdirSync(at('e/.claude'), { recursive: true })
// A skill that the rule cannot see could have the name, and it would win over a command file.
// A link to nothing:
put('hid-dead/.claude/skills/deploy/SKILL.md', manual)
put('hid-dead/.claude/commands/ship.md', manual)
symlinkSync('missing', at('hid-dead/.claude/skills/dead'))
mkdirSync(at('hid-dead/.git'), { recursive: true })
// A link out of the repository, and a command file of the same name:
put('hid-out/.claude/commands/deploy.md', manual)
mkdirSync(at('hid-out/.claude/skills'), { recursive: true })
symlinkSync('../../../outside/deploy', at('hid-out/.claude/skills/other'))
mkdirSync(at('hid-out/.git'), { recursive: true })
// A link out of the repository below `commands/` can hold `ops/run.md`, which is `/ops:run`,
// the name of the file `ops:run.md` next to it:
put('hid-cmd/.claude/commands/ops:run.md', manual)
symlinkSync('../../../outside', at('hid-cmd/.claude/commands/ops'))
mkdirSync(at('hid-cmd/.git'), { recursive: true })

// A link to a folder or a file that holds no skill is not a hidden skill.
put('lnk/shared/n.md', 'Notes\n')
mkdirSync(at('lnk/shared/empty'), { recursive: true })
put('lnk/.claude/skills/deploy/SKILL.md', manual)
symlinkSync('../../shared/empty', at('lnk/.claude/skills/folder'))
symlinkSync('../../shared/n.md', at('lnk/.claude/skills/n.md'))
mkdirSync(at('lnk/.git'), { recursive: true })
// A `skills` folder that is a link to nothing could hold the skill that wins over the command.
put('hid-skills/.claude/commands/deploy.md', manual)
symlinkSync('missing', at('hid-skills/.claude/skills'))
mkdirSync(at('hid-skills/.git'), { recursive: true })
// A real folder whose `SKILL.md` is a link to nothing.
put('hid-file/.claude/commands/deploy.md', manual)
mkdirSync(at('hid-file/.claude/skills/x'), { recursive: true })
symlinkSync('missing', at('hid-file/.claude/skills/x/SKILL.md'))
mkdirSync(at('hid-file/.git'), { recursive: true })
// Command files and no `skills/` folder: the commands answer.
put('cmds/.claude/commands/cmd.md', manual)
mkdirSync(at('cmds/.git'), { recursive: true })

const manualOnly = (name: string, line = 1, column = 1) => ({
  messageId: 'manualOnly' as const,
  data: { name },
  line,
  column,
  endLine: line,
  endColumn: column + 1 + name.length,
})

markdownTester.run('skill-loop-reference-invocable', ruleOf('skill-loop-reference-invocable'), {
  valid: [
    // A skill that Claude can invoke.
    { code: '/review 12\n', filename: loop('a') },
    { code: '/off\n', filename: loop('a') },
    { code: '/user-only\n', filename: loop('a') },
    { code: '/plain\n', filename: loop('a') },
    { code: '/ok\n', filename: loop('a') },
    // A skill with a `SKILL.md` that the rule cannot read as frontmatter.
    { code: '/bad-yaml\n', filename: loop('a') },
    // A name that nothing in the repository has: a plugin skill, a built-in command, a made-up name.
    { code: '/p:deploy\n', filename: loop('a') },
    { code: '/clear\n', filename: loop('a') },
    { code: '/nothing-here\n', filename: loop('a') },
    // A folder with no `SKILL.md`, and a file in `skills/`.
    { code: '/empty\n', filename: loop('a') },
    { code: '/README.md\n', filename: loop('a') },
    // A skill that the rule cannot see could have the name: a link to nothing, a link out of the
    // repository, and a `SKILL.md` that is a link to nothing. A command file does not answer.
    { code: '/deploy\n', filename: loop('hid-dead') },
    { code: '/ship\n', filename: loop('hid-dead') },
    { code: '/deploy\n', filename: loop('hid-out') },
    { code: '/ops:run\n', filename: loop('hid-cmd') },
    { code: '/deploy\n', filename: loop('hid-skills') },
    { code: '/deploy\n', filename: loop('hid-file') },
    // Two skills answer to `dup`, and one of them has no `disable-model-invocation`.
    { code: '/dup\n', filename: loop('a') },
    // The skill wins over a command file of the same name.
    { code: '/both\n', filename: loop('a') },
    // A link out of the repository is not read.
    { code: '/deploy\n', filename: loop('b') },
    // A `skills` entry that is a file, and no `skills/` folder.
    { code: '/deploy\n', filename: loop('d') },
    { code: '/deploy\n', filename: loop('e') },
    // Only a prompt that starts with the skill name is a skill prompt.
    { code: 'Check CI, then run /deploy.\n', filename: loop('a') },
    { code: '# Loop\n\n/deploy\n', filename: loop('a') },
    { code: ' /deploy\n', filename: loop('a') },
    { code: '/ deploy\n', filename: loop('a') },
    { code: '/\n', filename: loop('a') },
    { code: '', filename: loop('a') },
    { code: '\n\n', filename: loop('a') },
  ],
  invalid: [
    // A skill that sets `disable-model-invocation: true`.
    { code: '/deploy staging\n', filename: loop('a'), errors: [manualOnly('deploy')] },
    { code: '/deploy\n', filename: loop('a'), errors: [manualOnly('deploy')] },
    // Blank lines before the prompt.
    { code: '\n  \n/deploy 1\n', filename: loop('a'), errors: [manualOnly('deploy', 3)] },
    { code: '\r\n/deploy 1\r\n', filename: loop('a'), errors: [manualOnly('deploy', 2)] },
    // The other forms of the Boolean.
    { code: '/yes\n', filename: loop('a'), errors: [manualOnly('yes')] },
    // The folder name and the `name` both invoke the skill.
    { code: '/release\n', filename: loop('a'), errors: [manualOnly('release')] },
    { code: '/ship\n', filename: loop('a'), errors: [manualOnly('ship')] },
    // A command file, also in a folder.
    { code: '/cmd\n', filename: loop('a'), errors: [manualOnly('cmd')] },
    { code: '/ops:run now\n', filename: loop('a'), errors: [manualOnly('ops:run')] },
    // The skill wins over the command file, so the skill decides.
    { code: '/rev\n', filename: loop('a'), errors: [manualOnly('rev')] },
    // A link inside the repository.
    { code: '/deploy\n', filename: loop('c'), errors: [manualOnly('deploy')] },
    // A link to a folder or a file that holds no skill hides nothing.
    { code: '/deploy\n', filename: loop('lnk'), errors: [manualOnly('deploy')] },
    // Command files, and no `skills/` folder.
    { code: '/cmd\n', filename: loop('cmds'), errors: [manualOnly('cmd')] },
  ],
})

// A read that fails with `EACCES` is not a missing file. The rule makes no report that rests on a
// file that it cannot read.
describe.skipIf(chmodCannotBlock)('a file that the rule cannot read', () => {
  const lint = (tree: string, code: string) =>
    lintMarkdown('skill-loop-reference-invocable', code, loop(tree))

  // The rule keeps the fields of a file that it read, so each test locks the file before the
  // first read.
  it('reports nothing for the skill that it cannot read', () => {
    const file = put('f/.claude/skills/locked/SKILL.md', manual)
    mkdirSync(at('f/.git'), { recursive: true })
    withoutAccess(file, () => expect(lint('f', '/locked\n')).toEqual([]))
    expect(lint('f', '/locked\n')).toHaveLength(1)
  })

  it('reports nothing for a name that an unreadable skill can hold', () => {
    put('g/.claude/skills/hidden/SKILL.md', manual)
    const file = put('g/.claude/skills/other/SKILL.md', open)
    mkdirSync(at('g/.git'), { recursive: true })
    withoutAccess(file, () => expect(lint('g', '/hidden\n')).toEqual([]))
    expect(lint('g', '/hidden\n')).toHaveLength(1)
  })

  it('reports nothing for a command file that it cannot read', () => {
    const file = put('h/.claude/commands/locked.md', manual)
    mkdirSync(at('h/.git'), { recursive: true })
    withoutAccess(file, () => expect(lint('h', '/locked\n')).toEqual([]))
    expect(lint('h', '/locked\n')).toHaveLength(1)
  })

  it('reports nothing for a command that a skill folder it cannot search could answer', () => {
    put('j/.claude/skills/x/SKILL.md', open)
    put('j/.claude/commands/deploy.md', manual)
    mkdirSync(at('j/.git'), { recursive: true })
    withoutAccess(at('j/.claude/skills/x'), () => expect(lint('j', '/deploy\n')).toEqual([]))
    expect(lint('j', '/deploy\n')).toHaveLength(1)
  })

  it('reports nothing for a command that a skills folder it cannot list could answer', () => {
    put('i2/.claude/skills/other/SKILL.md', open)
    put('i2/.claude/commands/deploy.md', manual)
    mkdirSync(at('i2/.git'), { recursive: true })
    withoutAccess(at('i2/.claude/skills'), () => expect(lint('i2', '/deploy\n')).toEqual([]))
    expect(lint('i2', '/deploy\n')).toHaveLength(1)
  })

  it('reports nothing for a command folder that it cannot list', () => {
    put('k/.claude/commands/sub/x.md', open)
    put('k/.claude/commands/cmd.md', manual)
    mkdirSync(at('k/.git'), { recursive: true })
    withoutAccess(at('k/.claude/commands/sub'), () => expect(lint('k', '/cmd\n')).toEqual([]))
    expect(lint('k', '/cmd\n')).toHaveLength(1)
  })

  it('reports nothing when it cannot list the skills folder', () => {
    put('i/.claude/skills/deploy/SKILL.md', manual)
    mkdirSync(at('i/.git'), { recursive: true })
    withoutAccess(at('i/.claude/skills'), () => expect(lint('i', '/deploy\n')).toEqual([]))
    expect(lint('i', '/deploy\n')).toHaveLength(1)
  })
})
