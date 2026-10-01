// Names that Claude Code reserves for skills synced from claude.ai: a skill
// folder `synced`, and `anthropic-skills` in a folder, a frontmatter `name`
// or a command path. A plugin is out of scope. The plugin case needs a real
// manifest on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-reserved-name-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const skillIn = (folder: string) => `.claude/skills/${folder}/SKILL.md`
const named = (value: string, filename = skillIn('s')) => ({
  code: `---\nname: ${value}\n---\n\n# S\n`,
  filename,
})

markdownTester.run('skill-reserved-name', ruleOf('skill-reserved-name'), {
  valid: [
    // `synced` is reserved as a skill folder only.
    named('synced'),
    named('deploy'),
    named('anthropic'),
    named('my-anthropic-skills'),
    { code: '# S\n', filename: skillIn('deploy') },
    { code: '# S\n', filename: skillIn('synced-files') },
    { code: '# S\n', filename: skillIn('anthropic-skills-notes') },
    { code: '# C\n', filename: '.claude/commands/deploy.md' },
    { code: '# C\n', filename: '.claude/commands/synced.md' },
    { code: '# C\n', filename: '.claude/commands/ops/deploy.md' },
    // Only a file or folder directly in `commands/` is reserved.
    { code: '# C\n', filename: '.claude/commands/ops/anthropic-skills.md' },
    { code: '# C\n', filename: '.claude/commands/ops/anthropic-skills/x.md' },
    { code: '# C\n', filename: '.claude/commands/anthropic-skillset/x.md' },
    // A command file has no `name` field, so the rule reads none.
    { ...named('anthropic-skills', '.claude/commands/c.md') },
    // The frontmatter `name` is not a string.
    named('[anthropic-skills]'),
    named('3'),
    { code: '---\nname: [unclosed\n---\n', filename: skillIn('s') },
    // Not a skill or command file.
    { code: '# S\n', filename: 'docs/synced/SKILL.md' },
    { code: '# S\n', filename: path.join(scratch, 'anthropic-skills', 'SKILL.md') },
    // A plugin may use each name.
    { code: '# S\n', filename: path.join(plugin, 'skills', 'synced', 'SKILL.md') },
    { code: '# S\n', filename: path.join(plugin, 'skills', 'anthropic-skills', 'SKILL.md') },
    named('anthropic-skills', path.join(plugin, 'skills', 's', 'SKILL.md')),
    { code: '# C\n', filename: path.join(plugin, 'commands', 'anthropic-skills.md') },
  ],
  invalid: [
    ...['synced', 'Synced', 'SYNCED'].map((folder) => ({
      code: '# S\n',
      filename: skillIn(folder),
      errors: [{ messageId: 'folder' as const, data: { name: folder }, line: 1, column: 1 }],
    })),
    ...['anthropic-skills', 'anthropic-skills:pdf'].map((folder) => ({
      code: '# S\n',
      filename: skillIn(folder),
      errors: [{ messageId: 'folder' as const, data: { name: folder } }],
    })),
    {
      ...named('anthropic-skills'),
      errors: [
        {
          messageId: 'name',
          data: { name: 'anthropic-skills' },
          line: 2,
          column: 7,
          endColumn: 23,
        },
      ],
    },
    {
      ...named('anthropic-skills:pdf'),
      errors: [{ messageId: 'name', data: { name: 'anthropic-skills:pdf' }, line: 2 }],
    },
    // The folder and the `name` can each be reserved.
    {
      ...named('anthropic-skills', skillIn('synced')),
      errors: [{ messageId: 'folder' }, { messageId: 'name' }],
    },
    {
      code: '# C\n',
      filename: '.claude/commands/anthropic-skills.md',
      errors: [{ messageId: 'command', data: { name: 'anthropic-skills' }, line: 1, column: 1 }],
    },
    {
      code: '# C\n',
      filename: '.claude/commands/anthropic-skills:pdf.md',
      errors: [{ messageId: 'command', data: { name: 'anthropic-skills:pdf' } }],
    },
    {
      code: '# C\n',
      filename: '.claude/commands/anthropic-skills/pdf.md',
      errors: [{ messageId: 'command', data: { name: 'anthropic-skills' } }],
    },
    {
      code: '# C\n',
      filename: '.claude/commands/anthropic-skills/ops/x.md',
      errors: [{ messageId: 'command', data: { name: 'anthropic-skills' } }],
    },
  ],
})
