// An `@path` import in a project memory file is external when its path resolves outside the
// working directory. Claude Code asks each user to approve such an import, and a decline
// disables it for good (https://code.claude.com/docs/en/memory#import-additional-files). An
// `AGENTS.md` file never prompts
// (https://code.claude.com/docs/en/memory#where-agents-md-differs-from-claude-md). The rule
// reads the repository around the file, so each case builds a tree on disk. The globs are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'

const RULE = 'claude-md-import-external'

const SHARED = { 'README.md': '# R\n', 'docs/git.md': 'git\n' }

/** The messages for `code` as the file `file` of the tree `files`. */
function lint(code: string, file = 'CLAUDE.md', files: Record<string, string> = SHARED) {
  return lintMemory(RULE, tree(files), file, code)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports a home import, at the token', () => {
    const messages = lint('# Notes\n\n- @~/.claude/mine.md\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'external',
      line: 3,
      column: 3,
      endLine: 3,
      endColumn: 21,
    })
    expect(messages[0]?.message).toContain('`@~/.claude/mine.md`')
  })

  it('reports an absolute path out of the repository, on each system', () => {
    expect(ids(lint('@/etc/hosts\n'))).toEqual(['external'])
    expect(ids(lint('@C:/Users/me/notes.md\n'))).toEqual(['external'])
    expect(ids(lint('@d:/work/notes.md\n'))).toEqual(['external'])
    expect(ids(lint('@~\n'))).toEqual(['external'])
  })

  it('reports a relative path that climbs out of the repository', () => {
    expect(ids(lint('@../outside.md\n'))).toEqual(['external'])
    expect(ids(lint('@../../../x/y.md\n', 'packages/web/CLAUDE.md'))).toEqual(['external'])
    expect(ids(lint('@docs/../../outside.md\n'))).toEqual(['external'])
    expect(ids(lint('@../../a.md\n', '.claude/CLAUDE.md'))).toEqual(['external'])
  })

  it('reports a path whether or not the target is there', () => {
    const outside = tree({ 'x.md': 'x\n' })
    expect(ids(lint(`@${path.join(outside, 'x.md')} @${path.join(outside, 'none.md')}\n`))).toEqual(
      ['external', 'external'],
    )
  })

  it('reports each external import of a text, and not an import in the repository', () => {
    const messages = lint('@README.md @../a.md\n- @docs/git.md and @~/b.md\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([
      [1, 12],
      [2, 20],
    ])
  })

  it('stays silent on a path in the repository, whether or not the target is there', () => {
    expect(
      lint(
        '@README.md @docs/git.md @./README.md @docs/../README.md @none.md @docs/missing.md @docs\n',
      ),
    ).toEqual([])
    expect(lint('@../../README.md @../a.md\n', 'packages/web/CLAUDE.md')).toEqual([])
    expect(lint('@../README.md\n', '.claude/CLAUDE.md')).toEqual([])
    const dir = tree(SHARED)
    expect(lintMemory(RULE, dir, 'CLAUDE.md', `@${path.join(dir, 'README.md')}\n`)).toEqual([])
  })

  it('stays silent on a path with a mark at the end, or a fragment, in the repository', () => {
    expect(lint('Read @README.md. See @docs/git.md, and @docs/git.md#top.\n')).toEqual([])
  })

  it('does not read a user path with a name, which the docs do not name', () => {
    expect(lint('@~alice/x.md\n')).toEqual([])
  })

  it('does not read a URL, an email address, a word with a colon or text in code', () => {
    expect(
      lint(
        'Mail me@example.com, @https://example.com/x.md, @alice: and @mailto:a@b.c.\n`@~/x.md`\n```\n@../x.md\n```\n<!-- @../x.md -->\n@"../x.md"\n',
      ),
    ).toEqual([])
  })
})

