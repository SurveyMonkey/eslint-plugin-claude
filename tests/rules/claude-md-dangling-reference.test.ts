// The docs tell you to write instructions that are concrete enough to verify, and give a path such
// as `src/api/handlers/` as the example
// (https://code.claude.com/docs/en/memory#write-effective-instructions). A path or a slash command
// in a code span that points to nothing misleads Claude. The rule reads the repository around the
// file, so each case builds a tree on disk. It makes no report on a path out of the repository, on
// a link that leads nowhere, or on a folder it cannot read (ADR 001, Decision 14). This plugin has
// no list of the bundled commands, so the option `allow` names the commands from outside the
// repository. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-dangling-reference'

/** The messages for the text `code` as the file `file` of a tree with the files `files`. */
function lint(
  code: string,
  files: Record<string, string> = {},
  file = 'CLAUDE.md',
  options?: object,
) {
  return lintMemory(RULE, tree(files), file, code, options)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(`${RULE}: paths`, () => {
  it('reports a path that is not there, over the code span', () => {
    const messages = lint('See `docs/adr/001.md` for the decision.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'path',
      line: 1,
      column: 5,
      endLine: 1,
      endColumn: 22,
    })
    expect(messages[0]?.message).toBe(
      'The path `docs/adr/001.md` is not in the repository. It is not in the folder of this file or in the repository root. Fix the path, or remove the reference.',
    )
  })

  it('reports each shape of a path: an extension, a trailing slash, a dot start', () => {
    for (const ref of [
      'src/gone.ts',
      'docs/gone/',
      './scripts',
      '.github/gone',
      'src/gone.ts:12',
      'src/gone.ts:12:3',
    ]) {
      expect(ids(lint(`Read \`${ref}\`.\n`)), ref).toEqual(['path'])
    }
  })

  it('reports each path that is not there, once for each span', () => {
    const messages = lint('`a/gone.ts` and `b/gone.ts`\n\n- `c/gone.ts`\n')
    expect(messages.map((m) => [m.line, m.column])).toEqual([
      [1, 1],
      [1, 17],
      [3, 3],
    ])
  })

  it('stays silent on a path that is there, from the folder of the file', () => {
    const files = { 'src/a.ts': 'x\n', 'docs/guide/b.md': 'x\n' }
    for (const ref of ['src/a.ts', 'src/a.ts:12', 'docs/guide/', './src/a.ts', 'docs/guide/b.md']) {
      expect(lint(`Read \`${ref}\`.\n`, files), ref).toEqual([])
    }
  })

  it('stays silent on a path that is in the repository root or the folder of the file', () => {
    const files = { 'docs/root.md': 'x\n', 'packages/a/local/file.md': 'x\n', 'shared/s.md': 'x\n' }
    const file = 'packages/a/CLAUDE.md'
    expect(
      lint('`docs/root.md` and `local/file.md` and `../../shared/s.md`\n', files, file),
    ).toEqual([])
    expect(ids(lint('`local/gone.md`\n', files, file))).toEqual(['path'])
  })

  it('resolves a path in a rule file from the folder of the rule and the root', () => {
    const files = { 'src/a.ts': 'x\n', '.claude/rules/b.md': 'x\n' }
    expect(lint('`src/a.ts` and `./gone.md`\n', files, '.claude/rules/c.md')).toHaveLength(1)
    expect(lint('`src/a.ts` and `./b.md`\n', files, '.claude/rules/c.md')).toEqual([])
  })

  it('stays silent on text that is not a path to check', () => {
    for (const ref of [
      'and/or',
      'src/rules',
      'read/write',
      'YYYY/MM/DD',
      'github.com/org/repo',
      'release/v1.2',
      '/etc/hosts.conf',
      '/usr/local/bin',
      '~/notes/a.md',
      'https://example.com/a/b.html',
      'src/**/*.ts',
      'src/{a,b}/c.ts',
      '@scope/pkg/x.js',
      'docs/my file.md',
      '$HOME/a/b/c',
      'a/b/<name>.md',
      'node.js',
      'package.json',
      '-rf a/b/c',
    ]) {
      expect(lint(`Use \`${ref}\`.\n`), ref).toEqual([])
    }
  })

  it('stays silent on a path outside a code span, in a fence or in an HTML comment', () => {
    expect(lint('Read docs/adr/001.md now.\n')).toEqual([])
    expect(lint('```\ndocs/adr/001.md\n```\n')).toEqual([])
    expect(lint('<!-- `docs/adr/001.md` -->\n')).toEqual([])
    expect(lint('    `docs/adr/001.md`\n')).toEqual([])
  })

  it('stays silent on a path that is in the allow option, written as in the file', () => {
    const options = { allow: ['docs/adr/001.md'] }
    expect(lint('`docs/adr/001.md`\n', {}, 'CLAUDE.md', options)).toEqual([])
    expect(ids(lint('`docs/adr/002.md`\n', {}, 'CLAUDE.md', options))).toEqual(['path'])
  })
})

