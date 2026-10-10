// A path-scoped rule loads when Claude works with a file that one of its `paths` globs matches
// (https://code.claude.com/docs/en/memory#path-specific-rules). A glob that matches no file
// scopes the rule to nothing. The rule matches each glob against the files on disk below the
// folder that holds `.claude/`, inside the repository, and skips `.git` and `node_modules`. The
// docs say `*.md` matches Markdown files in the project root. Each case builds a tree on disk.
// The globs are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, lintMemory, noLinks, tree } from '../memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'rules-paths-no-match'

const SRC = {
  'src/api/users.ts': 'x\n',
  'src/components/Button.tsx': 'x\n',
  'src/components/deep/Card.tsx': 'x\n',
  'lib/util.ts': 'x\n',
  'README.md': '# R\n',
  'docs/guide.md': '# G\n',
  '.github/workflows/ci.yml': 'x\n',
}

/** The rule file text with the value `paths` as a YAML list. */
const listOf = (...globs: string[]) =>
  `---\npaths:\n${globs.map((glob) => `  - "${glob}"\n`).join('')}---\n\n# Rule\n`

/** The messages for `code` as the rule file `file` of the tree `files`. */
function lint(code: string, files: Record<string, string> = SRC, file = '.claude/rules/api.md') {
  return lintMemory(RULE, tree(files), file, code)
}

const patterns = (messages: { message: string }[]) =>
  messages.map((m) => /"([^"]*)"/.exec(m.message)?.[1])

describe(RULE, () => {
  it.fails('reports a glob that matches no file, at the paths field', () => {
    const messages = lint(listOf('docs/**/*.ts'))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'noMatch',
      line: 2,
      column: 1,
    })
    expect(patterns(messages)).toEqual(['docs/**/*.ts'])
  })

  it.fails('stays silent on a glob that matches a file', () => {
    expect(lint(listOf('src/**/*.ts'))).toEqual([])
    expect(lint(listOf('**/*.ts'))).toEqual([])
    expect(lint(listOf('src/**/*'))).toEqual([])
    expect(lint(listOf('src/components/*.tsx'))).toEqual([])
    expect(lint(listOf('src/**/*.{ts,tsx}'))).toEqual([])
    expect(lint(listOf('src/api/users.ts'))).toEqual([])
    expect(lint(listOf('lib/*.t?'))).toEqual([])
    expect(lint(listOf('src/api/[u]sers.ts'))).toEqual([])
    expect(lint(listOf('src/api/[!x]sers.ts'))).toEqual([])
  })

  it.fails('matches *.md against files in the root only', () => {
    expect(lint(listOf('*.md'))).toEqual([])
    expect(patterns(lint(listOf('*.md'), { 'docs/guide.md': '# G\n' }))).toEqual(['*.md'])
    expect(lint(listOf('**/*.md'), { 'docs/guide.md': '# G\n' })).toEqual([])
    expect(lint(listOf('*.ts'), SRC)).toHaveLength(1)
  })

  it.fails('reports each glob of the list that matches no file, and no other', () => {
    const messages = lint(listOf('src/**/*.ts', 'nope/**', 'lib/*.ts', '**/*.py'))
    expect(patterns(messages)).toEqual(['nope/**', '**/*.py'])
  })

  it.fails('reads a comma-separated string, and a string with a brace group', () => {
    expect(lint('---\npaths: "src/**/*.ts, lib/*.ts"\n---\n')).toEqual([])
    expect(patterns(lint('---\npaths: "src/**/*.ts, nope/*"\n---\n'))).toEqual(['nope/*'])
    expect(patterns(lint('---\npaths: "src/{api,nope}/*.ts"\n---\n'))).toEqual([])
    expect(patterns(lint('---\npaths: "src/{nope,none}/*.ts"\n---\n'))).toEqual([
      'src/{nope,none}/*.ts',
    ])
  })

  it.fails('matches a folder name, a trailing slash and a leading dot-slash', () => {
    expect(lint(listOf('src/api', 'src/', './lib', './src/api/*.ts', '/lib/*.ts'))).toEqual([])
    expect(patterns(lint(listOf('nope', 'nope/', './nope/*')))).toEqual([
      'nope',
      'nope/',
      './nope/*',
    ])
  })

  it.fails('matches a dot folder, and a name with a dot', () => {
    expect(lint(listOf('.github/**', '.github/workflows/*.yml', '**/ci.yml'))).toEqual([])
  })

  it.fails('keeps a literal brace group without a comma, and escapes', () => {
    expect(patterns(lint(listOf('src/{api}/*.ts')))).toEqual(['src/{api}/*.ts'])
    expect(lint(listOf('src/{api}/*.ts'), { 'src/{api}/x.ts': 'x\n' })).toEqual([])
    expect(lint(listOf('a\\*b.ts'), { 'a*b.ts': 'x\n' })).toEqual([])
    expect(patterns(lint(listOf('a\\*b.ts'), { 'axb.ts': 'x\n' }))).toEqual(['a\\*b.ts'])
    expect(lint(listOf('c.ts\\'), { 'c.ts\\': 'x\n' })).toEqual([])
  })

  it.fails('stays silent without paths, with an empty value, or with frontmatter that fails', () => {
    expect(lint('# Rule\n')).toEqual([])
    expect(lint('---\n---\n# Rule\n')).toEqual([])
    expect(lint('---\npaths: []\n---\n')).toEqual([])
    expect(lint('---\npaths: ""\n---\n')).toEqual([])
    expect(lint('---\npaths: [\n---\n')).toEqual([])
    expect(lint('---\npaths: 5\n---\n')).toEqual([])
  })
})

