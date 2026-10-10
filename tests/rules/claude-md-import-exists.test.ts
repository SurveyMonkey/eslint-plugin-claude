// An `@path` import in an instruction file must name a file that exists
// (https://code.claude.com/docs/en/memory#import-additional-files). Claude Code resolves a
// relative path against the folder of the file that holds the import. The rule reads the
// repository around the file, so each case builds a tree on disk. The rule reports only what
// it can read inside the repository. A path out of it, a dangling link or a folder that it
// cannot read gets no report. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-import-exists'

const SHARED = { 'README.md': '# R\n', 'docs/git.md': 'git\n', 'dir/x.md': 'x\n' }

/** The messages for `code` as the file `file` of the tree `files`. */
function lint(
  code: string,
  files: Record<string, string> = SHARED,
  file = 'CLAUDE.md',
  options?: object,
) {
  return lintMemory(RULE, tree(files), file, code, options)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports an import of a file that is not there, at the token', () => {
    const messages = lint('# Notes\n\nSee @docs/missing.md for details.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      line: 3,
      column: 5,
      endLine: 3,
      endColumn: 21,
    })
    expect(messages[0]?.message).toContain('`@docs/missing.md`')
  })

  it('reports each missing import of a text, and not an import that exists', () => {
    const messages = lint('@README.md @none.md\n- git @docs/git.md and @docs/none.md\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([
      [1, 12],
      [2, 24],
    ])
  })

  it('stays silent on an import of a file, a file without an extension, and a folder', () => {
    expect(
      lint('@README.md @docs/git.md @dir @dir/ @dir/x.md @./README.md @docs/../README.md\n'),
    ).toEqual([])
    expect(lint('@README\n', { README: 'r\n' })).toEqual([])
  })
})

describe(`${RULE}: where a relative path starts`, () => {
  it('resolves a path against the folder of the importing file, not the working directory', () => {
    const files = { ...SHARED, 'packages/web/note.md': 'n\n' }
    // The file `README.md` is in the root, and not next to the importing file.
    expect(ids(lint('@README.md\n', files, 'packages/web/CLAUDE.md'))).toEqual(['missing'])
    expect(ids(lint('@note.md\n', files, 'packages/web/CLAUDE.md'))).toEqual([])
    expect(ids(lint('@../../README.md\n', files, 'packages/web/CLAUDE.md'))).toEqual([])
  })

  it('resolves a path in .claude/CLAUDE.md against the .claude folder', () => {
    const files = { ...SHARED, '.claude/style.md': 's\n' }
    expect(ids(lint('@style.md @README.md\n', files, '.claude/CLAUDE.md'))).toEqual(['missing'])
  })

  it('checks an AGENTS.md, a .claude/AGENTS.md and a CLAUDE.local.md', () => {
    expect(ids(lint('@none.md\n', SHARED, 'AGENTS.md'))).toEqual(['missing'])
    expect(ids(lint('@none.md\n', SHARED, '.claude/AGENTS.md'))).toEqual(['missing'])
    expect(ids(lint('@none.md\n', SHARED, 'CLAUDE.local.md'))).toEqual(['missing'])
    expect(ids(lint('@README.md\n', SHARED, 'AGENTS.md'))).toEqual([])
  })

  it('checks a CLAUDE.md or an AGENTS.md below .claude/rules, which is a rule file', () => {
    expect(ids(lint('@none.md\n', SHARED, '.claude/rules/CLAUDE.md'))).toEqual(['missing'])
    expect(ids(lint('@none.md\n', SHARED, '.claude/rules/AGENTS.md'))).toEqual(['missing'])
    expect(lint('@../../README.md\n', SHARED, '.claude/rules/CLAUDE.md')).toEqual([])
  })

  it('does not check a file that Claude Code never reads', () => {
    expect(lint('@none.md\n', SHARED, '.agents/AGENTS.md')).toEqual([])
  })

  it('reads a file that is not on disk as a file in its folder', () => {
    const dir = tree(SHARED)
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@README.md @none.md\n'))).toEqual(['missing'])
  })

  it('reads the path of an absolute import that is inside the repository', () => {
    const dir = tree(SHARED)
    const inside = path.join(dir, 'README.md')
    const gone = path.join(dir, 'gone.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', `@${inside} @${gone}\n`))).toEqual(['missing'])
  })
})

