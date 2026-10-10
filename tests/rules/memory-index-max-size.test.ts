// Claude Code loads the first 200 lines or 25KB of a `MEMORY.md` index, whichever comes first
// (https://code.claude.com/docs/en/sub-agents#enable-persistent-memory). YAML frontmatter and
// block-level HTML comments are removed before the index is loaded, so they are not counted
// (https://code.claude.com/docs/en/errors#memory-index-is-over-its-read-limit). The rule checks
// the lines and the bytes apart. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMemory, tree } from '../memory-tree.test-support.ts'

const RULE = 'memory-index-max-size'

const FILE = '.claude/agent-memory/reviewer/MEMORY.md'

/** A text of `count` lines, each ended by a newline. */
const lines = (count: number) => '- x\n'.repeat(count)

/** The messages for `code` as the file `file` of an empty tree. */
const lint = (code: string, options?: object, file = FILE) =>
  lintMemory(RULE, tree({}), file, code, options)

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

/** Text of exactly `bytes` bytes in one line, with a line end. */
const ofBytes = (bytes: number) => `${'x'.repeat(bytes - 1)}\n`

describe(`${RULE}: lines`, () => {
  it.fails('reports an index of 201 lines, at the start of the file', () => {
    const messages = lint(lines(201))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooManyLines',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('201 lines')
    expect(messages[0]?.message).toContain('200 lines')
  })

  it.fails('stays silent on an index of 200 lines', () => {
    expect(lint(lines(200))).toEqual([])
    expect(lint('')).toEqual([])
    expect(lint(lines(200).slice(0, -1))).toEqual([])
    expect(lint(`${lines(200)}y`)).toHaveLength(1)
  })

  it.fails('does not count the YAML frontmatter', () => {
    const front = '---\nname: reviewer\ndescription: notes\n---\n'
    expect(lint(front + lines(200))).toEqual([])
    expect(lint(front + lines(201))).toHaveLength(1)
    // A block that is not on line 1 is not frontmatter, and a block never closed is text.
    expect(ids(lint(`${lines(1)}${front}${lines(199)}`))).toEqual(['tooManyLines'])
    expect(ids(lint(`---\nname: x\n${lines(199)}`))).toEqual(['tooManyLines'])
  })

  it.fails('does not count a block-level HTML comment, of one line or more', () => {
    expect(lint(`<!-- a note -->\n${lines(200)}`)).toEqual([])
    expect(lint(`<!--\na note\non three lines\n-->\n${lines(200)}`)).toEqual([])
    expect(lint(`${lines(100)}  <!-- indented -->\n${lines(100)}`)).toEqual([])
    expect(lint(`> <!-- in a quote -->\n${lines(200)}`)).toEqual([])
    expect(lint(`- <!-- in a list -->\n${lines(200)}`)).toEqual([])
    // A comment that never ends removes the rest of the file.
    expect(lint(`<!-- open\n${lines(300)}`)).toEqual([])
    expect(ids(lint(`<!-- a note -->\n${lines(201)}`))).toEqual(['tooManyLines'])
  })

  it.fails('counts a comment that is inline, or in a code fence', () => {
    expect(ids(lint(`text <!-- inline -->\n${lines(200)}`))).toEqual(['tooManyLines'])
    expect(ids(lint(`\`\`\`\n<!-- code -->\n\`\`\`\n${lines(198)}`))).toEqual(['tooManyLines'])
  })

  it.fails('counts the frontmatter and the comment together', () => {
    expect(lint(`---\na: 1\n---\n<!-- c -->\n${lines(200)}`)).toEqual([])
    expect(lint(`---\na: 1\n---\n<!-- c -->\n${lines(201)}`)).toHaveLength(1)
  })
})