describe(`${RULE}: paths that the rule cannot see`, () => {
  it('stays silent on a path that leads out of the repository', () => {
    const dir = tree({ 'inner/.git/HEAD': 'ref\n', 'outside.md': 'x\n' })
    for (const ref of ['../outside.md', '../../x/y/z.md', '../../../../../../gone.md']) {
      expect(lintMemory(RULE, dir, 'inner/CLAUDE.md', `\`${ref}\`\n`), ref).toEqual([])
    }
    expect(ids(lintMemory(RULE, dir, 'inner/CLAUDE.md', '`gone/x.md`\n'))).toEqual(['path'])
  })

  it.skipIf(noLinks)('stays silent on a link that leads nowhere, and on a path through one', () => {
    const dir = tree({})
    link(dir, 'docs/gone.md', 'nowhere.md')
    link(dir, 'linked', 'nowhere')
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`docs/gone.md`\n')).toEqual([])
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`linked/a/b.md`\n')).toEqual([])
  })

  it.skipIf(noLinks)('stays silent on a link that leads out of the repository', () => {
    const dir = tree({})
    link(dir, 'docs/out.md', path.join(tree({ 'file.md': 'x\n' }), 'file.md'))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`docs/out.md`\n')).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent on a path in a folder that has no read right', () => {
    const dir = tree({ 'docs/guide/a.md': 'x\n' })
    withoutAccess(path.join(dir, 'docs'), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '`docs/guide/gone.md`\n')).toEqual([])
    })
  })
})

