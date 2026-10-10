// Claude Code adds its own commit and pull request instructions. The docs say that when a
// CLAUDE.md sets commit or pull request rules, you turn the built-in ones off with the setting
// `includeGitInstructions`
// (https://code.claude.com/docs/en/memory#claude-isnt-following-my-claude-md). The rule reads
// the project settings file next to the instruction file, so each case builds a tree on disk.
// The rule reads no file out of the repository, and makes no report when it cannot read the
// settings. The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-git-instructions'

const COMMIT = 'Write commit messages in the imperative mood.\n'
const SETTINGS = '.claude/settings.json'
const OFF = '{"includeGitInstructions": false}'

/** The messages for `code` as the file `file` of a tree with the files `files`. */
function lint(code: string, files: Record<string, string> = {}, file = 'CLAUDE.md') {
  return lintMemory(RULE, tree(files), file, code)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

describe(RULE, () => {
  it('reports commit rules when the settings do not turn the git instructions off', () => {
    const messages = lint(`# Git\n\n${COMMIT}`)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'gitInstructions',
      line: 3,
      column: 1,
      endLine: 3,
      endColumn: 46,
    })
    expect(messages[0]?.message).toBe(
      'This file sets commit or pull request rules, and the project settings do not set `includeGitInstructions` to `false`. Claude Code adds its own git instructions, which compete with these rules. Set the key to `false` in `.claude/settings.json`.',
    )
  })

  it('stays silent when the project settings set includeGitInstructions to false', () => {
    expect(lint(COMMIT, { [SETTINGS]: OFF })).toEqual([])
    expect(
      lint(COMMIT, { [SETTINGS]: '{"model": "opus", "includeGitInstructions": false}' }),
    ).toEqual([])
  })

  it('reports when the key is true, another value, or not set, or the file is absent', () => {
    for (const settings of [
      '{"includeGitInstructions": true}',
      '{"includeGitInstructions": "false"}',
      '{"includeGitInstructions": null}',
      '{"model": "opus"}',
      '{}',
    ]) {
      expect(ids(lint(COMMIT, { [SETTINGS]: settings })), settings).toEqual(['gitInstructions'])
    }
    expect(ids(lint(COMMIT, {}))).toEqual(['gitInstructions'])
  })

  it('reads the project file only, and not the local file', () => {
    const local = { '.claude/settings.local.json': OFF }
    expect(ids(lint(COMMIT, local))).toEqual(['gitInstructions'])
  })

  it('reports once in a paragraph that has two matching sentences, at the first matching sentence', () => {
    const messages = lint('Be kind. Write commit messages in English. Open a pull request.\n')
    expect(messages.map((m) => [m.column, m.endColumn])).toEqual([[10, 43]])
  })

  it('stays silent when env sets CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS to 1', () => {
    const env = (value: string) => `{"env": {"CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS": ${value}}}`
    expect(lint(COMMIT, { [SETTINGS]: env('"1"') })).toEqual([])
    expect(lint(COMMIT, { [SETTINGS]: env('1') })).toEqual([])
    // The variable takes precedence over the setting.
    const both =
      '{"includeGitInstructions": true, "env": {"CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS": "1"}}'
    expect(lint(COMMIT, { [SETTINGS]: both })).toEqual([])
  })

  it('reports when the env variable is 0, another value, not set, or env is not an object', () => {
    const env = (value: string) => `{"env": {"CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS": ${value}}}`
    for (const settings of [
      env('"0"'),
      env('""'),
      env('"true"'),
      env('null'),
      '{"env": {"OTHER": "1"}}',
      '{"env": "1"}',
      '{"env": null}',
    ]) {
      expect(ids(lint(COMMIT, { [SETTINGS]: settings })), settings).toEqual(['gitInstructions'])
    }
  })

  it('stays silent when the topic and the cue are in two sentences', () => {
    expect(lint('Commit messages live in git. Use tabs.\n')).toEqual([])
  })

  it('still reports when the key is set to a value that is not false', () => {
    for (const value of ['0', '""']) {
      const settings = `{ "includeGitInstructions": ${value} }`
      expect(ids(lint(COMMIT, { [SETTINGS]: settings })), value).toEqual(['gitInstructions'])
    }
  })

  it('reports once for the file, at the first sentence', () => {
    const messages = lint(
      'Open a pull request for each change.\n\nWrite commit messages in English.\n',
    )
    expect(messages.map((m) => [m.line, m.column])).toEqual([[1, 1]])
  })
})