describe(`${RULE}: bytes`, () => {
  it.fails('reports an index of 25001 bytes, once, and says bytes', () => {
    const messages = lint(ofBytes(25001))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'tooManyBytes', line: 1, column: 1 })
    expect(messages[0]?.message).toContain('25001 bytes')
    expect(messages[0]?.message).toContain('25000 bytes')
  })

  it.fails('stays silent on an index of 25000 bytes', () => {
    expect(lint(ofBytes(25000))).toEqual([])
  })

  it.fails('counts bytes, not characters', () => {
    expect(lint(`${'é'.repeat(12499)}\n`)).toEqual([])
    expect(ids(lint(`${'é'.repeat(12500)}\n`))).toEqual(['tooManyBytes'])
  })

  it.fails('does not count the frontmatter or a block comment', () => {
    const front = `---\nnote: ${'y'.repeat(1000)}\n---\n`
    expect(lint(front + ofBytes(25000))).toEqual([])
    expect(lint(`<!-- ${'y'.repeat(1000)} -->\n${ofBytes(25000)}`)).toEqual([])
    expect(ids(lint(front + ofBytes(25001)))).toEqual(['tooManyBytes'])
  })

  it.fails('checks the lines and the bytes apart, with a report for each', () => {
    expect(ids(lint(`${'x'.repeat(100)}\n`.repeat(260)))).toEqual(['tooManyLines', 'tooManyBytes'])
    expect(ids(lint(`${'x'.repeat(100)}\n`.repeat(200)))).toEqual([])
    expect(ids(lint(`${'x'.repeat(200)}\n`.repeat(150)))).toEqual(['tooManyBytes'])
  })
})

describe(`${RULE}: files and options`, () => {
  it.fails('checks the MEMORY.md of each subagent, in any folder with .claude/agent-memory', () => {
    for (const file of [
      '.claude/agent-memory/a/MEMORY.md',
      'packages/web/.claude/agent-memory/b-c/MEMORY.md',
    ]) {
      expect(ids(lint(lines(201), undefined, file)), file).toEqual(['tooManyLines'])
    }
  })

  it.fails('does not check another file', () => {
    for (const file of [
      '.claude/agent-memory/a/topic.md',
      '.claude/agent-memory/MEMORY.md',
      '.claude/agent-memory/a/b/MEMORY.md',
      '.claude/agent-memory-local/a/MEMORY.md',
      'MEMORY.md',
      'CLAUDE.md',
    ]) {
      expect(lint(lines(201), undefined, file), file).toEqual([])
    }
  })

  it.fails('moves each limit with its option, and names it in the message', () => {
    expect(lint(lines(3), { maxLines: 3 })).toEqual([])
    const lineMessages = lint(lines(4), { maxLines: 3 })
    expect(ids(lineMessages)).toEqual(['overConfiguredLines'])
    expect(lineMessages[0]?.message).toBe(
      'This index has 4 lines. The configured limit is 3 lines.',
    )
    expect(lint(ofBytes(100), { maxBytes: 100 })).toEqual([])
    const byteMessages = lint(ofBytes(101), { maxBytes: 100 })
    expect(ids(byteMessages)).toEqual(['overConfiguredBytes'])
    expect(byteMessages[0]?.message).toBe(
      'This index has 101 bytes. The configured limit is 100 bytes.',
    )
    // One option leaves the other at the default.
    expect(ids(lint(lines(201), { maxBytes: 100 }))).toEqual([
      'tooManyLines',
      'overConfiguredBytes',
    ])
  })

  it.fails('accepts an integer from 1 to the documented limit, and nothing else', () => {
    expect(() => lint('x\n', { maxLines: 200, maxBytes: 25000 })).not.toThrow()
    expect(() => lint('x\n', { maxLines: 1, maxBytes: 1 })).not.toThrow()
    expect(() => lint('x\n', { maxLines: 201 })).toThrow()
    expect(() => lint('x\n', { maxBytes: 25001 })).toThrow()
    expect(() => lint('x\n', { maxLines: 0 })).toThrow()
    expect(() => lint('x\n', { maxBytes: 1.5 })).toThrow()
    expect(() => lint('x\n', { max: 1 })).toThrow()
  })
})
