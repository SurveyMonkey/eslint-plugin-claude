// Claude Code loads a CLAUDE.md file of up to 4 MiB in full, and skips a larger file. The
// expected sizes are worked out by hand from that number: 4 MiB is 4194304 bytes. The files
// glob is in tests/configs.test.ts.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('claude-md-max-bytes')

const LIMIT = 4 * 1024 * 1024

/** Markdown of exactly `bytes` bytes: one HTML comment, the cheapest text to parse. */
const ofBytes = (bytes: number) => `<!--${'x'.repeat(bytes - 7)}-->`

const root = '/repo/CLAUDE.md'
const dotClaude = '/repo/.claude/CLAUDE.md'
const local = '/repo/CLAUDE.local.md'

markdownTester.run('claude-md-max-bytes', rule, {
  valid: [
    { code: '# Project\n', filename: root },
    // Exactly 4 MiB is within the limit, in each file that Claude Code reads.
    { name: 'at the limit, root file', code: ofBytes(LIMIT), filename: root },
    { name: 'at the limit, .claude file', code: ofBytes(LIMIT), filename: dotClaude },
    { name: 'at the limit, local file', code: ofBytes(LIMIT), filename: local },
    // A custom limit: at it, silent.
    { code: ofBytes(100), filename: root, options: [{ max: 100 }] },
    // The count is of bytes, not characters. 1,000 two-byte letters are 2,000 bytes.
    { code: 'é'.repeat(1000), filename: root, options: [{ max: 2000 }] },
    // The parser removes a byte order mark before the rule runs, so the rule does not count it.
    { code: `﻿${ofBytes(100)}`, filename: root, options: [{ max: 100 }] },
    // A file that Claude Code does not read as a CLAUDE.md. The docs name CLAUDE.md files only,
    // so `AGENTS.md` is left out. A rule file is not a CLAUDE.md file either.
    {
      name: 'over the limit, not read: docs/CLAUDE-notes.md',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/docs/CLAUDE-notes.md',
    },
    {
      name: 'over the limit, not read: AGENTS.md',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/AGENTS.md',
    },
    {
      name: 'over the limit, not read: claude.md',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/claude.md',
    },
    {
      name: 'over the limit, not read: .claude/rules/CLAUDE.md',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/.claude/rules/CLAUDE.md',
    },
    {
      name: 'over the limit, not read: .claude/rules/big.md',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/.claude/rules/big.md',
    },
  ],
  invalid: [
    // One byte over the limit. The report is at the start of the file.
    {
      name: 'one byte over the limit, root file',
      code: ofBytes(LIMIT + 1),
      filename: root,
      errors: [{ messageId: 'tooLarge', line: 1, column: 1 }],
    },
    {
      name: 'one byte over, .claude file',
      code: ofBytes(LIMIT + 1),
      filename: dotClaude,
      errors: [{ messageId: 'tooLarge' }],
    },
    {
      name: 'one byte over, local file',
      code: ofBytes(LIMIT + 1),
      filename: local,
      errors: [{ messageId: 'tooLarge' }],
    },
    {
      name: 'one byte over, nested file',
      code: ofBytes(LIMIT + 1),
      filename: '/repo/packages/web/CLAUDE.md',
      errors: [{ messageId: 'tooLarge' }],
    },
    // An explicit limit equal to the default gives the same message as the default.
    {
      name: 'limit set to the default',
      code: ofBytes(LIMIT + 1),
      filename: root,
      options: [{ max: LIMIT }],
      errors: [{ messageId: 'tooLarge' }],
    },
    // A custom limit: one byte over.
    {
      code: ofBytes(101),
      filename: root,
      options: [{ max: 100 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
    // Two-byte letters: 1,001 characters, 2,002 bytes, over a limit of 2,000 bytes.
    {
      code: 'é'.repeat(1001),
      filename: root,
      options: [{ max: 2000 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
    // A byte order mark is not counted, so one byte more than the limit is still needed.
    {
      code: `﻿${ofBytes(101)}`,
      filename: root,
      options: [{ max: 100 }],
      errors: [{ messageId: 'overConfiguredLimit' }],
    },
  ],
})

// The text of each message.
markdownTester.run('claude-md-max-bytes (message text)', rule, {
  valid: [],
  invalid: [
    {
      name: 'default message text',
      code: ofBytes(LIMIT + 1),
      filename: root,
      errors: [
        {
          message:
            'This file has 4194305 bytes. Claude Code skips a CLAUDE.md file of more than 4194304 bytes.',
        },
      ],
    },
    {
      code: ofBytes(101),
      filename: root,
      options: [{ max: 100 }],
      errors: [{ message: 'This file has 101 bytes. The configured limit is 100 bytes.' }],
    },
  ],
})

// The schema of the option `max`: an integer from 1 to 4194304, and no other key.
describe('claude-md-max-bytes option schema', () => {
  const lint = (options: object[], code = '# P\n') =>
    new Linter({ cwd: '/' }).verify(
      code,
      [
        {
          files: ['**/*.md'],
          plugins: { markdown, claude: plugin },
          language: 'markdown/gfm',
          rules: { 'claude/claude-md-max-bytes': ['error', ...options] },
        },
      ],
      { filename: '/repo/CLAUDE.md' },
    )

  it('accepts an empty object and each integer from 1 to 4194304', () => {
    expect(lint([{}])).toEqual([])
    expect(lint([{ max: 1 }])).toHaveLength(1)
    expect(lint([{ max: LIMIT }])).toEqual([])
  })
  it('applies the default limit beside an empty object', () => {
    expect(lint([{}], ofBytes(LIMIT + 1))).toHaveLength(1)
  })
  it('refuses 0, a fraction, a value above 4194304, and an unknown key', () => {
    expect(() => lint([{ max: 0 }])).toThrow()
    expect(() => lint([{ max: 1.5 }])).toThrow()
    expect(() => lint([{ max: LIMIT + 1 }])).toThrow()
    expect(() => lint([{ min: 1 }])).toThrow()
  })
})
