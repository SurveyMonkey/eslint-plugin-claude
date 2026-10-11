// A `CLAUDE.md` that is a symlink to `AGENTS.md` works, but Git checks a committed symlink out
// as a plain text file on a Windows clone without `core.symlinks`, and the Edit and Write tools
// refuse to write through a link
// (https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools). The rule
// asks the file system whether the file is a link. A link that exists on disk is a link, so a
// clone that checked out a plain file gets no report. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-symlink'

const TEXT = '# Project\n'

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe.skipIf(noLinks)(RULE, () => {
  it('reports a CLAUDE.md that is a link to AGENTS.md, at the start of the file', () => {
    const dir = tree({ 'AGENTS.md': TEXT })
    link(dir, 'CLAUDE.md', 'AGENTS.md')
    const messages = lintMemory(RULE, dir, 'CLAUDE.md', TEXT)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'symlink',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('`AGENTS.md`')
    expect(messages[0]?.message).toContain('@AGENTS.md')
  })

  it('reports a link in .claude and in a subfolder, to a file anywhere', () => {
    const dir = tree({ 'AGENTS.md': TEXT })
    link(dir, '.claude/CLAUDE.md', '../AGENTS.md')
    link(dir, 'packages/web/CLAUDE.md', '../../AGENTS.md')
    const elsewhere = tree({ 'CLAUDE.md': TEXT })
    link(dir, 'packages/api/CLAUDE.md', path.join(elsewhere, 'CLAUDE.md'))
    expect(ids(lintMemory(RULE, dir, '.claude/CLAUDE.md', TEXT))).toEqual(['symlink'])
    expect(ids(lintMemory(RULE, dir, 'packages/web/CLAUDE.md', TEXT))).toEqual(['symlink'])
    expect(ids(lintMemory(RULE, dir, 'packages/api/CLAUDE.md', TEXT))).toEqual(['symlink'])
  })

  it('stays silent on a regular file', () => {
    const dir = tree({ 'CLAUDE.md': TEXT, 'AGENTS.md': TEXT })
    expect(lintMemory(RULE, dir, 'CLAUDE.md', TEXT)).toEqual([])
  })

  it('stays silent on a CLAUDE.md in a folder that is a link, because the file is not', () => {
    const dir = tree({ 'shared/CLAUDE.md': TEXT })
    link(dir, 'linked', 'shared')
    expect(lintMemory(RULE, dir, 'linked/CLAUDE.md', TEXT)).toEqual([])
  })

  it('does not check a file that is not a CLAUDE.md', () => {
    const dir = tree({ 'target.md': TEXT })
    for (const file of [
      'CLAUDE.local.md',
      'AGENTS.md',
      '.claude/rules/CLAUDE.md',
      '.claude/rules/a.md',
      'docs/notes.md',
    ]) {
      link(dir, file, path.join(dir, 'target.md'))
      expect(lintMemory(RULE, dir, file, TEXT), file).toEqual([])
    }
  })

  it('makes no report for a link to a network path, which the network rule reports', () => {
    const dir = tree({})
    link(dir, 'CLAUDE.md', '/net/host/CLAUDE.md')
    link(dir, '.claude/CLAUDE.md', '\\\\server\\share\\CLAUDE.md')
    link(dir, 'a/CLAUDE.md', '/Network/Servers/h/CLAUDE.md')
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', 'a/CLAUDE.md']) {
      expect(lintMemory(RULE, dir, file, TEXT), file).toEqual([])
    }
  })
})

describe.skipIf(noLinks)(`${RULE}: the test for a network path`, () => {
  it('reports a link to a local path that looks like a share, and leaves a share', () => {
    const local = [
      '\\\\wsl$\\Ubuntu\\x',
      '\\\\wsl.localhost\\Ubuntu\\x',
      '\\\\?\\C:\\x',
      '\\\\.\\pipe\\x',
      '/netfoo',
    ]
    const shares = ['\\\\?\\UNC\\srv\\share\\x', '\\\\SERVER\\share', '/net', '/Network']
    for (const target of local) {
      const dir = tree({})
      link(dir, 'CLAUDE.md', target)
      expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', TEXT)), target).toEqual(['symlink'])
    }
    for (const target of shares) {
      const dir = tree({})
      link(dir, 'CLAUDE.md', target)
      expect(lintMemory(RULE, dir, 'CLAUDE.md', TEXT), target).toEqual([])
    }
  })
})

describe.skipIf(noLinks)(`${RULE}: what the rule cannot read`, () => {
  it('reports a link that leads nowhere, because the report rests on the link only', () => {
    const dir = tree({})
    link(dir, 'CLAUDE.md', 'nowhere.md')
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', TEXT))).toEqual(['symlink'])
  })

  it('makes no report for a file that is not on disk', () => {
    expect(lintMemory(RULE, tree({}), 'CLAUDE.md', TEXT)).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('makes no report for a path that it cannot read', () => {
    const dir = tree({ 'sub/CLAUDE.md': TEXT })
    withoutAccess(path.join(dir, 'sub'), () => {
      expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', TEXT)).toEqual([])
    })
  })
})
