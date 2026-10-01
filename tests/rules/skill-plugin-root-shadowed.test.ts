// A `SKILL.md` at the plugin root loads only when the plugin has no `skills/`
// directory and `plugin.json` has no `skills` key. The trees are on disk
// under tests/fixtures/skill-plugin-root-shadowed/. The malformed manifest is
// built at run time, because a committed file would fail the JSON lint.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-plugin-root-shadowed')
const rootSkill = (tree: string) => path.join(fixtures, tree, 'SKILL.md')

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-root-shadowed-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const build = (tree: string, manifest: string, extra?: string) => {
  const root = path.join(scratch, tree)
  mkdirSync(path.join(root, '.claude-plugin'), { recursive: true })
  writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), manifest)
  if (extra !== undefined) {
    writeFileSync(path.join(root, extra), '')
  }
  return path.join(root, 'SKILL.md')
}

const code = '---\nname: p\n---\n\n# P\n'

markdownTester.run('skill-plugin-root-shadowed', ruleOf('skill-plugin-root-shadowed'), {
  valid: [
    // The plugin has no `skills/` directory and no `skills` key.
    { code, filename: rootSkill('alone') },
    // The manifest does not parse, so no key is read.
    { code, filename: build('bad-json', '{') },
    { code, filename: build('not-an-object', '[]') },
    // `skills` is a file here, not a directory, and the manifest has no key.
    { code, filename: build('skills-file', '{}', 'skills') },
    // A skill in `skills/` is not the root skill.
    { code: '# R\n', filename: path.join(fixtures, 'with-both', 'skills', 'review', 'SKILL.md') },
    // No plugin manifest: not a plugin root.
    { code: '# S\n', filename: rootSkill('not-a-plugin') },
    // Not a skill file.
    { code: '# S\n', filename: path.join(scratch, 'docs', 'SKILL.md') },
    { code: '# S\n', filename: '.claude/skills/s/SKILL.md' },
  ],
  invalid: [
    {
      code,
      filename: rootSkill('with-dir'),
      errors: [{ messageId: 'directory', line: 1, column: 1 }],
    },
    {
      code,
      filename: rootSkill('with-key'),
      errors: [{ messageId: 'manifest', line: 1, column: 1 }],
    },
    {
      code,
      filename: rootSkill('with-both'),
      errors: [{ messageId: 'directory' }, { messageId: 'manifest' }],
    },
    // The rule does not read the frontmatter, so bad YAML changes nothing.
    {
      code: '---\nname: [unclosed\n---\n',
      filename: rootSkill('with-dir'),
      errors: [{ messageId: 'directory' }],
    },
    // A `skills` key with no value still replaces the default scan.
    {
      code,
      filename: build('null-key', '{"skills": null}'),
      errors: [{ messageId: 'manifest' }],
    },
  ],
})
