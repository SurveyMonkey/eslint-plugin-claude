// A `CLAUDE.md` or `.claude/rules/` symlink, a file or a folder, that leads to a network path is
// not followed. The network paths are the UNC share `\\server\share`, and a path under `/net` or
// `/Network`. The `\\wsl$` paths do not count as network paths
// (https://code.claude.com/docs/en/memory#share-rules-across-projects-with-symlinks). The rule
// reads the text of the link only. It never follows the link. A lookup of such a path can
// contact the host. Each case makes a real link on disk, which leads nowhere on this machine. The
// globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'

const RULE = 'memory-symlink-network-target'

const UNC = '\\\\server\\share\\rules'

/** The messages for a tree with the link `at` to `target`, linted as the file `file`. */
function lintLink(at: string, target: string, file = at, files: Record<string, string> = {}) {
  const dir = tree(files)
  link(dir, at, target)
  return lintMemory(RULE, dir, file, '# Notes\n')
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe.skipIf(noLinks)(RULE, () => {
  it('reports a CLAUDE.md that is a link to a UNC share, at the start', () => {
    const messages = lintLink('CLAUDE.md', UNC)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'network',
      line: 1,
      column: 1,
    })
    expect(messages[0]?.message).toContain('`\\\\server\\share\\rules`')
    expect(messages[0]?.message).toContain('CLAUDE.md')
  })

  it('reports a link to a path under /net or /Network, or to the folder itself', () => {
    expect(ids(lintLink('CLAUDE.md', '/net/host/CLAUDE.md'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '/Network/Servers/host/CLAUDE.md'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '/net'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '/Network'))).toEqual(['network'])
  })

  it('reports the CLAUDE.md files of a subfolder and of .claude', () => {
    expect(ids(lintLink('.claude/CLAUDE.md', UNC))).toEqual(['network'])
    expect(ids(lintLink('packages/web/CLAUDE.md', '/net/h/x'))).toEqual(['network'])
  })

  it('reports a UNC form with other letters, a drive form of a share, or a long path', () => {
    expect(ids(lintLink('CLAUDE.md', '\\\\SERVER\\Share\\x.md'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '\\\\10.0.0.5\\share'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '\\\\?\\UNC\\server\\share\\x.md'))).toEqual(['network'])
    expect(ids(lintLink('CLAUDE.md', '\\\\?\\unc\\server\\share\\x.md'))).toEqual(['network'])
  })

  it('reports a rule file that is a link, at any depth', () => {
    expect(ids(lintLink('.claude/rules/a.md', UNC))).toEqual(['network'])
    expect(ids(lintLink('.claude/rules/sub/deep/b.md', '/net/h/b.md'))).toEqual(['network'])
    expect(ids(lintLink('packages/web/.claude/rules/c.md', '/Network/h/c.md'))).toEqual(['network'])
  })

  it('reports a rule file below a link to a folder, at the link', () => {
    const dir = tree({})
    link(dir, '.claude/rules/shared', '/net/host/rules')
    const messages = lintMemory(RULE, dir, '.claude/rules/shared/style.md', '# Rule\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.message).toContain('shared')
    expect(messages[0]?.message).toContain('/net/host/rules')
    expect(messages[0]?.message).not.toContain('style.md')
  })

  it('reports the .claude/rules folder when it is a link', () => {
    const dir = tree({})
    link(dir, '.claude/rules', UNC)
    expect(ids(lintMemory(RULE, dir, '.claude/rules/a.md', '# Rule\n'))).toEqual(['network'])
  })

  it('reports the first link on the way, and no more', () => {
    const dir = tree({})
    link(dir, '.claude/rules/shared', '/net/host/rules')
    expect(lintMemory(RULE, dir, '.claude/rules/shared/sub/x.md', '# Rule\n')).toHaveLength(1)
  })

  it('stays silent on a regular file and on a link to a local path', () => {
    expect(lintMemory(RULE, tree({ 'CLAUDE.md': '# C\n' }), 'CLAUDE.md', '# C\n')).toEqual([])
    expect(lintLink('CLAUDE.md', '../shared/CLAUDE.md')).toEqual([])
    expect(lintLink('CLAUDE.md', '/home/me/CLAUDE.md')).toEqual([])
    expect(lintLink('CLAUDE.md', 'C:\\Users\\me\\CLAUDE.md')).toEqual([])
    expect(lintLink('.claude/rules/a.md', '/Users/me/rules/a.md')).toEqual([])
  })

  it('stays silent on a \\\\wsl$ path, which is not a network path', () => {
    expect(lintLink('CLAUDE.md', '\\\\wsl$\\Ubuntu\\home\\me\\CLAUDE.md')).toEqual([])
    expect(lintLink('CLAUDE.md', '\\\\WSL$\\Ubuntu\\home')).toEqual([])
    expect(lintLink('CLAUDE.md', '\\\\wsl$')).toEqual([])
    expect(lintLink('CLAUDE.md', '\\\\wsl.localhost\\Ubuntu\\home')).toEqual([])
    // A host with a name that starts the same way is a host.
    expect(ids(lintLink('CLAUDE.md', '\\\\wsl$extra\\share'))).toEqual(['network'])
  })

  it('stays silent on a long path or a device path of a local drive', () => {
    expect(lintLink('CLAUDE.md', '\\\\?\\C:\\Users\\me\\CLAUDE.md')).toEqual([])
    expect(lintLink('CLAUDE.md', '\\\\.\\pipe\\x')).toEqual([])
  })

  it('stays silent on a path that only starts like /net or /Network', () => {
    for (const target of [
      '/network/x',
      '/netx/y',
      '/nets',
      '/Networking/x',
      '/Net/x',
      '/usr/net/x',
    ]) {
      expect(lintLink('CLAUDE.md', target)).toEqual([])
    }
    expect(lintLink('CLAUDE.md', 'net/host/x')).toEqual([])
    expect(lintLink('CLAUDE.md', '//server/share')).toEqual([])
  })

  it('stays silent on a link to a local folder in the rules folder', () => {
    const dir = tree({ 'shared/style.md': '# S\n' })
    link(dir, '.claude/rules/shared', '../../shared')
    expect(lintMemory(RULE, dir, '.claude/rules/shared/style.md', '# S\n')).toEqual([])
  })

  it('does not check a file that Claude Code does not read as a CLAUDE.md or a rule', () => {
    expect(lintLink('docs/notes.md', UNC)).toEqual([])
    expect(lintLink('AGENTS.md', UNC)).toEqual([])
    expect(lintLink('CLAUDE.local.md', UNC)).toEqual([])
    expect(lintLink('.claude/skills/x/SKILL.md', UNC)).toEqual([])
    // A link in the path above `.claude/rules` is not in the folder that the docs name.
    const dir = tree({})
    link(dir, 'packages', '/net/host/packages')
    expect(lintMemory(RULE, dir, 'packages/CLAUDE.md', '# C\n')).toEqual([])
  })

  it('reads a file that is not on disk as a file that is no link', () => {
    expect(lintMemory(RULE, tree({}), 'CLAUDE.md', '# C\n')).toEqual([])
    expect(lintMemory(RULE, tree({}), '.claude/rules/a.md', '# R\n')).toEqual([])
  })

  it('names the link with forward slashes', () => {
    const dir = tree({})
    link(dir, '.claude/rules/sub/a.md', UNC)
    const messages = lintMemory(RULE, dir, '.claude/rules/sub/a.md', '# R\n')
    expect(messages[0]?.message).toMatch(/^`[^`]*\/\.claude\/rules\/sub\/a\.md` is a link/)
  })
})
