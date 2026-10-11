// Claude Code matches each `claudeMdExcludes` pattern against absolute file paths. The docs
// example puts a pattern with the home folder of one person in `.claude/settings.local.json`, so
// that the exclusion stays on that machine
// (https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files). A committed file
// shares the pattern with each clone. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-excludes-absolute-committed'

const project = '/repo/.claude/settings.json'

const excludes = (...patterns: unknown[]) => JSON.stringify({ claudeMdExcludes: patterns })

/** The messages for `code` as the file `file`. */
const lint = (code: string, file = project) => lintJson(RULE, code, file)

describe(RULE, () => {
  it('reports a pattern with the folder of one machine, at the pattern', () => {
    const messages = lint('{\n  "claudeMdExcludes": [\n    "/Users/x/work/CLAUDE.md"\n  ]\n}\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'absolute',
      line: 3,
      column: 5,
      endLine: 3,
      endColumn: 30,
    })
    expect(messages[0]?.message).toContain('"/Users/x/work/CLAUDE.md"')
  })

  it('reports a Unix path, a Windows drive with either separator, and a share', () => {
    const patterns = [
      '/home/user/monorepo/other-team/.claude/rules/**',
      '/abs/CLAUDE.md',
      'C:\\work\\monorepo\\**',
      'd:/work/monorepo/CLAUDE.md',
      '\\\\server\\share\\CLAUDE.md',
    ]
    expect(lint(excludes(...patterns)).map((m) => m.messageId)).toEqual(Array(5).fill('absolute'))
  })

  it('reports each machine path of a list, and not the others', () => {
    const messages = lint(excludes('**/vendor/**', '/Users/x/a/**', '**/b/**', '/home/y/c/**'))
    expect(messages.map((m) => m.column)).toEqual([37, 63])
  })

  it('stays silent on a pattern that does not name a machine', () => {
    for (const pattern of [
      '**/monorepo/CLAUDE.md',
      '**/packages/*/CLAUDE.md',
      '**',
      '/**/CLAUDE.md',
      '/*/CLAUDE.md',
      '/{a,b}/CLAUDE.md',
      '/[a]/CLAUDE.md',
      '/',
      'packages/web/**',
      '',
    ]) {
      expect(lint(excludes(pattern)), pattern).toEqual([])
    }
  })

  it('stays silent on a value that is not a list of strings', () => {
    expect(lint('{}')).toEqual([])
    expect(lint('{"claudeMdExcludes": "/Users/x/a"}')).toEqual([])
    expect(lint('{"claudeMdExcludes": {"a": "/Users/x/a"}}')).toEqual([])
    expect(lint(excludes(1, null, ['/Users/x/a']))).toEqual([])
    expect(lint(excludes())).toEqual([])
  })

  it('reads the last of two keys of the same name', () => {
    expect(lint('{"claudeMdExcludes": ["/Users/x/a"], "claudeMdExcludes": ["**/a"]}')).toEqual([])
  })
})

describe(`${RULE}: which files`, () => {
  it('checks the committed project file, in any folder', () => {
    for (const file of ['/repo/.claude/settings.json', '/repo/web/.claude/settings.json']) {
      expect(lint(excludes('/Users/x/a'), file), file).toHaveLength(1)
    }
  })

  it('does not check the local file, a managed file or another settings file', () => {
    for (const file of [
      '/repo/.claude/settings.local.json',
      '/repo/managed-settings.json',
      '/repo/managed-settings.d/10-a.json',
      '/repo/.claude/nested/settings.json',
      '/repo/.vscode/settings.json',
      '/repo/settings.json',
    ]) {
      expect(lint(excludes('/Users/x/a'), file), file).toEqual([])
    }
  })
})
