// A `commands/` directory is a command only where Claude Code reads it:
// `.claude/commands/`, or `commands/` beside `.claude-plugin/plugin.json`.
// The plugin case needs a real manifest on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'command-legacy-format-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const legacy = [{ messageId: 'legacy', line: 1, column: 1 }]

markdownTester.run('command-legacy-format', ruleOf('command-legacy-format'), {
  valid: [
    // A `commands/` directory that Claude Code does not read.
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
    // A relative path resolves from the working directory.
    { code: '# A\n', filename: path.join('.claude', 'commands', 'a.md'), errors: legacy },
  ],
})

// The parent of a `commands/` directory at the file system root is the root,
// not the working directory. Run from a plugin root, to tell the two apart.
describe('with a plugin root as the working directory', () => {
  const cwd = process.cwd()
  beforeAll(() => process.chdir(plugin))
  afterAll(() => process.chdir(cwd))
  markdownTester.run('command-legacy-format', ruleOf('command-legacy-format'), {
    valid: [{ code: '# Doc\n', filename: `${path.sep}commands${path.sep}a.md` }],
    invalid: [],
  })
})
