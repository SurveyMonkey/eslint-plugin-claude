// Claude Code shows a warning at startup and in `/status` for an instruction file that is over
// the recommended length of 200 lines. Each CLAUDE.md, rule file and `@path` import counts as a
// separate file (https://code.claude.com/docs/en/memory#my-claude-md-is-too-large). The rule
// counts the lines of the linted file. It follows the imports on disk and counts the lines of
// each file that loads. A file that another rule of the group lints on its own is left to that
// rule. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'

const RULE = 'claude-md-max-lines'

/** A text of `count` lines, each ended by a newline. */
const lines = (count: number) => 'x\n'.repeat(count)

/** The messages for `code` as the file `file` of the tree `files`. */
function lint(code: string, file = 'CLAUDE.md', options?: object, files = {}) {
  return lintMemory(RULE, tree(files), file, code, options)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a file of 201 lines, at the start of the file', () => {
    const messages = lint(lines(201))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tooLong',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('201 lines')
    expect(messages[0]?.message).toContain('200 lines')
  })

  it('stays silent on a file of 200 lines', () => {
    expect(lint(lines(200))).toEqual([])
    expect(lint('')).toEqual([])
    expect(lint('# Project\n')).toEqual([])
  })

  it('counts a last line with no line end, and does not count the line end itself', () => {
    expect(lint(`${lines(200)}y`)).toHaveLength(1)
    expect(lint(lines(200).slice(0, -1))).toEqual([])
    expect(lint(lines(200).replaceAll('\n', '\r\n'))).toEqual([])
    expect(lint(lines(201).replaceAll('\n', '\r\n'))).toHaveLength(1)
  })

  it('counts every line of the file, with its frontmatter and its blank lines', () => {
    expect(lint(`---\nname: x\n---\n${'\n'.repeat(197)}`)).toEqual([])
    expect(lint(`---\nname: x\n---\n${'\n'.repeat(198)}`)).toHaveLength(1)
  })

  it('checks each file that holds instructions for a project', () => {
    for (const file of [
      'CLAUDE.md',
      '.claude/CLAUDE.md',
      'CLAUDE.local.md',
      'AGENTS.md',
      '.claude/AGENTS.md',
      'packages/web/CLAUDE.md',
    ]) {
      expect(ids(lint(lines(201), file)), file).toEqual(['tooLong'])
    }
  })

  it('does not check a file that another rule checks, or that Claude Code never reads', () => {
    for (const file of [
      '.claude/rules/CLAUDE.md',
      '.claude/rules/AGENTS.md',
      '.claude/rules/long.md',
      'AGENTS.local.md',
      'AGENTS.override.md',
      '.agents/AGENTS.md',
      'docs/notes.md',
      'claude.md',
    ]) {
      expect(lint(lines(201), file), file).toEqual([])
    }
  })
})

describe(`${RULE}: the option max`, () => {
  it('moves the limit, and names it in the message', () => {
    expect(lint(lines(3), 'CLAUDE.md', { max: 3 })).toEqual([])
    const messages = lint(lines(4), 'CLAUDE.md', { max: 3 })
    expect(ids(messages)).toEqual(['overConfiguredLimit'])
    expect(messages[0]?.message).toBe('This file has 4 lines. The configured limit is 3 lines.')
    expect(lint(lines(201), 'CLAUDE.md', { max: 300 })).toEqual([])
    expect(ids(lint(lines(201), 'CLAUDE.md', {}))).toEqual(['tooLong'])
  })

  it('accepts an integer from 1 up, with no maximum, and nothing else', () => {
    expect(() => lint('x\n', 'CLAUDE.md', { max: 1 })).not.toThrow()
    expect(() => lint('x\n', 'CLAUDE.md', { max: 100000 })).not.toThrow()
    expect(() => lint('x\n', 'CLAUDE.md', { max: 0 })).toThrow()
    expect(() => lint('x\n', 'CLAUDE.md', { max: 1.5 })).toThrow()
    expect(() => lint('x\n', 'CLAUDE.md', { min: 1 })).toThrow()
  })
})

