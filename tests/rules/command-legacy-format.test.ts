// The rule reports a file under `.claude/commands/`, or under `commands/`
// beside `.claude-plugin/plugin.json`.
// The plugin case needs a real manifest on disk.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'command-legacy-format-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const legacy = [{ messageId: 'legacy', line: 1, column: 1 }]

markdownTester.run('command-legacy-format', ruleOf('command-legacy-format'), {
  valid: [
    // A `commands/` directory in another place.
    { code: '# Doc\n', filename: path.join(scratch, 'docs', 'commands', 'a.md') },
    { code: '# Doc\n', filename: path.join(plugin, 'skills', 'commands', 'a.md') },
    { code: '# Doc\n', filename: path.join(scratch, 'commands.md') },
    // A `commands/` directory at the file system root, with no manifest there.
    { code: '# Doc\n', filename: `${path.sep}commands${path.sep}a.md` },
    { code: '# Skill\n', filename: path.join(plugin, 'skills', 's', 'SKILL.md') },
  ],
  invalid: [
    {
      code: '---\ndescription: x\n---\n',
      filename: path.join(scratch, '.claude', 'commands', 'a.md'),
      errors: legacy,
    },
    {
      code: '# A\n',
      filename: path.join(scratch, '.claude', 'commands', 'ns', 'a.md'),
      errors: legacy,
    },
    { code: '# A\n', filename: path.join(plugin, 'commands', 'a.md'), errors: legacy },
    // A later `commands/` directory counts when an earlier one does not.
    {
      code: '# A\n',
      filename: path.join(scratch, 'commands', 'x', '.claude', 'commands', 'a.md'),
      errors: legacy,
    },
    { code: '# A\n', filename: path.join('.claude', 'commands', 'a.md'), errors: legacy },
  ],
})

// Run from a plugin root. A relative path resolves from the working
// directory. The parent of a `commands/` directory at the file system root is
// the root, not the working directory.
describe('with a plugin root as the working directory', () => {
  const cwd = process.cwd()
  beforeAll(() => process.chdir(plugin))
  afterAll(() => process.chdir(cwd))
  markdownTester.run('command-legacy-format', ruleOf('command-legacy-format'), {
    valid: [{ code: '# Doc\n', filename: `${path.sep}commands${path.sep}a.md` }],
    invalid: [{ code: '# A\n', filename: path.join('commands', 'a.md'), errors: legacy }],
  })
})

// A plugin root that the rule cannot see is not a `commands/` directory to judge. The walk
// stops there, and does not go on to a `.claude/commands/` directory below it.
describe('a plugin root that the rule cannot see', () => {
  const lint = (file: string) => lintMarkdown('command-legacy-format', '# A\n', file)

  it.skipIf(chmodCannotBlock)('makes no report with no access to .claude-plugin/', () => {
    const meta = path.join(scratch, 'deny', '.claude-plugin')
    mkdirSync(meta, { recursive: true })
    writeFileSync(path.join(meta, 'plugin.json'), '{}')
    const nested = path.join(scratch, 'deny', 'commands', '.claude', 'commands', 'a.md')
    expect(lint(path.join(scratch, 'deny', 'commands', 'a.md'))).toHaveLength(1)
    withoutAccess(meta, () => {
      expect(lint(path.join(scratch, 'deny', 'commands', 'a.md'))).toEqual([])
      expect(lint(nested)).toEqual([])
    })
  })

  it.skipIf(process.platform === 'win32')(
    'makes no report when .claude-plugin/ is a link out of the repository',
    () => {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'elsewhere'))
      writeFileSync(path.join(scratch, 'elsewhere', 'plugin.json'), '{}')
      symlinkSync(path.join(scratch, 'elsewhere'), path.join(scratch, 'repo', '.claude-plugin'))
      expect(lint(path.join(scratch, 'repo', 'commands', 'a.md'))).toEqual([])
    },
  )
})
