// Claude Code finds a skill only as `skills/<name>/SKILL.md`. The rule sees
// two faults: a loose `.md` file in `skills/`, and a `skill.md` of the wrong
// case in a skill folder. The trees are on disk under
// tests/fixtures/skill-file-layout/. A plugin `skills/` directory counts only
// with a manifest, so `plugin/` has one and `notplugin/` has none.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-file-layout')
const at = (...parts: string[]) => path.join(fixtures, ...parts)
const skills = (...parts: string[]) => at('project', '.claude', 'skills', ...parts)

// A folder with both `SKILL.md` and `skill.md` needs a file system that keeps case.
const scratch = mkdtempSync(path.join(tmpdir(), 'skill-file-layout-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const both = path.join(scratch, '.claude', 'skills', 'both')
mkdirSync(both, { recursive: true })
writeFileSync(path.join(both, 'SKILL.md'), '# S\n')
writeFileSync(path.join(both, 'skill.md'), '# Notes\n')
const keepsCase =
  existsSync(path.join(both, 'SKILL.md')) && !existsSync(path.join(both, 'Skill.md'))

markdownTester.run('skill-file-layout', ruleOf('skill-file-layout'), {
  valid: [
    // Next to a `SKILL.md`, a `skill.md` is a file of the skill.
    ...(keepsCase ? [{ code: '# Notes\n', filename: path.join(both, 'skill.md') }] : []),
    // A skill in its folder, and a supporting file beside it.
    { code: '# S\n', filename: skills('ok', 'SKILL.md') },
    { code: '# R\n', filename: skills('ok', 'reference.md') },
    // A file deeper in the skill folder is a supporting file, even if named `skill.md`.
    { code: '# R\n', filename: skills('ok', 'references', 'skill.md') },
    { code: '# S\n', filename: at('plugin', 'skills', 'ok', 'SKILL.md') },
    // A README does not claim to be a skill.
    { code: '# R\n', filename: skills('README.md') },
    { code: '# R\n', filename: skills('readme.md') },
    // Not a skills directory: no `.claude/` parent, and no plugin manifest.
    { code: '# S\n', filename: at('notplugin', 'skills', 'loose.md') },
    { code: '# S\n', filename: at('notplugin', 'skills', 'wrong', 'skill.md') },
    { code: '# S\n', filename: at('docs', 'skills', 'loose.md') },
    { code: '# S\n', filename: 'skills/loose.md' },
    // A different directory name in `.claude/`.
    { code: '# S\n', filename: at('project', '.claude', 'commands', 'loose.md') },
  ],
  invalid: [
    {
      code: '# Loose\n',
      filename: skills('loose.md'),
      errors: [
        { messageId: 'loose', data: { file: 'loose.md', stem: 'loose' }, line: 1, column: 1 },
      ],
    },
    {
      code: '# Loose\n',
      filename: at('plugin', 'skills', 'loose.md'),
      errors: [{ messageId: 'loose', data: { file: 'loose.md', stem: 'loose' } }],
    },
    {
      code: '# Wrong\n',
      filename: skills('wrong', 'skill.md'),
      errors: [{ messageId: 'wrongCase', data: { file: 'skill.md' }, line: 1, column: 1 }],
    },
    {
      code: '# Wrong\n',
      filename: skills('wrong2', 'Skill.md'),
      errors: [{ messageId: 'wrongCase', data: { file: 'Skill.md' } }],
    },
    {
      code: '# Wrong\n',
      filename: at('plugin', 'skills', 'wrong', 'skill.md'),
      errors: [{ messageId: 'wrongCase' }],
    },
    // A folder that is not on disk has no `SKILL.md` beside the file.
    {
      code: '# Wrong\n',
      filename: skills('ghost', 'skill.md'),
      errors: [{ messageId: 'wrongCase' }],
    },
    // The rule does not read the file, so bad frontmatter changes nothing.
    {
      code: '---\nname: [unclosed\n---\n',
      filename: skills('loose.md'),
      errors: [{ messageId: 'loose' }],
    },
  ],
})