describe(`${RULE}: the token`, () => {
  it('reads a path with a backslash before each space', () => {
    const files = { 'Design Docs/api.md': 'a\n' }
    expect(lint('- API @Design\\ Docs/api.md\n', files)).toEqual([])
    const messages = lint('- API @Design\\ Docs/none.md\n', files)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('`@Design Docs/none.md`')
  })

  it('takes the path to end at the first space', () => {
    expect(ids(lint('@Design Docs/api.md\n', { 'Design Docs/api.md': 'a\n' }))).toEqual(['missing'])
  })

  it('accepts a path with a mark at the end, or a fragment, when the file is there', () => {
    expect(lint('Read @README.md. See @docs/git.md, (@dir/x.md) and @docs/git.md#top.\n')).toEqual(
      [],
    )
    expect(ids(lint('Read @none.md.\n'))).toEqual(['missing'])
  })

  it('does not read an email address, a path in quotes, or a URL as an import', () => {
    expect(
      lint('Mail me@example.com or @"none file.md" or @\'none.md\' or @https://example.com/x.md\n'),
    ).toEqual([])
  })

  it('does not read an import in a code span, a fenced block or an HTML comment', () => {
    const code = [
      'Write `@none.md` to mention a path.',
      '',
      '```text',
      '@none.md',
      '```',
      '',
      '~~~',
      '@none.md',
      '~~~',
      '',
      '<!-- @none.md -->',
    ].join('\n')
    expect(lint(`${code}\n`)).toEqual([])
    expect(ids(lint(`${code}\n@none.md\n`))).toEqual(['missing'])
  })

  it('does not read the frontmatter of a file as text of a different kind', () => {
    expect(ids(lint('---\nname: x\n---\n@none.md\n'))).toEqual(['missing'])
  })
})

describe(`${RULE}: the option ignorePattern`, () => {
  it('leaves out a token that the pattern matches, with the @', () => {
    const code = 'Use @types/node and @scope/pkg, but not @none.md.\n'
    expect(ids(lint(code, SHARED, 'CLAUDE.md', { ignorePattern: '^@(types|scope)/' }))).toEqual([
      'missing',
    ])
    expect(ids(lint(code))).toEqual(['missing', 'missing', 'missing'])
  })

  it('stops the run for a pattern that is not a regular expression', () => {
    expect(() => lint('@none.md\n', SHARED, 'CLAUDE.md', { ignorePattern: '(' })).toThrow(
      /ignorePattern/,
    )
  })

  it('refuses an option that is not a string', () => {
    expect(() => lint('@none.md\n', SHARED, 'CLAUDE.md', { ignorePattern: 1 })).toThrow(
      /should be string/,
    )
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it('makes no report for a home path, a URL or a path out of the repository', () => {
    expect(
      lint('@~/.claude/mine.md @https://example.com/x.md @../outside.md @/nowhere/x.md\n'),
    ).toEqual([])
  })

  it.skipIf(noLinks)(
    'makes no report for a link out of the repository, and a dangling link',
    () => {
      const outside = tree({ 'x.md': 'x\n' })
      const dir = tree(SHARED)
      link(dir, 'out.md', path.join(outside, 'x.md'))
      link(dir, 'gone.md', 'nowhere.md')
      link(dir, 'gone-dir', 'nowhere')
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '@out.md @gone.md @gone-dir/x.md\n')).toEqual([])
    },
  )

  it.skipIf(noLinks)('follows a link inside the repository', () => {
    const dir = tree(SHARED)
    link(dir, 'in.md', 'README.md')
    link(dir, 'linked', 'docs')
    expect(
      lintMemory(RULE, dir, 'CLAUDE.md', '@in.md @linked/git.md @linked/none.md\n').map(
        (m) => m.column,
      ),
    ).toEqual([23])
  })

  it.skipIf(chmodCannotBlock)('makes no report below a folder that it cannot read', () => {
    const dir = tree({ ...SHARED, 'secret/s.md': 's\n' })
    withoutAccess(path.join(dir, 'secret'), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '@secret/s.md @secret/none.md\n')).toEqual([])
    })
  })

  it('uses the repository root of a tree with no .git as the bound', () => {
    const dir = tree(SHARED, false)
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '@README.md @none.md @../up.md\n'))).toEqual([
      'missing',
    ])
  })
})