describe(`${RULE}: commands`, () => {
  it('reports a command that no skill or command file names, over the code span', () => {
    const messages = lint('Run `/deploy` to ship.\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'command',
      line: 1,
      column: 5,
      endLine: 1,
      endColumn: 14,
    })
    expect(messages[0]?.message).toBe(
      'The command `/deploy` is not a skill or a command file of this repository. No `.claude/skills/deploy/SKILL.md` or `.claude/commands/deploy.md` is there. Fix the name, or add it to the `allow` option if it comes from outside the repository.',
    )
  })

  it('reports a command with arguments, and checks the name', () => {
    expect(ids(lint('Run `/fix-issue 1234`.\n'))).toEqual(['command'])
    expect(lint('Run `/fix-issue 1234`.\n', { '.claude/commands/fix-issue.md': 'x\n' })).toEqual([])
  })

  it('stays silent on a skill, a command file and a command in a subfolder', () => {
    const files = {
      '.claude/skills/deploy/SKILL.md': '---\nname: deploy\n---\n',
      '.claude/commands/ship.md': 'x\n',
      '.claude/commands/team/review-all.md': 'x\n',
    }
    expect(lint('`/deploy` `/ship` `/review-all`\n', files)).toEqual([])
    expect(ids(lint('`/depl` `/team`\n', files))).toEqual(['command', 'command'])
  })

  it('finds a skill or a command in a .claude folder above', () => {
    const files = { '.claude/skills/deploy/SKILL.md': 'x\n', '.claude/commands/ship.md': 'x\n' }
    expect(lint('`/deploy` `/ship`\n', files, 'packages/a/CLAUDE.md')).toEqual([])
    expect(lint('`/deploy`\n', files, 'packages/a/.claude/rules/x.md')).toEqual([])
    const below = { 'packages/b/.claude/skills/deploy/SKILL.md': 'x\n' }
    expect(ids(lint('`/deploy`\n', below, 'packages/a/CLAUDE.md'))).toEqual(['command'])
  })

  it('looks only in its own folder where no .git is above', () => {
    const files = { '.claude/commands/ship.md': 'x\n', 'sub/.claude/commands/own.md': 'x\n' }
    const dir = tree(files, false)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', '`/own`\n')).toEqual([])
    expect(ids(lintMemory(RULE, dir, 'sub/CLAUDE.md', '`/ship`\n'))).toEqual(['command'])
  })

  it('stays silent on a command that is in the allow option, with or without the slash', () => {
    const options = { allow: ['/init', 'review'] }
    expect(lint('`/init` and `/review`\n', {}, 'CLAUDE.md', options)).toEqual([])
    expect(ids(lint('`/memory`\n', {}, 'CLAUDE.md', options))).toEqual(['command'])
  })

  it('stays silent on text that is not a command to check', () => {
    for (const ref of ['/plugin:deploy', '/', '/ deploy', '/tmp/x', '/-x', '/deploy.md']) {
      expect(lint(`Use \`${ref}\`.\n`), ref).toEqual([])
    }
    expect(lint('Run /deploy to ship.\n')).toEqual([])
    expect(lint('```\n/deploy\n```\n')).toEqual([])
  })

  it.skipIf(noLinks)('stays silent when the lookup meets a link that leads nowhere', () => {
    const dir = tree({})
    link(dir, '.claude/commands/ship.md', 'nowhere.md')
    link(dir, '.claude/skills/deploy', 'nowhere')
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`/ship`\n')).toEqual([])
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`/deploy`\n')).toEqual([])
    expect(ids(lintMemory(RULE, dir, 'CLAUDE.md', '`/other`\n'))).toEqual(['command'])
  })

  it.skipIf(noLinks)('stays silent when a commands folder links out of the repository', () => {
    const dir = tree({})
    link(dir, '.claude/commands', tree({ 'x.md': 'x\n' }))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', '`/gone`\n')).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent when a commands folder has no read right', () => {
    const dir = tree({ '.claude/commands/ship.md': 'x\n', '.claude/commands/sub/a.md': 'x\n' })
    withoutAccess(path.join(dir, '.claude/commands/sub'), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', '`/gone`\n')).toEqual([])
    })
  })
})

describe(`${RULE}: which files report`, () => {
  it('checks a CLAUDE.md, a .claude/CLAUDE.md, a CLAUDE.local.md and a rule file', () => {
    for (const file of [
      'CLAUDE.md',
      '.claude/CLAUDE.md',
      'CLAUDE.local.md',
      '.claude/rules/a.md',
      '.claude/rules/web/a.md',
      'packages/a/CLAUDE.md',
    ]) {
      expect(ids(lint('`gone/x.md` `/gone`\n', {}, file)), file).toEqual(['path', 'command'])
    }
  })

  it('does not check an AGENTS.md or another file', () => {
    for (const file of ['AGENTS.md', 'docs/notes.md', 'README.md']) {
      expect(lint('`gone/x.md` `/gone`\n', {}, file), file).toEqual([])
    }
  })

  it('accepts a list of strings in allow and nothing else', () => {
    expect(() => lint('x\n', {}, 'CLAUDE.md', { allow: [] })).not.toThrow()
    expect(() => lint('x\n', {}, 'CLAUDE.md', { allow: 'init' })).toThrow()
    expect(() => lint('x\n', {}, 'CLAUDE.md', { allow: [1] })).toThrow()
    expect(() => lint('x\n', {}, 'CLAUDE.md', { other: [] })).toThrow()
  })
})
