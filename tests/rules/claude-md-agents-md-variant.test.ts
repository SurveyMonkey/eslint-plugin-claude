// Claude Code never reads `AGENTS.local.md`, `AGENTS.override.md` or a file below a `.agents/`
// directory (https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md). The
// files glob is in tests/configs.test.ts. A path in these cases sits in the working directory
// of the test, so a relative `allow` entry names it.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('claude-md-agents-md-variant')

const notes = '# Notes\n'
const variant = { messageId: 'variant' as const, line: 1, column: 1 }

markdownTester.run('claude-md-agents-md-variant', rule, {
  valid: [
    // The files that Claude Code reads.
    { code: notes, filename: 'AGENTS.md' },
    { code: notes, filename: '.claude/AGENTS.md' },
    { code: notes, filename: 'CLAUDE.md' },
    { code: notes, filename: 'CLAUDE.local.md' },
    // Names that are close to a variant, and other files below `.agents` that are not Markdown.
    { code: notes, filename: 'docs/AGENTS.local.md.bak' },
    { code: notes, filename: 'agents.local.md' },
    { code: notes, filename: 'AGENTS-local.md' },
    { code: notes, filename: 'docs/agents/notes.md' },
    { code: notes, filename: 'docs/AGENTS-notes.md' },
    { code: notes, filename: '.agents.md' },
    { code: notes, filename: '.agents-extra/notes.md', options: [{ allow: ['.agents'] }] },
    { code: notes, filename: 'agents/skills/x/SKILL.md' },
    // The option `allow`: a file, a directory, a directory with a different form of the path.
    { code: notes, filename: 'AGENTS.override.md', options: [{ allow: ['AGENTS.override.md'] }] },
    { code: notes, filename: 'AGENTS.override.md', options: [{ allow: ['./AGENTS.override.md'] }] },
    { code: notes, filename: '.agents/skills/x/SKILL.md', options: [{ allow: ['.agents'] }] },
    { code: notes, filename: '.agents/skills/x/SKILL.md', options: [{ allow: ['.agents/'] }] },
    {
      code: notes,
      filename: '.agents/skills/x/SKILL.md',
      options: [{ allow: ['.agents\\skills'] }],
    },
    {
      code: notes,
      filename: 'packages/web/AGENTS.local.md',
      options: [{ allow: ['AGENTS.local.md', 'packages/web/AGENTS.local.md'] }],
    },
  ],
  invalid: [
    { code: notes, filename: 'AGENTS.local.md', errors: [variant] },
    { code: notes, filename: 'AGENTS.override.md', errors: [variant] },
    { code: notes, filename: 'packages/web/AGENTS.override.md', errors: [variant] },
    { code: notes, filename: '.agents/notes.md', errors: [variant] },
    { code: notes, filename: '.agents/skills/x/SKILL.md', errors: [variant] },
    { code: notes, filename: 'packages/web/.agents/rules.md', errors: [variant] },
    // An `allow` entry that names another file, a sibling with a longer name, or a parent.
    { code: notes, filename: 'AGENTS.local.md', options: [{ allow: [] }], errors: [variant] },
    {
      code: notes,
      filename: 'AGENTS.local.md',
      options: [{ allow: ['AGENTS.override.md'] }],
      errors: [variant],
    },
    {
      code: notes,
      filename: '.agents/skills/x/SKILL.md',
      options: [{ allow: ['.agents/skills/y', 'skills'] }],
      errors: [variant],
    },
    { code: notes, filename: 'AGENTS.local.md', options: [{ allow: [''] }], errors: [variant] },
  ],
})

describe('claude-md-agents-md-variant message and schema', () => {
  const lint = (options: object[], filename = 'AGENTS.local.md') =>
    new Linter().verify(
      notes,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          rules: { 'claude/claude-md-agents-md-variant': ['error', ...options] },
        },
      ],
      { filename },
    )

  it('says that Claude Code never reads the file, and where it reads instructions', () => {
    expect(lint([]).map((m) => m.message)).toEqual([
      'Claude Code never reads this file. It reads `AGENTS.md` and `.claude/AGENTS.md`. Move the text there, or list the path in the option `allow` if another tool reads it.',
    ])
  })
  it('accepts an empty object and a list of strings', () => {
    expect(lint([{}])).toHaveLength(1)
    expect(lint([{ allow: ['AGENTS.local.md'] }])).toEqual([])
  })
  it('refuses an unknown key, a value that is not a list, and an entry that is not a string', () => {
    expect(() => lint([{ list: [] }])).toThrow()
    expect(() => lint([{ allow: 'AGENTS.local.md' }])).toThrow()
    expect(() => lint([{ allow: [1] }])).toThrow()
  })
})