describe(`${RULE}: the files`, () => {
  it('checks a CLAUDE.md in any folder, and a .claude/CLAUDE.md', () => {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'packages/web/CLAUDE.md']) {
      expect(ids(lint('@~/x.md\n', file)), file).toEqual(['external'])
    }
  })

  it('makes no report for an AGENTS.md, which never prompts', () => {
    for (const file of ['AGENTS.md', '.claude/AGENTS.md', 'packages/web/AGENTS.md']) {
      expect(lint('@~/x.md @/etc/hosts @../x.md\n', file), file).toEqual([])
    }
  })

  it('does not check a file that is not committed, a rule file or a file never read', () => {
    for (const file of [
      'CLAUDE.local.md',
      '.claude/rules/CLAUDE.md',
      '.claude/rules/a.md',
      'AGENTS.local.md',
      '.agents/notes.md',
      'docs/notes.md',
    ]) {
      expect(lint('@~/x.md\n', file), file).toEqual([])
    }
  })
})

describe(`${RULE}: the imported files`, () => {
  const files = {
    ...SHARED,
    'docs/a.md': 'See @~/mine.md and @../../out.md and @git.md\n',
    'docs/b.md': '@a.md\n',
  }

  it('reports an external import in a file that an import loads, at the import', () => {
    const messages = lint('x\n@docs/a.md\n', 'CLAUDE.md', files)
    expect(messages.map((m) => [m.messageId, m.line, m.column])).toEqual([
      ['externalInImported', 2, 1],
      ['externalInImported', 2, 1],
    ])
    expect(messages[0]?.message).toContain('`@~/mine.md`')
    expect(messages[0]?.message).toContain('`docs/a.md`')
    expect(messages[1]?.message).toContain('`@../../out.md`')
  })

  it('follows an import chain to the imported files', () => {
    const messages = lint('@docs/b.md\n', 'CLAUDE.md', files)
    expect(ids(messages)).toEqual(['externalInImported', 'externalInImported'])
    expect(messages[0]?.message).toContain('`docs/a.md`')
  })

  it('stays silent when the imported files import files in the repository', () => {
    expect(
      lint('@docs/git.md\n', 'CLAUDE.md', { ...SHARED, 'docs/git.md': '@../README.md\n' }),
    ).toEqual([])
  })

  it('leaves a CLAUDE.md or an AGENTS.md that an import loads to its own check', () => {
    const own = {
      ...SHARED,
      'sub/CLAUDE.md': '@~/x.md\n',
      'AGENTS.md': '@~/x.md\n',
    }
    expect(lint('@sub/CLAUDE.md @AGENTS.md\n', 'CLAUDE.md', own)).toEqual([])
  })

  it('ends a cycle at the root, and reports the file once', () => {
    const cycle = { 'CLAUDE.md': '@docs/a.md\n', 'docs/a.md': '@../CLAUDE.md @~/x.md\n' }
    expect(ids(lint('@docs/a.md\n', 'CLAUDE.md', cycle))).toEqual(['externalInImported'])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it('makes no report in a tree with no .git, where the end of the repository is unknown', () => {
    const dir = tree({}, false)
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '@~/x.md @/etc/hosts @../x.md\n')).toEqual([])
  })
})

describe.skipIf(noLinks)(`${RULE}: a link`, () => {
  it('reads a link in the repository as a path in the repository', () => {
    const outside = tree({ 'x.md': 'x\n' })
    const dir = tree(SHARED)
    link(dir, 'out.md', path.join(outside, 'x.md'))
    link(dir, 'sub', 'docs')
    // The import is by name inside the repository, even when the target is out of it.
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '@out.md @sub/git.md\n')).toEqual([])
  })

  it('reads the path of a CLAUDE.md in a .claude folder that is a link as a path in the repository', () => {
    // The real folder is out of the repository. The path of the file is in it.
    const shared = tree({ 'style.md': 's\n' }, false)
    const dir = tree(SHARED)
    link(dir, '.claude', shared)
    expect(lintMemory(RULE, dir, '.claude/CLAUDE.md', '@style.md @../README.md\n')).toEqual([])
    expect(ids(lintMemory(RULE, dir, '.claude/CLAUDE.md', '@../../x.md\n'))).toEqual(['external'])
  })
})
