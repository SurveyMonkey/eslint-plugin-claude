// Import parsing skips Markdown code spans and fenced code blocks, so an `@path` in code does not
// load (https://code.claude.com/docs/en/memory#import-additional-files). The rule reports such a
// path when it names a file that exists, because the writer probably meant an import. A missing
// file is a mention, and `claude-md-import-exists` checks a real import. The rule reads the
// repository around the file, so each case builds a tree on disk. The globs are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-import-in-code-span'

const SHARED = { 'README.md': '# R\n', 'docs/a.md': 'a\n', 'dir/x.md': 'x\n' }

/** The messages for `code` as the file `file` of the tree `files`. */
function lint(code: string, files: Record<string, string> = SHARED, file = 'CLAUDE.md') {
  return lintMemory(RULE, tree(files), file, code)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it.fails('reports a path in a code span that names a file, at the token', () => {
    const messages = lint('# Notes\n\nSee `@docs/a.md` for details.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'inCode',
      line: 3,
      column: 6,
      endLine: 3,
      endColumn: 16,
    })
    expect(messages[0]?.message).toContain('`@docs/a.md`')
  })

  it.fails('stays silent on a path in a code span that names no file', () => {
    expect(lint('See `@docs/none.md` and `@README.mdx`.\n')).toEqual([])
  })

  it.fails('stays silent on a real import, and on a folder', () => {
    expect(lint('See @docs/a.md and @README.md and `@dir` and `@dir/`.\n')).toEqual([])
  })

  it.fails('reports each path in a span, and a span with a longer backtick run', () => {
    const messages = lint('Use `@docs/a.md @README.md` and ``@dir/x.md`` and `@none.md`.\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([
      [1, 6],
      [1, 17],
      [1, 36],
    ])
  })

  it.fails('reports a span that goes over two lines', () => {
    const messages = lint('Use `a\n@docs/a.md` here.\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([[2, 1]])
  })
})

describe(`${RULE}: fenced code`, () => {
  it.fails('reports a path in a fenced block, at the token', () => {
    const code = '# Layout\n\n```text\nsrc/\n  @docs/a.md\n```\n'
    const messages = lint(code)
    expect(messages.map((m) => [m.messageId, m.line, m.column, m.endColumn])).toEqual([
      ['inCode', 5, 3, 13],
    ])
  })

  it.fails('reports a path in a tilde fence, a longer fence, a quote and a list item', () => {
    expect(ids(lint('~~~\n@docs/a.md\n~~~\n'))).toEqual(['inCode'])
    expect(ids(lint('````md\n```\n@docs/a.md\n```\n````\n'))).toEqual(['inCode'])
    expect(ids(lint('> ```\n> @docs/a.md\n> ```\n'))).toEqual(['inCode'])
    expect(ids(lint('- item\n\n  ```\n  @docs/a.md\n  ```\n'))).toEqual(['inCode'])
  })

  it.fails('reports a path in a fence that is never closed', () => {
    expect(ids(lint('```\n@docs/a.md\n'))).toEqual(['inCode'])
  })

  it.fails('stays silent on a missing file in a fence, and on a fence with no content', () => {
    expect(lint('```\n@docs/none.md\n```\n')).toEqual([])
    expect(lint('```\n```\n')).toEqual([])
    expect(lint('```')).toEqual([])
  })

  it.fails('stays silent on an indented block, which Claude Code reads as text', () => {
    expect(lint('Example:\n\n    @docs/a.md\n')).toEqual([])
  })
})

describe(`${RULE}: what is not code`, () => {
  it.fails('stays silent on an email address, a path in quotes and a URL in code', () => {
    expect(
      lint('`me@docs/a.md` `@"docs/a.md"` `@https://example.com/a.md` `@~/a.md` `@C:/a.md`\n'),
    ).toEqual([])
  })

  it.fails('stays silent on a token in an HTML comment', () => {
    expect(lint('<!-- `@docs/a.md` -->\n')).toEqual([])
  })

  it.fails('stays silent on a path in a heading, a link or emphasis', () => {
    expect(lint('# @docs/a.md\n\n[x](docs/a.md) *@docs/a.md*\n')).toEqual([])
  })

  it.fails('reads a path with a mark at the end, a fragment and a backslash space', () => {
    const files = { ...SHARED, 'Design Docs/api.md': 'a\n' }
    expect(ids(lint('`@docs/a.md.` `@docs/a.md#top` `@Design\\ Docs/api.md`\n', files))).toEqual([
      'inCode',
      'inCode',
      'inCode',
    ])
  })
})

describe(`${RULE}: where a relative path starts`, () => {
  it.fails('resolves a path against the folder of the file, not the working directory', () => {
    const files = { ...SHARED, 'packages/web/note.md': 'n\n' }
    expect(lint('`@README.md`\n', files, 'packages/web/CLAUDE.md')).toEqual([])
    expect(ids(lint('`@note.md`\n', files, 'packages/web/CLAUDE.md'))).toEqual(['inCode'])
    expect(ids(lint('`@../../README.md`\n', files, 'packages/web/CLAUDE.md'))).toEqual(['inCode'])
  })

  it.fails('checks a CLAUDE.local.md and an AGENTS.md, and not a file Claude Code never reads', () => {
    for (const file of ['CLAUDE.local.md', 'AGENTS.md', '.claude/CLAUDE.md']) {
      const text = file.startsWith('.claude') ? '`@../README.md`\n' : '`@README.md`\n'
      expect(ids(lint(text, SHARED, file)), file).toEqual(['inCode'])
    }
    expect(lint('`@README.md`\n', SHARED, '.agents/AGENTS.md')).toEqual([])
  })

  it.fails('reads the path of an absolute import that is inside the repository', () => {
    const dir = tree(SHARED)
    const inside = path.join(dir, 'README.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', `\`@${inside}\`\n`))).toEqual(['inCode'])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it.fails('makes no report for a path out of the repository', () => {
    expect(lint('`@../outside.md` `@/nowhere/x.md` `@~/mine.md`\n')).toEqual([])
  })

  it.skipIf(noLinks).fails(
    'makes no report for a link out of the repository, or a dangling link',
    () => {
      const outside = tree({ 'x.md': 'x\n' })
      const dir = tree(SHARED)
      link(dir, 'out.md', path.join(outside, 'x.md'))
      link(dir, 'gone.md', 'nowhere.md')
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '`@out.md` `@gone.md`\n')).toEqual([])
      link(dir, 'in.md', 'README.md')
      expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '`@in.md`\n'))).toEqual(['inCode'])
    },
  )

  it.skipIf(chmodCannotBlock).fails('makes no report below a folder that it cannot read', () => {
    const dir = tree({ ...SHARED, 'secret/s.md': 's\n' })
    withoutAccess(path.join(dir, 'secret'), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '`@secret/s.md`\n')).toEqual([])
    })
  })
})
