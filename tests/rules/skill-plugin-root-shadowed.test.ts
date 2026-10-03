// A `SKILL.md` at the plugin root loads only when the plugin has no `skills/`
// directory and `plugin.json` has no `skills` key. The trees are on disk
// under tests/fixtures/skill-plugin-root-shadowed/. The malformed manifest is
// built at run time, because a committed file would fail the JSON lint.
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

// A `skills/` that is a link to a directory is a directory.
const linked = build('linked', '{"name": "l"}')
mkdirSync(path.join(scratch, 'linked-target', 'review'), { recursive: true })
symlinkSync(path.join(scratch, 'linked-target'), path.join(scratch, 'linked', 'skills'))

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
    // A skill folder that has a `skills/` folder of its own is not a plugin root.
    {
      code: '# R\n',
      filename: path.join(fixtures, 'with-dir', 'skills', 'review', 'SKILL.md'),
    },
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
    { code, filename: linked, errors: [{ messageId: 'directory' }] },
    // A `skills` key with no value still stops the root `SKILL.md` from loading.
    {
      code,
      filename: build('null-key', '{"skills": null}'),
      errors: [{ messageId: 'manifest' }],
    },
  ],
})

// A read that fails with `EACCES` is not a missing file. The rule makes no report that
// rests on a path that it cannot read.
describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
  const lint = (file: string) => lintMarkdown('skill-plugin-root-shadowed', code, file)

  it('makes no report for a manifest that it cannot read', () => {
    const file = build('deny-manifest', '{"skills": "./x"}')
    expect(lint(file)).toHaveLength(1)
    const manifest = path.join(scratch, 'deny-manifest', '.claude-plugin', 'plugin.json')
    withoutAccess(manifest, () => expect(lint(file)).toEqual([]))
    withoutAccess(path.dirname(manifest), () => expect(lint(file)).toEqual([]))
  })

  it('makes no report for a plugin root that it cannot search', () => {
    const file = build('deny-root', '{"skills": "./x"}')
    mkdirSync(path.join(scratch, 'deny-root', 'skills'))
    expect(lint(file)).toHaveLength(2)
    withoutAccess(path.join(scratch, 'deny-root'), () => expect(lint(file)).toEqual([]))
  })

  it.skipIf(process.platform === 'win32')(
    'makes no report for a skills entry that fails with a code other than a missing file',
    () => {
      const file = build('deny-loop', '{}')
      // A link to itself fails with `ELOOP`, so the rule cannot tell if it is a directory.
      symlinkSync('skills', path.join(scratch, 'deny-loop', 'skills'))
      expect(lint(file)).toEqual([])
    },
  )

  it('still reports a skills directory that it cannot list', () => {
    const file = build('deny-skills', '{}')
    mkdirSync(path.join(scratch, 'deny-skills', 'skills'))
    withoutAccess(path.join(scratch, 'deny-skills', 'skills'), () =>
      expect(lint(file)).toHaveLength(1),
    )
  })
})

// The rule cannot read the manifest behind a dangling link, so it makes no `manifest` report.
// The `directory` report does not need the manifest.
describe.skipIf(process.platform === 'win32')('a plugin.json that is a dangling link', () => {
  it('makes no manifest report, and still makes the directory report', () => {
    const file = build('dangling', '')
    mkdirSync(path.join(scratch, 'dangling', 'skills'))
    const manifest = path.join(scratch, 'dangling', '.claude-plugin', 'plugin.json')
    rmSync(manifest)
    symlinkSync('missing.json', manifest)
    const messages = lintMarkdown('skill-plugin-root-shadowed', code, file).map((m) => m.messageId)
    expect(messages).toEqual(['directory'])
  })
})