describe(`${RULE}: the wording`, () => {
  it('reports each topic with an instruction cue in the same sentence', () => {
    for (const text of [
      'Write commit messages in the imperative mood.',
      'Always follow the commit message format.',
      'Use Conventional Commits.',
      'Never add Co-Authored-By lines.',
      'Include a Signed-off-by line.',
      'Open a pull request for each change.',
      'The PR title must start with a type.',
      'Keep the PR description short.',
      'Run `gh pr create --draft` for new work.',
      'Do not use `git commit --amend` after a push.',
      'Use a PR body that links the issue.',
      '- Always squash pull requests.',
      '# Pull request rules: keep them small',
    ]) {
      expect(ids(lint(`${text}\n`)), text).toEqual(['gitInstructions'])
    }
  })

  it('stays silent on text that sets no commit or pull request rule', () => {
    for (const text of [
      'Run `npm test` before committing.',
      'Use 2-space indentation.',
      'Commits are in the log.',
      'The pull request template is on GitHub.',
      'A commit is a snapshot.',
      'Check the project board.',
      'Pull requests are squash-merged.',
    ]) {
      expect(lint(`${text}\n`), text).toEqual([])
    }
  })

  it('stays silent on a mention in a fence, an HTML comment or an indented block', () => {
    expect(lint('```\nWrite commit messages in English.\n```\n')).toEqual([])
    expect(lint('<!-- Write commit messages in English. -->\n')).toEqual([])
    expect(lint('    Write commit messages in English.\n')).toEqual([])
  })
})

describe(`${RULE}: which files report`, () => {
  it('checks a CLAUDE.md, a .claude/CLAUDE.md and a rule file', () => {
    for (const file of [
      'CLAUDE.md',
      '.claude/CLAUDE.md',
      '.claude/rules/git.md',
      '.claude/rules/web/git.md',
      '.claude/rules/CLAUDE.md',
      'packages/a/CLAUDE.md',
    ]) {
      expect(ids(lint(COMMIT, {}, file)), file).toEqual(['gitInstructions'])
    }
  })

  it('does not check a CLAUDE.local.md, an AGENTS.md or another file', () => {
    for (const file of ['CLAUDE.local.md', 'AGENTS.md', 'docs/git.md', 'git.md']) {
      expect(lint(COMMIT, {}, file), file).toEqual([])
    }
  })

  it('reads the settings of the folder that holds .claude for a file in .claude', () => {
    const files = { 'packages/a/.claude/settings.json': OFF }
    expect(lint(COMMIT, files, 'packages/a/.claude/CLAUDE.md')).toEqual([])
    expect(lint(COMMIT, files, 'packages/a/.claude/rules/web/git.md')).toEqual([])
    expect(ids(lint(COMMIT, files, 'packages/b/.claude/CLAUDE.md'))).toEqual(['gitInstructions'])
  })

  it('reads the settings of each folder above, up to the repository root', () => {
    expect(lint(COMMIT, { [SETTINGS]: OFF }, 'packages/a/CLAUDE.md')).toEqual([])
    expect(lint(COMMIT, { 'packages/.claude/settings.json': OFF }, 'packages/a/CLAUDE.md')).toEqual(
      [],
    )
    expect(
      ids(lint(COMMIT, { 'packages/b/.claude/settings.json': OFF }, 'packages/a/CLAUDE.md')),
    ).toEqual(['gitInstructions'])
  })

  it('does not read a folder above the repository root', () => {
    const dir = tree({ [SETTINGS]: OFF, 'inner/.git/HEAD': 'ref\n' })
    expect(lintMemory(RULE, dir, 'inner/CLAUDE.md', COMMIT)).toHaveLength(1)
    expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
  })

  it('reads only its own folder where no .git is above', () => {
    const dir = tree({ [SETTINGS]: OFF }, false)
    expect(lintMemory(RULE, dir, 'sub/CLAUDE.md', COMMIT)).toHaveLength(1)
    expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
  })
})

describe(`${RULE}: settings that the rule cannot read`, () => {
  it('stays silent when the settings file is not JSON, or not an object', () => {
    for (const settings of [
      '{',
      '',
      '[]',
      '"false"',
      'null',
      '{"includeGitInstructions": false,}',
    ]) {
      expect(lint(COMMIT, { [SETTINGS]: settings }), settings).toEqual([])
    }
  })

  it.skipIf(chmodCannotBlock)('stays silent when the settings file has no read right', () => {
    const dir = tree({ [SETTINGS]: '{}' })
    withoutAccess(path.join(dir, SETTINGS), () => {
      expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
    })
  })

  it.skipIf(noLinks)('stays silent when the settings file is a link that leads nowhere', () => {
    const dir = tree({})
    link(dir, SETTINGS, 'nowhere.json')
    expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
  })

  it.skipIf(noLinks)('stays silent when the settings file is a link out of the repository', () => {
    const dir = tree({})
    link(dir, SETTINGS, path.join(tree({ 'settings.json': OFF }), 'settings.json'))
    expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
    const plain = tree({})
    link(plain, SETTINGS, path.join(tree({ 'settings.json': '{}' }), 'settings.json'))
    expect(lintMemory(RULE, plain, 'CLAUDE.md', COMMIT)).toEqual([])
  })

  it.skipIf(noLinks)('stays silent when the .claude folder is a link that leads nowhere', () => {
    const dir = tree({})
    link(dir, '.claude', 'nowhere')
    expect(lintMemory(RULE, dir, 'CLAUDE.md', COMMIT)).toEqual([])
  })

  it('stays silent on a folder above that has a settings file it cannot read', () => {
    const files = { 'packages/.claude/settings.json': '{' }
    expect(lint(COMMIT, files, 'packages/a/CLAUDE.md')).toEqual([])
  })
})