describe(`${RULE}: where the files are`, () => {
  it.fails('starts at the folder that holds .claude, for a nested rules folder', () => {
    const files = { 'src/a.ts': 'x\n', 'packages/web/lib/b.ts': 'x\n' }
    const file = 'packages/web/.claude/rules/web.md'
    expect(lint(listOf('lib/*.ts'), files, file)).toEqual([])
    expect(patterns(lint(listOf('src/*.ts'), files, file))).toEqual(['src/*.ts'])
  })

  it.fails('reads a rule at any depth below .claude/rules', () => {
    expect(patterns(lint(listOf('nope/*'), SRC, '.claude/rules/sub/deep.md'))).toEqual(['nope/*'])
  })

  it.fails('skips .git and node_modules', () => {
    const files = {
      'node_modules/pkg/index.ts': 'x\n',
      'sub/node_modules/pkg/index.ts': 'x\n',
      'sub/.git/HEAD': 'ref\n',
      'a.md': 'a\n',
    }
    expect(patterns(lint(listOf('**/index.ts', '**/HEAD', 'node_modules/**'), files))).toEqual([
      '**/index.ts',
      '**/HEAD',
      'node_modules/**',
    ])
  })

  it.fails('does not read a file or a folder above the repository root', () => {
    const dir = tree({ 'up.ts': 'x\n', 'inner/.git/HEAD': 'ref\n', 'inner/in.md': 'x\n' })
    expect(patterns(lintMemory(RULE, dir, 'inner/.claude/rules/r.md', listOf('*.ts')))).toEqual([
      '*.ts',
    ])
  })

  it.fails('makes no report for a rule that is not in a repository', () => {
    expect(lint(listOf('nope/**'), SRC, '.claude/rules/api.md')).toHaveLength(1)
    const dir = tree(SRC, false)
    expect(lintMemory(RULE, dir, '.claude/rules/api.md', listOf('nope/**'))).toEqual([])
  })

  it.fails('checks a rule file, and no other file', () => {
    for (const file of ['CLAUDE.md', 'docs/rule.md', '.claude/skills/x/SKILL.md', 'rules/x.md']) {
      expect(lint(listOf('nope/**'), SRC, file), file).toEqual([])
    }
  })
})

describe(`${RULE}: the glob problems that another rule reports`, () => {
  it.fails('makes no report for a glob with a broken bracket', () => {
    expect(lint(listOf('photos [2024/**'))).toEqual([])
    expect(patterns(lint(listOf('photos [2024/**', 'nope/*')))).toEqual(['nope/*'])
  })

  it.fails('makes no report for a list that expands past the budget', () => {
    const many = `{a,b,c,d,e}/${'{a,b,c,d}/'.repeat(5)}x`
    expect(lint(listOf(many, 'nope/*'))).toEqual([])
  })
})

describe(`${RULE}: what the rule cannot read`, () => {
  it.skipIf(noLinks).fails('follows a link inside the repository, and ends a cycle', () => {
    const dir = tree({ 'real/deep/x.ts': 'x\n', 'a.md': 'a\n' })
    link(dir, 'alias', 'real')
    link(dir, 'real/deep/loop', '..')
    link(dir, 'file-link.ts', 'real/deep/x.ts')
    link(dir, 'gone.ts', 'nowhere.ts')
    const run = (...globs: string[]) =>
      patterns(lintMemory(RULE, dir, '.claude/rules/r.md', listOf(...globs)))
    expect(run('alias/deep/*.ts', 'file-link.ts', 'real/deep/loop/deep/x.ts')).toEqual([])
    expect(run('nope/*', 'gone.ts')).toEqual(['nope/*', 'gone.ts'])
  })

  it.skipIf(noLinks).fails('makes no report when a link leads out of the repository', () => {
    const outside = tree({ 'o.ts': 'x\n' })
    const dir = tree({ 'a.md': 'a\n' })
    link(dir, 'out', outside)
    expect(lintMemory(RULE, dir, '.claude/rules/r.md', listOf('out/*.ts'))).toEqual([])
    expect(lintMemory(RULE, dir, '.claude/rules/r.md', listOf('a.md'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock).fails('makes no report below a folder that it cannot read', () => {
    const dir = tree({ 'secret/s.ts': 'x\n', 'a.md': 'a\n' })
    withoutAccess(path.join(dir, 'secret'), () => {
      expect(lintMemory(RULE, dir, '.claude/rules/r.md', listOf('nope/*'))).toEqual([])
      expect(lintMemory(RULE, dir, '.claude/rules/r.md', listOf('*.md'))).toEqual([])
    })
  })
})
