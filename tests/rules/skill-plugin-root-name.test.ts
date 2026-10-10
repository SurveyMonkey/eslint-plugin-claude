// The `SKILL.md` at the root of a plugin sets `name`. Otherwise a marketplace install names the
// skill after its cache directory. Each case writes its tree to a temporary directory, because
// the plugin root is found by its manifest.
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

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-root-name-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

put('plug/.claude-plugin/plugin.json', '{}')
const root = put('plug/SKILL.md', '')
const folder = put('plug/skills/s/SKILL.md', '')
const command = put('plug/commands/SKILL.md', '')
const project = put('proj/.claude/skills/s/SKILL.md', '')
// A directory with a `SKILL.md` and no manifest.
const noManifest = put('plain/SKILL.md', '')
// A plugin with `skills/`, so Claude Code does not load the root file. `skill-plugin-root-shadowed`
// reports that. This rule reports the missing name all the same.
put('shadow/.claude-plugin/plugin.json', '{}')
mkdirSync(path.join(scratch, 'shadow', 'skills'))
const shadowed = path.join(scratch, 'shadow', 'SKILL.md')

const missing = (extra: object = {}) => ({ messageId: 'missing' as const, ...extra })
const start = { line: 1, column: 1 }

markdownTester.run('skill-plugin-root-name', ruleOf('skill-plugin-root-name'), {
  valid: [
    { code: '---\nname: review\ndescription: d\n---\n', filename: root },
    // YAML that does not parse is a fault of another rule.
    { code: '---\nname: [unclosed\n---\n', filename: root },
    { code: '---\n[a, b]\n---\n', filename: root },
    // A `name` that is not a string is a fault of the schema rule.
    { code: '---\nname: 5\n---\n', filename: root },
    { code: '---\nname: [a]\n---\n', filename: root },
    // A skill in a folder gets its name from the folder.
    { code: '---\ndescription: d\n---\n', filename: folder },
    { code: '# S\n', filename: folder },
    // A project skill, and a file below `commands/`.
    { code: '# S\n', filename: project },
    { code: '# S\n', filename: command },
    // A directory with no manifest is not a plugin root.
    { code: '# S\n', filename: noManifest },
    // Not a skill file.
    { code: '# S\n', filename: 'docs/SKILL.md' },
  ],
  invalid: [
    {
      code: '---\ndescription: d\n---\n',
      filename: root,
      errors: [missing({ line: 1, column: 1, endLine: 3, endColumn: 4 })],
    },
    // No frontmatter at all.
    { code: '# S\n', filename: root, errors: [missing(start)] },
    { code: '', filename: root, errors: [missing(start)] },
    // A block with no content, or with only a comment.
    { code: '---\n---\n', filename: root, errors: [missing()] },
    { code: '---\n# a comment\n---\n', filename: root, errors: [missing()] },
    // An empty or blank name, and a null one.
    {
      code: '---\nname: ""\n---\n',
      filename: root,
      errors: [missing({ line: 2, column: 1, endLine: 2, endColumn: 9 })],
    },
    { code: '---\nname: "  "\n---\n', filename: root, errors: [missing({ line: 2 })] },
    { code: '---\nname:\n---\n', filename: root, errors: [missing({ line: 2, column: 1 })] },
    { code: '---\nname: ~\n---\n', filename: root, errors: [missing({ line: 2 })] },
    { code: '---\ndescription: d\n---\n', filename: shadowed, errors: [missing()] },
  ],
})

describe('a plugin root that the rule cannot see', () => {
  const lint = (file: string) => lintMarkdown('skill-plugin-root-name', '# S\n', file)

  it.skipIf(process.platform === 'win32')(
    'makes no report for a link out of the repository',
    () => {
      mkdirSync(path.join(scratch, 'lrepo', '.git'), { recursive: true })
      put('lrepo/real/.claude-plugin/plugin.json', '{}')
      put('lout/.claude-plugin/plugin.json', '{}')
      symlinkSync('../lout', path.join(scratch, 'lrepo', 'plug'))
      expect(lint(path.join(scratch, 'lrepo', 'plug', 'SKILL.md'))).toEqual([])
      expect(lint(path.join(scratch, 'lrepo', 'real', 'SKILL.md'))).toHaveLength(1)
    },
  )

  it.skipIf(chmodCannotBlock)('makes no report for a manifest directory it cannot read', () => {
    const file = put('deny/SKILL.md', '')
    put('deny/.claude-plugin/plugin.json', '{}')
    expect(lint(file)).toHaveLength(1)
    withoutAccess(path.join(scratch, 'deny', '.claude-plugin'), () =>
      expect(lint(file)).toEqual([]),
    )
  })
})
