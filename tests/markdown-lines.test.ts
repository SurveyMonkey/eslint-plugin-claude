// `unfencedLines` through a rule that collects what it returns, run by the
// Markdown language as in real use.
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import { unfencedLines } from '../src/markdown-lines.ts'

function linesOf(code: string, after?: number) {
  let found: ReturnType<typeof unfencedLines> = []
  const linter = new Linter()
  linter.verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: {
          markdown,
          t: {
            rules: {
              r: {
                create: (context: { sourceCode: Parameters<typeof unfencedLines>[0] }) => ({
                  root() {
                    found = unfencedLines(context.sourceCode, after)
                  },
                }),
              },
            },
          },
        },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { 't/r': 'error' },
      },
    ] as never,
    'a.md',
  )
  return found
}

describe('unfencedLines', () => {
  it('skips the lines of backtick and tilde fences, markers included', () => {
    const code = 'one\n```sh\ntwo\n```\nthree\n~~~\nfour\n~~~\nfive\n'
    expect(linesOf(code).map((l) => [l.line, l.text])).toEqual([
      [1, 'one'],
      [5, 'three'],
      [9, 'five'],
      [10, ''],
    ])
  })

  it('keeps an indented code block, which is not a fence', () => {
    expect(linesOf('para\n\n    code\n').map((l) => l.text)).toContain('    code')
  })

  it('skips a fence inside a list item', () => {
    const code = '- item\n\n  ```sh\n  inner\n  ```\n\nafter\n'
    expect(linesOf(code).map((l) => l.text)).not.toContain('  inner')
  })

  it('gives the offset of each line, for CRLF text too', () => {
    const code = 'a\r\nbb\r\nccc\r\n'
    expect(linesOf(code).map((l) => [l.line, l.offset])).toEqual([
      [1, 0],
      [2, 3],
      [3, 7],
      [4, 12],
    ])
  })

  it('skips the lines up to `after`', () => {
    expect(linesOf('a\nb\nc\n', 2).map((l) => l.text)).toEqual(['c', ''])
  })
})