describe(`${RULE}: the imported files`, () => {
  const long = { 'docs/long.md': lines(201), 'docs/short.md': lines(200) }

  it('reports a long file that an import loads, at the import', () => {
    const messages = lint('# Notes\n\nSee @docs/long.md for more.\n', 'CLAUDE.md', undefined, long)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'importTooLong',
      line: 3,
      column: 5,
      endLine: 3,
      endColumn: 18,
    })
    expect(messages[0]?.message).toContain('`docs/long.md`')
    expect(messages[0]?.message).toContain('201 lines')
  })

  it('stays silent on a file at the limit, and on a folder or a missing file', () => {
    expect(lint('@docs/short.md @docs @none.md\n', 'CLAUDE.md', undefined, long)).toEqual([])
  })

  it('names the configured limit for an imported file', () => {
    const messages = lint('@docs/short.md\n', 'CLAUDE.md', { max: 10 }, long)
    expect(ids(messages)).toEqual(['importOverConfiguredLimit'])
    expect(messages[0]?.message).toBe(
      'The file `docs/short.md` that this import loads has 200 lines. The configured limit is 10 lines.',
    )
  })

  it('reports a long file at the fourth hop, at the import of the root', () => {
    const files = {
      'a.md': '@b.md\n',
      'b.md': '@c.md\n',
      'c.md': '@d.md\n',
      'd.md': lines(201),
    }
    const messages = lint('x\n@a.md\n', 'CLAUDE.md', undefined, files)
    expect(messages.map((m) => [m.messageId, m.line, m.column])).toEqual([['importTooLong', 2, 1]])
    expect(messages[0]?.message).toContain('`d.md`')
  })

  it('does not count a file that the chain does not load, past four hops', () => {
    const files = {
      'a.md': '@b.md\n',
      'b.md': '@c.md\n',
      'c.md': '@d.md\n',
      'd.md': '@e.md\n',
      'e.md': lines(201),
    }
    expect(lint('@a.md\n', 'CLAUDE.md', undefined, files)).toEqual([])
  })

  it('reports the root and each long import, once each', () => {
    const files = { ...long, 'docs/long2.md': lines(300) }
    const messages = lint(
      `${lines(200)}@docs/long.md\n@docs/long2.md\n@docs/long.md\n`,
      'CLAUDE.md',
      undefined,
      files,
    )
    expect(messages.map((m) => [m.messageId, m.line])).toEqual([
      ['tooLong', 1],
      ['importTooLong', 201],
      ['importTooLong', 202],
    ])
  })

  it('ends a cycle where the chain meets a file again', () => {
    const files = { 'CLAUDE.md': '@a.md\n', 'a.md': `@CLAUDE.md\n${lines(201)}` }
    const messages = lint('@a.md\n', 'CLAUDE.md', undefined, files)
    expect(ids(messages)).toEqual(['importTooLong'])
  })

  it('leaves a CLAUDE.md, an AGENTS.md and a rule file to the rule that checks it', () => {
    const files = {
      'sub/CLAUDE.md': lines(201),
      'AGENTS.md': lines(201),
      '.claude/CLAUDE.md': lines(201),
      'CLAUDE.local.md': lines(201),
      '.claude/rules/long.md': lines(201),
    }
    expect(
      lint(
        '@sub/CLAUDE.md @AGENTS.md @.claude/CLAUDE.md @CLAUDE.local.md @.claude/rules/long.md\n',
        'CLAUDE.md',
        undefined,
        files,
      ),
    ).toEqual([])
  })

  it('counts the imports of an AGENTS.md and a CLAUDE.local.md', () => {
    expect(ids(lint('@docs/long.md\n', 'AGENTS.md', undefined, long))).toEqual(['importTooLong'])
    expect(ids(lint('@docs/long.md\n', 'CLAUDE.local.md', undefined, long))).toEqual([
      'importTooLong',
    ])
  })

  it('does not read an import in code, or a path that is not an import', () => {
    expect(
      lint(
        'Write `@docs/long.md`.\n\n```\n@docs/long.md\n```\n\nMail a@docs/long.md.\n',
        'CLAUDE.md',
        undefined,
        long,
      ),
    ).toEqual([])
  })

  it('reports a long file that a path in the repository reaches', () => {
    const dir = tree(long)
    const absolute = path.join(dir, 'docs/long.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', `@${absolute}\n`))).toEqual(['importTooLong'])
  })
})

describe.skipIf(noLinks)(`${RULE}: what the rule cannot read`, () => {
  it('makes no report for an import out of the repository or a dangling link', () => {
    const outside = tree({ 'long.md': lines(201) })
    const dir = tree({})
    link(dir, 'out.md', path.join(outside, 'long.md'))
    link(dir, 'gone.md', 'nowhere.md')
    expect(
      lintMemory(
        RULE,
        dir,
        'CLAUDE.md',
        `@out.md @gone.md @${path.join(outside, 'long.md')} @~/long.md @../long.md\n`,
      ),
    ).toEqual([])
  })

  it('still reports a file that it reads, beside a path that it cannot read', () => {
    const dir = tree({ 'long.md': lines(201) })
    link(dir, 'gone.md', 'nowhere.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@gone.md @long.md\n'))).toEqual([
      'importTooLong',
    ])
  })

  it('reads a link that leads to a file in the repository', () => {
    const dir = tree({ 'docs/long.md': lines(201) })
    link(dir, 'in.md', 'docs/long.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@in.md\n'))).toEqual(['importTooLong'])
  })
})
