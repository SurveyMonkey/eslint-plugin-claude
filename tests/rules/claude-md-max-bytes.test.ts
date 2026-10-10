// Claude Code loads a CLAUDE.md file of up to 4 MiB in full, and skips a larger file. The
// expected sizes are worked out by hand from that number: 4 MiB is 4194304 bytes.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const LIMIT = 4 * 1024 * 1024
/** Text of exactly `bytes` bytes. */
const ofBytes = (bytes: number) => 'x'.repeat(bytes)
const lint = (code: string, filename = '/repo/CLAUDE.md') =>
  lintMarkdown('claude-md-max-bytes', code, filename)

describe('claude-md-max-bytes', () => {
  it.fails('reports a CLAUDE.md of one byte over 4 MiB at line 1', () => {
    expect(lint(ofBytes(LIMIT + 1)).map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['tooLarge', 1, 1],
    ])
  })

  it.fails('stays silent on a CLAUDE.md of exactly 4 MiB', () => {
    expect(lint(ofBytes(LIMIT))).toEqual([])
  })
})
